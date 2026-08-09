"""
routes/portal_auth.py - Endpoints de autenticación del Portal Público (Socio)

El Portal Público permite que los socios accedan a su dashboard personal
con credenciales diferentes del sistema de recepción.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from database import get_db
from schemas import PortalLoginRequest, PortalChangePasswordRequest, TokenResponse
from auth import verify_password, create_access_token, hash_password, decode_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

router = APIRouter(prefix="/api/portal", tags=["Portal Autenticación"])
security = HTTPBearer()


def get_current_socio(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Valida el JWT del socio y extrae su información.
    Usado en endpoints protegidos del portal.
    """
    token = credentials.credentials
    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verificar que sea un token de socio (id_socio en el payload)
    if "id_socio" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no válido para portal de socio"
        )

    return payload


@router.post("/login", response_model=TokenResponse)
def portal_login(data: PortalLoginRequest):
    """
    Autentica a un socio con email y contraseña.
    Retorna un JWT para acceso al dashboard personal.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT pa.id_socio, pa.password_hash, s.nombres, s.apellidos, s.email
            FROM portal_accounts pa
            JOIN socios s ON pa.id_socio = s.id_socio
            WHERE s.email = %s
            """,
            (data.email,)
        )
        account = cur.fetchone()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )

    id_socio, password_hash, nombres, apellidos, email = account

    # Verificar contraseña
    is_valid = False
    if password_hash.startswith("$2b$") or password_hash.startswith("$2a$"):
        # Ya está hasheado con bcrypt
        is_valid = verify_password(data.password, password_hash)
    else:
        # Contraseña en texto plano (migración)
        if data.password == password_hash:
            is_valid = True
            # Migrar a bcrypt automáticamente
            new_hash = hash_password(data.password)
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE portal_accounts SET password_hash = %s WHERE id_socio = %s",
                    (new_hash, id_socio)
                )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )

    # Crear token JWT para el socio
    token = create_access_token({
        "sub": str(id_socio),
        "id_socio": id_socio,
        "email": email,
        "nombres": nombres,
        "rol": "Cliente"
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            "id_socio": id_socio,
            "nombres": nombres,
            "apellidos": apellidos,
            "email": email,
            "rol": "Cliente"
        }
    }


@router.post("/change-password")
def cambiar_contrasena(
    data: PortalChangePasswordRequest,
    socio=Depends(get_current_socio)
):
    """
    Permite que el socio cambie su contraseña del portal.
    Requiere proporcionar la contraseña actual para verificación.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT password_hash FROM portal_accounts WHERE id_socio = %s",
            (id_socio,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Cuenta del portal no encontrada")

    password_hash = row[0]

    # Verificar contraseña actual
    if not verify_password(data.password_actual, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta"
        )

    # Hashear nueva contraseña
    new_hash = hash_password(data.password_nuevo)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE portal_accounts SET password_hash = %s, must_change_password = FALSE WHERE id_socio = %s",
            (new_hash, id_socio)
        )

    return {
        "mensaje": "Contraseña actualizada exitosamente",
        "id_socio": id_socio
    }


@router.post("/force-change-password")
def forzar_cambio_contrasena(
    data: PortalChangePasswordRequest,
    socio=Depends(get_current_socio)
):
    """
    Fuerza el cambio de contraseña si el socio tiene el flag must_change_password = TRUE.
    Esta ruta es llamada automáticamente en el primer login si se requiere cambio.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT must_change_password FROM portal_accounts WHERE id_socio = %s",
            (id_socio,)
        )
        row = cur.fetchone()

    if not row or not row[0]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No es necesario cambiar la contraseña en este momento"
        )

    # Hashear nueva contraseña
    new_hash = hash_password(data.password_nuevo)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE portal_accounts SET password_hash = %s, must_change_password = FALSE WHERE id_socio = %s",
            (new_hash, id_socio)
        )

    return {
        "mensaje": "Contraseña actualizada exitosamente",
        "id_socio": id_socio,
        "debe_cambiar": False
    }


@router.get("/me")
def obtener_perfil_socio(socio=Depends(get_current_socio)):
    """
    Retorna la información del socio actualmente autenticado.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id_socio, s.nombres, s.apellidos, s.email, s.dni, s.fecha_registro,
                   (SELECT COUNT(*) FROM asistencias_log WHERE id_socio = s.id_socio) as total_visitas,
                   (SELECT MAX(fecha_entrada) FROM asistencias_log WHERE id_socio = s.id_socio) as ultima_visita
            FROM socios s
            WHERE s.id_socio = %s
            """,
            (id_socio,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    return {
        "id_socio": row[0],
        "nombres": row[1],
        "apellidos": row[2],
        "email": row[3],
        "dni": row[4],
        "fecha_registro": row[5].isoformat() if row[5] else None,
        "total_visitas": row[6] or 0,
        "ultima_visita": row[7].isoformat() if row[7] else None
    }
