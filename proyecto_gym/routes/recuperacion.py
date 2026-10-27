"""
Recuperar la contraseña del portal con un código enviado al correo (versión nube).

Sin estado en memoria: el código se calcula con HMAC (cuenta + contraseña actual + ventana de
10 minutos) y el "desafío" es un token firmado. Así funciona igual desde el celular o la PC, aunque
Render se reinicie o se duerma entre pedir el código y escribirlo. Al cambiar la contraseña el código
deja de servir. Los correos llevan el código en el asunto (Gmail no los agrupa ni los esconde).
"""
import hashlib
import hmac
import re
import threading
import time
from datetime import timedelta

from fastapi import APIRouter, Body, Depends, HTTPException

import validadores as V
from auth import SECRET_KEY, create_access_token, decode_token, hash_password
from database import get_db
from dependencies import limitar_intentos_login
from routes import verificacion as _ver

router_portal = APIRouter(prefix="/api/portal/recuperar", tags=["Recuperar contraseña (portal)"])

VENTANA = 600
ESPERA_REENVIO = 20
MAX_INTENTOS = 6
_lock = threading.Lock()
_ultimo = {}
_fallos = {}


def _huella(ph):
    return hashlib.sha256(("rec:" + (ph or "")).encode()).hexdigest()[:20]


def _codigo(id_socio, ph, ventana):
    mac = hmac.new(SECRET_KEY.encode(), f"rec:{id_socio}:{_huella(ph)}:{ventana}".encode(), hashlib.sha256).digest()
    return f"{int.from_bytes(mac[:4], 'big') % 10**6:06d}"


def _desafio(id_socio):
    return create_access_token({"typ": "rec", "id": id_socio}, expires_delta=timedelta(minutes=20))


def _falso():
    return create_access_token({"typ": "rec", "id": 0}, expires_delta=timedelta(minutes=20))


def _respuesta(desafio, correo=None):
    return {"desafio": desafio, "correo": _ver._mascara(correo) if correo else "tu correo",
            "mensaje": "Si la cuenta existe, te enviamos un código al correo.", "vigencia_min": VENTANA // 60}


@router_portal.post("/solicitar")
def portal_solicitar(data: dict = Body(...), _=Depends(limitar_intentos_login(8, 60))):
    ident = str(data.get("identificador") or data.get("email") or "").strip().lower()[:150]
    if not ident:
        raise HTTPException(status_code=422, detail="Escribe tu correo o usuario")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT pa.id_socio, s.email, s.nombres, COALESCE(s.activo, TRUE), pa.is_active, pa.password_hash "
            "FROM portal_accounts pa JOIN socios s ON s.id_socio = pa.id_socio "
            "WHERE lower(trim(s.email)) = %s OR lower(pa.username) = %s "
            "ORDER BY (lower(trim(s.email)) = %s) DESC LIMIT 1", (ident, ident, ident))
        f = cur.fetchone()
    if not f or not f[1] or not f[3] or not f[4]:
        return _respuesta(_falso())
    id_socio, correo, nombres, ph = f[0], f[1], f[2], f[5]
    cfg = _ver._config_correo()
    if not cfg:
        raise HTTPException(status_code=503, detail="Por ahora no podemos enviar códigos por correo. Pídelo en recepción.")
    ahora = time.time()
    with _lock:
        espera = ESPERA_REENVIO - (ahora - _ultimo.get(id_socio, 0))
        if espera > 0:
            raise HTTPException(status_code=429, detail=f"Ya te enviamos un código. Revisa tu correo (y Spam) o espera {int(espera) + 1} segundos para pedir otro.")
        _ultimo[id_socio] = ahora
    codigo = _codigo(id_socio, ph, int(ahora // VENTANA))
    nombre = (nombres or "").split(" ")[0] or ""
    texto = (f"Hola {nombre},\n\nTu código para cambiar la contraseña es: {codigo}\n\n"
             f"Vale unos 10 minutos. Si no lo pediste tú, ignora este mensaje: tu contraseña no cambia.")
    html = (f"<div style='font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #ddd;border-radius:14px'>"
            f"<h2 style='margin:0 0 8px'>Cambiar tu contraseña</h2><p>Hola <b>{nombre}</b>, usa este código:</p>"
            f"<p style='font-size:34px;letter-spacing:8px;font-weight:800;margin:14px 0'>{codigo}</p>"
            f"<p style='color:#666;font-size:13px'>Vale unos 10 minutos. Si no lo pediste tú, ignora este mensaje: tu contraseña no cambia.</p></div>")
    try:
        _ver._enviar(cfg, correo, f"Código para cambiar tu contraseña: {codigo}", texto, html)
    except Exception as e:  # noqa: BLE001
        with _lock:
            _ultimo.pop(id_socio, None)
        print(f"❌ correo de recuperación: {type(e).__name__}: {str(e)[:150]}", flush=True)
        raise HTTPException(status_code=502, detail="No pudimos enviar el correo ahora. Intenta de nuevo en un minuto.")
    return _respuesta(_desafio(id_socio), correo)


@router_portal.post("/confirmar")
def portal_confirmar(data: dict = Body(...), _=Depends(limitar_intentos_login(10, 60))):
    nueva = str(data.get("password_nuevo") or "")
    try:
        nueva = V.contrasena(nueva, minimo=8)
        if not (re.search(r"[A-Za-z]", nueva) and re.search(r"\d", nueva)):
            raise ValueError("La contraseña nueva debe combinar letras y números")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    p = decode_token(str(data.get("desafio") or ""))
    if not p or p.get("typ") != "rec" or not p.get("id"):
        raise HTTPException(status_code=401, detail="El código venció. Pide uno nuevo.")
    id_socio = p["id"]
    codigo = "".join(c for c in str(data.get("codigo") or "") if c.isdigit())
    ventana = int(time.time() // VENTANA)
    with _lock:
        if _fallos.get((id_socio, ventana), 0) >= MAX_INTENTOS:
            raise HTTPException(status_code=429, detail="Demasiados intentos. Pide un código nuevo en unos minutos.")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT password_hash FROM portal_accounts WHERE id_socio = %s AND is_active", (id_socio,))
        f = cur.fetchone()
        ok = bool(f) and any(hmac.compare_digest(codigo, _codigo(id_socio, f[0], v)) for v in (ventana, ventana - 1))
        if not ok:
            with _lock:
                _fallos[(id_socio, ventana)] = _fallos.get((id_socio, ventana), 0) + 1
                for k in [k for k in _fallos if k[1] < ventana - 1]:
                    _fallos.pop(k, None)
            raise HTTPException(status_code=401, detail="Código incorrecto")
        cur.execute(
            "UPDATE portal_accounts SET password_hash = %s, must_change_password = FALSE, temp_password = NULL "
            "WHERE id_socio = %s", (hash_password(nueva), id_socio))
    return {"mensaje": "Listo. Ya puedes entrar con tu contraseña nueva."}
