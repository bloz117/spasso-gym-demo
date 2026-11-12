"""
enlace_token.py - Enlace único (comprobante + acceso) sin estado.

Recepción arma un token cifrado y firmado (Fernet, clave derivada de SYNC_SECRET) con los datos del comprobante y
del acceso. La nube (Render) lo abre con el mismo secreto: no necesita guardar nada, y la contraseña temporal
(que nunca se sincroniza) viaja solo dentro del token cifrado. El token vale TOKEN_DIAS días.
"""
import base64
import hashlib
import json
import os
import time
import zlib

TOKEN_DIAS = 30


def _fernet():
    from cryptography.fernet import Fernet
    sec = (os.getenv("SYNC_SECRET") or "").strip()
    if len(sec) < 32:
        raise RuntimeError("Falta SYNC_SECRET (nube.env) para generar el enlace")
    clave = base64.urlsafe_b64encode(hashlib.sha256(("enlace-v1|" + sec).encode("utf-8")).digest())
    return Fernet(clave)


def crear_token(datos: dict) -> str:
    d = dict(datos)
    d["iat"] = int(time.time())
    crudo = zlib.compress(json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9)
    return _fernet().encrypt(crudo).decode("ascii").rstrip("=")


def abrir_token(token: str):
    """Devuelve (datos, edad_en_dias) o None si el token es inválido/alterado."""
    try:
        t = (token or "").strip()
        t += "=" * (-len(t) % 4)
        crudo = _fernet().decrypt(t.encode("ascii"))
        d = json.loads(zlib.decompress(crudo).decode("utf-8"))
        edad = (time.time() - int(d.get("iat", 0))) / 86400.0
        return d, edad
    except Exception:
        return None
