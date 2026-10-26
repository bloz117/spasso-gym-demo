"""
routes/verificacion.py - Verificación por correo del Portal Público (miembros y entrenadores).

Idea: el código al correo se pide UNA vez por dispositivo (y se vuelve a pedir cada DISPOSITIVO_DIAS).
Sirve igual en la PC del gimnasio y en Render:
  * Sin estado en el servidor: el código se calcula con HMAC(SECRET_KEY) y el "desafío" es un token firmado,
    así que reiniciar el servidor (Render lo hace al dormir) no rompe un código recién enviado.
  * Si el correo no está configurado (o la cuenta no tiene correo) NO se pide código: nadie queda fuera.
  * Correo: usa la configuración de Recepción si existe (Configuración > Mensajes al Miembro); si no,
    las variables SMTP_USER / SMTP_PASS (y opcional SMTP_HOST, SMTP_PORT, SMTP_FROM) del servidor (Render).
"""
import hashlib
import hmac
import os
import smtplib
import threading
import time
from datetime import timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import HTTPException

from auth import SECRET_KEY, create_access_token, decode_token

DISPOSITIVO_DIAS = 30
VENTANA_SEG = 600          # el código vale entre 10 y 20 minutos
ESPERA_REENVIO = 60
MAX_INTENTOS = 8

_lock = threading.Lock()
_ultimo_envio = {}         # clave -> momento del último correo (evita mandar varios seguidos)
_intentos = {}             # (clave, ventana) -> intentos fallidos


def _mascara(correo):
    usr, _, dom = (correo or "").partition("@")
    return (usr[:2] + "•" * max(1, len(usr) - 2) + "@" + dom) if dom else "tu correo"


def _huella(password_hash):
    """Cambia al cambiar la contraseña: invalida los dispositivos recordados."""
    return hashlib.sha256(("dev:" + (password_hash or "")).encode()).hexdigest()[:20]


def token_dispositivo(clave, password_hash):
    return create_access_token({"typ": "dev", "sub": str(clave), "dev": _huella(password_hash)},
                               expires_delta=timedelta(days=DISPOSITIVO_DIAS))


def dispositivo_valido(tokens, clave, password_hash):
    for t in str(tokens or "").split(",")[:8]:
        t = t.strip()
        p = decode_token(t) if t else None
        if (p and p.get("typ") == "dev" and p.get("sub") == str(clave)
                and hmac.compare_digest(str(p.get("dev") or ""), _huella(password_hash))):
            return True
    return False


def _codigo(clave, password_hash, ventana):
    mac = hmac.new(SECRET_KEY.encode(), f"cod:{clave}:{_huella(password_hash)}:{ventana}".encode(), hashlib.sha256).digest()
    return f"{int.from_bytes(mac[:4], 'big') % 10**6:06d}"


def _config_correo():
    """(host, puerto, usuario, clave, remitente) o None si no hay correo configurado."""
    try:
        from database import get_db
        from routes.bienvenida import _leer_config
        with get_db() as conn:
            cfg = _leer_config(conn.cursor())
        if cfg.get("smtp_user") and cfg.get("smtp_pass"):
            return (cfg["smtp_host"], int(cfg["smtp_port"]), cfg["smtp_user"], cfg["smtp_pass"], cfg.get("remitente") or "Spasso Gym")
    except Exception:  # noqa: BLE001  (en Render no existe esa tabla/ruta)
        pass
    u, p = os.getenv("SMTP_USER"), os.getenv("SMTP_PASS")
    if u and p:
        return (os.getenv("SMTP_HOST", "smtp.gmail.com"), int(os.getenv("SMTP_PORT", "587")), u, p,
                os.getenv("SMTP_FROM", "Spasso Gym"))
    return None


def correo_listo():
    return _config_correo() is not None


