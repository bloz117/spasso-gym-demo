"""
dependencies.py - Dependencias reutilizables de FastAPI.

Aquí vive la lógica de autenticación/autorización que se inyecta
en los endpoints con Depends(). Esto evita repetir código en cada ruta.
"""
from fastapi import HTTPException, status, Security, Request, Depends
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


def require_rol(roles_permitidos: List[str]):
    """
    Fábrica de dependencias: crea un validador que acepta solo ciertos roles.
    
    Uso en un endpoint:
        @router.get("/ruta")
        def mi_endpoint(usuario=Depends(require_rol(["Administrador"]))):
    """
    def _verificar(credentials: HTTPAuthorizationCredentials = Security(security)):
        token = credentials.credentials
        payload = decode_token(token)

        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
                headers={"WWW-Authenticate": "Bearer"},
            )

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
    def _verificar(credentials: HTTPAuthorizationCredentials = Security(security)):
        token = credentials.credentials
        payload = decode_token(token)

        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
                headers={"WWW-Authenticate": "Bearer"},
            )

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
