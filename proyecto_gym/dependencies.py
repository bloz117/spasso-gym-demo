"""
dependencies.py - Dependencias reutilizables de FastAPI.

Aquí vive la lógica de autenticación/autorización que se inyecta
en los endpoints con Depends(). Esto evita repetir código en cada ruta.
"""
from fastapi import HTTPException, status, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth import decode_token
from typing import List
import time
import threading
from collections import defaultdict

security = HTTPBearer()


# ─────────────────────────────────────────────────────────────────
# Rate limiting simple en memoria para endpoints de login (auditoría de
# seguridad 2026-09-25: no había ninguna protección contra fuerza bruta
# en /api/auth/login ni /api/portal/login). No usa Redis ni agrega una
# dependencia nueva — vive en memoria del proceso, así que se reinicia
# si el servidor reinicia; es suficiente para frenar intentos
# automatizados repetidos desde una misma IP, que es el riesgo real acá.
_intentos_login = defaultdict(list)
_intentos_login_lock = threading.Lock()


def limitar_intentos_login(max_intentos: int = 8, ventana_segundos: int = 60):
    """
    Fábrica de dependencia: bloquea con 429 si una misma IP hace más de
    `max_intentos` peticiones a un endpoint de login en `ventana_segundos`.

    Uso:
        @router.post("/login")
        def login(data: LoginRequest, _=Depends(limitar_intentos_login())):
    """
    def _verificar(request: Request):
        ip = request.client.host if request.client else "desconocida"
        ahora = time.time()
        with _intentos_login_lock:
            intentos = _intentos_login[ip]
            intentos[:] = [t for t in intentos if ahora - t < ventana_segundos]
            if len(intentos) >= max_intentos:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Demasiados intentos de inicio de sesión. Espera un minuto e intenta de nuevo."
                )
            intentos.append(ahora)

    return _verificar


# ─────────────────────────────────────────────────────────────────
# Administrador remoto (acceso desde celular/tablet/otra PC por internet).
# Es un rol APARTE ("Administrador remoto"). Cada petición suya se compara con
# esta lista blanca (todo lo que no esté aquí queda prohibido, aunque conozca
# la dirección): solo ve reportes/estadísticas y edita inventario, planes,
# página web y configuración. Registro, asistencia, caja, huella, lockers,
# cobros y cuentas de usuario siguen siendo exclusivos de Recepción.
ROL_REMOTO = "Administrador remoto"

# Solo lectura (GET)
_REMOTO_LEE = (
    "stats", "ventas", "productos", "planes", "gym", "cms", "reportes-cuenta",
    "socios", "lockers", "asistencias", "bitacora", "bienvenida", "caja",
)
# Lectura y escritura
_REMOTO_ESCRIBE = ("productos", "planes", "gym", "cms")
# Escrituras puntuales (prefijo exacto)
_REMOTO_ESCRIBE_PUNTUAL = (
    "bienvenida/config", "bienvenida/prueba",
    "bitacora/acceso", "bitacora/eventos", "bitacora/cierre-sesion",
)
# Nunca, ni siquiera para leer
_REMOTO_NUNCA = ("auth/usuarios", "biometria", "portal", "sync", "cobros", "pantalla")

def es_acceso_remoto(request: Request) -> bool:
    """True si se entró por la dirección de red (IP del PC, dominio, internet) en vez de
    desde la propia Recepción (localhost / 127.0.0.1). Por ahí solo debe entrar el
    'Administrador remoto'."""
    host = (request.headers.get("host") or "").strip().lower()
    host = host.rsplit(":", 1)[0] if not host.startswith("[") else host.split("]")[0] + "]"
    return host not in ("localhost", "127.0.0.1", "[::1]", "")


MSG_SOLO_REMOTO = ("Por acceso remoto solo puede entrar la cuenta de Administrador remoto. "
                   "Para usar tu cuenta de Recepción abre el sistema desde la computadora de Recepción.")

_ultima_actividad_remota = {}  # username -> {"ts": float, "ip": str}


def ruta_remota_permitida(ruta: str, metodo: str) -> bool:
    r = (ruta or "").split("?")[0]
    if r.startswith("/api/"):
        r = r[5:]
    r = r.strip("/")
    # Solo lectura de la lista de usuarios del portal (sin contraseñas, ver portal_auth)
    if r == "portal/accounts" and metodo in ("GET", "HEAD"):
        return True
    if any(r == n or r.startswith(n + "/") for n in _REMOTO_NUNCA):
        return False
    primero = r.split("/")[0]
    if metodo in ("GET", "HEAD"):
        return primero in _REMOTO_LEE
    if primero in _REMOTO_ESCRIBE:
        return True
    return any(r == w or r.startswith(w) for w in _REMOTO_ESCRIBE_PUNTUAL)


def _normalizar_remoto(payload: dict, request: Request) -> dict:
    """Si el token es de Administrador remoto: verifica la lista blanca y lo trata
    como Administrador SOLO dentro de esas rutas. Devuelve el payload ajustado."""
    if not payload or payload.get("rol") != ROL_REMOTO:
        return payload
    if not ruta_remota_permitida(request.url.path, request.method):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acción solo se puede hacer desde Recepción."
        )
    _ultima_actividad_remota[payload.get("username")] = {
        "ts": time.time(),
        "ip": (request.client.host if request.client else ""),
    }
    ajustado = dict(payload)
    ajustado["rol"] = "Administrador"
    ajustado["rol_real"] = ROL_REMOTO
    ajustado["remoto"] = True
    return ajustado


def require_rol(roles_permitidos: List[str]):
    """
    Fábrica de dependencias: crea un validador que acepta solo ciertos roles.
    
    Uso en un endpoint:
        @router.get("/ruta")
        def mi_endpoint(usuario=Depends(require_rol(["Administrador"]))):
    """
    def _verificar(request: Request, credentials: HTTPAuthorizationCredentials = Security(security)):
        token = credentials.credentials
        payload = decode_token(token)

        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = _normalizar_remoto(payload, request)
        rol_usuario = payload.get("rol")
        if rol_usuario not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere uno de los roles: {roles_permitidos}"
            )

        return payload

    return _verificar


def require_permiso(permisos_aceptados: List[str]):
    """
    Fábrica de dependencias para permisos granulares de Recepcionista.

    Administrador SIEMPRE pasa (acceso total, nunca se restringe por
    permisos). Recepcionista solo pasa si su cuenta tiene marcado AL MENOS
    UNO de los permisos de `permisos_aceptados` (el JWT trae la lista de
    permisos de esa cuenta, ver auth.py::login). Cualquier otro rol queda
    rechazado.

    Uso en un endpoint:
        @router.get("/ruta")
        def mi_endpoint(usuario=Depends(require_permiso(["registro", "renovaciones"]))):
    """
    def _verificar(request: Request, credentials: HTTPAuthorizationCredentials = Security(security)):
        token = credentials.credentials
        payload = decode_token(token)

        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = _normalizar_remoto(payload, request)
        rol_usuario = payload.get("rol")
        if rol_usuario == "Administrador":
            return payload

        if rol_usuario != "Recepcionista":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso denegado."
            )

        permisos_usuario = payload.get("permisos") or []
        if not any(p in permisos_usuario for p in permisos_aceptados):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Esta cuenta no tiene permiso para esta acción "
                    f"(requiere alguno de: {permisos_aceptados})"
                )
            )

        return payload

    return _verificar