def _enviar(cfg, destino, asunto, texto, html):
    host, puerto, user, clave, remitente = cfg
    msg = MIMEMultipart("alternative")
    msg.attach(MIMEText(texto, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    msg["Subject"] = asunto
    msg["From"] = f"{remitente} <{user}>"
    msg["To"] = destino
    if puerto == 465:
        srv = smtplib.SMTP_SSL(host, 465, timeout=20)
    else:
        srv = smtplib.SMTP(host, puerto, timeout=20)
        srv.starttls()
    srv.login(user, clave)
    srv.sendmail(user, [destino], msg.as_string())
    srv.quit()


def exigir_codigo(clave, id_cuenta, rol, password_hash, correo, dispositivo, nombre=""):
    """None = puede entrar directo; dict = hay que pedir el código (ya se envió al correo)."""
    if os.getenv("REMOTO_SIN_CODIGO") == "1" or not correo:
        return None
    if dispositivo_valido(dispositivo, clave, password_hash):
        return None
    cfg = _config_correo()
    if not cfg:
        return None
    ahora = time.time()
    ventana = int(ahora // VENTANA_SEG)
    codigo = _codigo(clave, password_hash, ventana)
    with _lock:
        reciente = ahora - _ultimo_envio.get(clave, 0) < ESPERA_REENVIO
        if not reciente:
            _ultimo_envio[clave] = ahora
    if not reciente:
        texto = (f"Hola {nombre},\n\nTu código para entrar es: {codigo}\n\n"
                 f"Solo se pide una vez en este dispositivo (después te recordamos por {DISPOSITIVO_DIAS} días). "
                 f"Si no fuiste tú, ignora este mensaje.")
        html = (f"<div style='font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #ddd;border-radius:14px'>"
                f"<h2 style='margin:0 0 8px'>Tu código de acceso</h2><p>Hola <b>{nombre}</b>, escribe este código para entrar:</p>"
                f"<p style='font-size:34px;letter-spacing:8px;font-weight:800;margin:14px 0'>{codigo}</p>"
                f"<p style='color:#666;font-size:13px'>Solo se pide una vez en este dispositivo. Si no fuiste tú, ignora este mensaje.</p></div>")
        try:
            _enviar(cfg, correo, "Tu código de acceso", texto, html)
        except Exception as e:  # noqa: BLE001
            with _lock:
                _ultimo_envio.pop(clave, None)
            raise HTTPException(status_code=502, detail=f"No se pudo enviar el código al correo: {e}")
    desafio = create_access_token({"typ": "chal", "k": clave, "id": id_cuenta, "rol": rol}, expires_delta=timedelta(minutes=20))
    return {"requiere_codigo": True, "desafio": desafio, "correo": _mascara(correo), "vigencia_min": 10,
            **({"ya_enviado": True} if reciente else {})}


def validar_codigo(desafio, codigo, password_hash):
    """Devuelve (clave, id, rol) si el código es correcto; si no, lanza HTTPException."""
    p = decode_token(str(desafio or ""))
    if not p or p.get("typ") != "chal":
        raise HTTPException(status_code=401, detail="El código venció. Vuelve a iniciar sesión.")
    clave = p["k"]
    codigo = "".join(c for c in str(codigo or "") if c.isdigit())
    ventana = int(time.time() // VENTANA_SEG)
    with _lock:
        n = _intentos.get((clave, ventana), 0)
        if n >= MAX_INTENTOS:
            raise HTTPException(status_code=429, detail="Demasiados intentos. Espera unos minutos e inicia sesión de nuevo.")
    ok = any(hmac.compare_digest(codigo, _codigo(clave, password_hash, v)) for v in (ventana, ventana - 1))
    if not ok:
        with _lock:
            _intentos[(clave, ventana)] = _intentos.get((clave, ventana), 0) + 1
            for k in [k for k in _intentos if k[1] < ventana - 1]:
                _intentos.pop(k, None)
        raise HTTPException(status_code=401, detail="Código incorrecto")
    return clave, p["id"], p["rol"]
