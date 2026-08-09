"""
dependencies.py - Dependencias reutilizables de FastAPI.

Aquí vive la lógica de autenticación/autorización que se inyecta
en los endpoints con Depends(). Esto evita repetir código en cada ruta.
"""
from fastapi import HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth import decode_token
from typing import List

security = HTTPBearer()


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
