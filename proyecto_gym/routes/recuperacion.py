"""
routes/recuperacion.py - Recuperar la contraseña con un código enviado al correo.

  • Socios del portal público:   /api/portal/recuperar/solicitar  y  /confirmar
  • Administrador de Recepción:  /api/auth/recuperar/solicitar    y  /confirmar
        (se pide el carnet de respaldo + el correo de la cuenta)

El código tiene 6 dígitos, vale 10 minutos, se puede intentar 5 veces y nunca se guarda en claro.
Las respuestas de "solicitar" son siempre iguales exista o no la cuenta (no revelan qué correos existen).
"""
import hashlib
import re
import secrets
import threading
import time

from fastapi import APIRouter, Body, Depends, HTTPException, Request

import validadores as V
from auth import hash_password
from database import get_db
from dependencies import limitar_intentos_login
from routes import verificacion as _ver

router_portal = APIRouter(prefix="/api/portal/recuperar", tags=["Recuperar contraseña (portal)"])

VIGENCIA = 600
MAX_INTENTOS = 5
ESPERA_REENVIO = 45  # segundos entre códigos para la misma cuenta

_pend = {}
_ultimo_envio = {}
_lock = threading.Lock()


def _mascara(correo):
    usr, _, dom = (correo or "").partition("@")
    return (usr[:2] + "•" * max(1, len(usr) - 2) + "@" + dom) if dom else "tu correo"


def _hash(codigo, sal):
    return hashlib.sha256((sal + codigo).encode()).hexdigest()


def _crear(tipo, datos):
    """Devuelve (desafio, codigo). datos=None crea un desafío falso (cuenta inexistente)."""
    codigo = f"{secrets.randbelow(10**6):06d}"
    sal = secrets.token_hex(8)
    desafio = secrets.token_urlsafe(18)
    with _lock:
        ahora = time.time()
        for k in [k for k, v in _pend.items() if v["vence"] < ahora]:
            _pend.pop(k, None)
        _pend[desafio] = {"tipo": tipo, "datos": datos, "sal": sal, "h": _hash(codigo, sal),
                          "vence": ahora + VIGENCIA, "intentos": 0}
    return desafio, codigo


def _consumir(tipo, desafio, codigo):
    codigo = "".join(c for c in str(codigo or "") if c.isdigit())
    with _lock:
        d = _pend.get(str(desafio or ""))
        if not d or d["tipo"] != tipo or d["vence"] < time.time():
            _pend.pop(str(desafio or ""), None)
            raise HTTPException(status_code=401, detail="El código venció. Pide uno nuevo.")
        d["intentos"] += 1
        if d["intentos"] > MAX_INTENTOS:
            _pend.pop(desafio, None)
            raise HTTPException(status_code=429, detail="Demasiados intentos. Pide un código nuevo.")
        if not d["datos"] or not secrets.compare_digest(_hash(codigo, d["sal"]), d["h"]):
            raise HTTPException(status_code=401, detail="Código incorrecto")
        _pend.pop(desafio, None)
        return d["datos"]


def _puede_enviar(clave):
    ahora = time.time()
    with _lock:
        if ahora - _ultimo_envio.get(clave, 0) < ESPERA_REENVIO:
            return False
        if len(_ultimo_envio) > 5000:
            _ultimo_envio.clear()
        _ultimo_envio[clave] = ahora
        return True


def _enviar(correo, codigo, titulo, saludo):
    cfg = _ver._config_correo()
    if not cfg:
        raise HTTPException(status_code=503, detail="Por ahora no podemos enviar códigos por correo. Pídelo en recepción.")
    texto = (f"Hola {saludo},\n\nTu código para {titulo.lower()} es: {codigo}\n\n"
             f"Vale {VIGENCIA // 60} minutos. Si no lo pediste tú, ignora este mensaje: tu contraseña no cambia.")
    html = (f"<div style='font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #ddd;border-radius:14px'>"
            f"<h2 style='margin:0 0 8px'>{titulo}</h2><p>Hola <b>{saludo}</b>, usa este código:</p>"
            f"<p style='font-size:34px;letter-spacing:8px;font-weight:800;margin:14px 0'>{codigo}</p>"
            f"<p style='color:#666;font-size:13px'>Vale {VIGENCIA // 60} minutos. Si no lo pediste tú, ignora este mensaje: "
            f"tu contraseña no cambia.</p></div>")
    _ver._enviar(cfg, correo, titulo, texto, html)


def _respuesta(desafio, correo=None):
    return {"desafio": desafio, "correo": _mascara(correo) if correo else "tu correo",
            "mensaje": "Si la cuenta existe, te enviamos un código al correo.", "vigencia_min": VIGENCIA // 60}


# ──────────────────────────── Socios del portal ────────────────────────────
@router_portal.post("/solicitar")
def portal_solicitar(request: Request, data: dict = Body(...), _=Depends(limitar_intentos_login(6, 60))):
    ident = str(data.get("identificador") or data.get("email") or "").strip().lower()[:150]
    if not ident:
        raise HTTPException(status_code=422, detail="Escribe tu correo o usuario")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT pa.id_socio, s.email, s.nombres, COALESCE(s.activo, TRUE), pa.is_active "
            "FROM portal_accounts pa JOIN socios s ON s.id_socio = pa.id_socio "
            "WHERE lower(trim(s.email)) = %s OR lower(pa.username) = %s "
            "ORDER BY (lower(trim(s.email)) = %s) DESC LIMIT 1", (ident, ident, ident))
        f = cur.fetchone()
    if not f or not f[1] or not f[3] or not f[4]:
        desafio, _c = _crear("portal", None)
        return _respuesta(desafio)
    id_socio, correo, nombres = f[0], f[1], f[2]
    if not _puede_enviar(f"portal:{id_socio}"):
        desafio, _c = _crear("portal", None)
        return _respuesta(desafio, correo)
    desafio, codigo = _crear("portal", {"id_socio": id_socio})
    _enviar(correo, codigo, "Código para cambiar tu contraseña", (nombres or "").split(" ")[0] or "")
    return _respuesta(desafio, correo)


@router_portal.post("/confirmar")
def portal_confirmar(request: Request, data: dict = Body(...), _=Depends(limitar_intentos_login(10, 60))):
    nueva = str(data.get("password_nuevo") or "")
    try:
        nueva = V.contrasena(nueva, minimo=8)
        if not (re.search(r"[A-Za-z]", nueva) and re.search(r"\d", nueva)):
            raise ValueError("La contraseña nueva debe combinar letras y números")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    datos = _consumir("portal", data.get("desafio"), data.get("codigo"))
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE portal_accounts SET password_hash = %s, must_change_password = FALSE, temp_password = NULL "
            "WHERE id_socio = %s", (hash_password(nueva), datos["id_socio"]))
    return {"mensaje": "Listo. Ya puedes entrar con tu contraseña nueva."}
