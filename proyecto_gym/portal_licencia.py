"""
portal_licencia.py — Licencia del PORTAL público (nube). Sin base de datos, sin tocar datos.

Cómo funciona
  * Si NO está definida la variable PORTAL_LICENCIA_CLAVE, no se exige nada (el portal funciona libre).
  * Si está definida (clave GYM-... con el módulo "portal"), un hilo consulta cada ~20 s a la Llave Maestra
    (POST {LLAVE_URL}/api/v1/portal) y verifica la firma Ed25519 del "sello" con la clave pública.
  * Estados que bloquean el portal: suspendida, revocada, vencida, sin_modulo (la licencia no incluye el portal).
  * Si la Llave Maestra no responde, se conserva el último estado conocido (una caída del proveedor NUNCA
    apaga a un gimnasio al día). Un sello más viejo que el último visto se ignora (anti-repetición).
  * Bloquear solo oculta el portal con una página de aviso: NINGÚN dato se borra y la sincronización con
    Recepción sigue funcionando para no perder nada.
Variables: PORTAL_LICENCIA_CLAVE, LLAVE_URL, LLAVE_PUBLICA_B64 (opcional; si falta se usa licencia_publica.b64),
           PORTAL_LICENCIA_SEG (intervalo, por defecto 20).
"""
import base64
import json
import os
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
BLOQUEAN = ("suspendida", "revocada", "vencida", "sin_modulo")
_lock = threading.Lock()
_est = {"estado": "desconocido", "hora": "", "cliente": "", "vence": "", "ultimo_ok": 0.0, "ultimo_intento": 0.0, "error": ""}
_hilo = {"t": None}


def _clave():
    return (os.getenv("PORTAL_LICENCIA_CLAVE") or "").strip().upper()


def exigida():
    return bool(_clave())


def _publica():
    env = (os.getenv("LLAVE_PUBLICA_B64") or "").strip()
    if env:
        return env
    try:
        return open(os.path.join(AQUI, "licencia_publica.b64")).read().strip()
    except OSError:
        return ""


def _unb64(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verificar_sello(sello, publica=None):
    """Payload si la firma es válida; None si no."""
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        p, s = (sello or "").strip().split(".")
        datos, firma = _unb64(p), _unb64(s)
        Ed25519PublicKey.from_public_bytes(base64.b64decode(publica or _publica())).verify(firma, datos)
        return json.loads(datos)
    except Exception:
        return None


def _parse(h):
    return datetime.fromisoformat(str(h).replace("Z", "+00:00")).astimezone(timezone.utc)


def aplicar_respuesta(resp, publica=None):
    """Valida y aplica la respuesta del servidor. Devuelve True si se aceptó. Pura: fácil de probar."""
    p = verificar_sello((resp or {}).get("sello", ""), publica)
    if not p or p.get("modulo") != "portal":
        return False
    try:
        hora = _parse(p["hora"])
    except Exception:
        return False
    with _lock:
        if _est["hora"] and hora < _parse(_est["hora"]):
            return False                      # sello repetido de un momento anterior: se ignora
        _est.update(estado=p.get("estado", "desconocido"), hora=p["hora"], cliente=p.get("cliente", ""),
                    vence=p.get("vence", ""), ultimo_ok=time.time(), error="")
    return True


def consultar_una_vez(timeout=8):
    base = (os.getenv("LLAVE_URL") or "").rstrip("/")
    if not base or not exigida():
        return False
    with _lock:
        _est["ultimo_intento"] = time.time()
    try:
        req = urllib.request.Request(base + "/api/v1/portal", json.dumps({"clave": _clave()}).encode(),
                                     {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return aplicar_respuesta(json.loads(r.read()))
    except urllib.error.HTTPError as e:
        with _lock:
            _est["error"] = f"HTTP {e.code}"
    except Exception as e:
        with _lock:
            _est["error"] = type(e).__name__
    return False


def _bucle():
    seg = max(5, int(os.getenv("PORTAL_LICENCIA_SEG", "20")))
    while True:
        try:
            consultar_una_vez()
        except Exception:
            pass
        time.sleep(seg)


def iniciar():
    """Arranca el hilo de consulta (solo si se exige licencia). Idempotente."""
    if not exigida() or _hilo["t"]:
        return False
    t = threading.Thread(target=_bucle, name="portal-licencia", daemon=True)
    _hilo["t"] = t
    t.start()
    consultar_una_vez()
    return True


def estado():
    with _lock:
        return dict(_est)


def bloqueado():
    """True solo si la licencia está exigida y el último estado FIRMADO la bloquea."""
    if not exigida():
        return False
    with _lock:
        return _est["estado"] in BLOQUEAN


def _reiniciar_para_pruebas():
    with _lock:
        _est.update(estado="desconocido", hora="", cliente="", vence="", ultimo_ok=0.0, ultimo_intento=0.0, error="")


PAGINA_SUSPENDIDO = """<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Servicio no disponible</title>
<style>html,body{height:100%;margin:0;background:#0b0d12;color:#eef0f6;font:16px system-ui,Segoe UI,Arial,sans-serif}
.w{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.c{max-width:460px;text-align:center;background:#151922;border:1px solid #2b3245;border-radius:20px;padding:34px 28px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.i{font-size:48px;line-height:1}h1{margin:12px 0 8px;font-size:22px}p{margin:8px 0;color:#aab2c5;line-height:1.5}small{display:block;margin-top:18px;opacity:.55}</style></head>
<body><div class="w"><div class="c"><div class="i">&#9940;</div><h1>Servicio temporalmente no disponible</h1>
<p>El portal de este gimnasio está suspendido por el momento.</p>
<p>Si eres socio, comunícate con la recepción de tu gimnasio. Tus datos están seguros.</p>
<small>Código: PORTAL-LIC</small></div></div></body></html>"""
