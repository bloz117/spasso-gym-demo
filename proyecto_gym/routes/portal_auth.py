"""
routes/portal_auth.py - Endpoints de autenticación del Portal Público (Socio)

El Portal Público permite que los socios accedan a su dashboard personal
con credenciales diferentes del sistema de recepción.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from database import get_db
from schemas import PortalLoginRequest, PortalChangePasswordRequest, TokenResponse
from auth import verify_password, create_access_token, hash_password, decode_token
from dependencies import require_rol, limitar_intentos_login
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import secrets
import threading
import time

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


# ── Límite de intentos fallidos POR CUENTA (además del límite por IP) ─────────
# Detrás de un proxy (nube) la IP puede ser falsificable; el límite por cuenta
# frena la adivinación de contraseñas aunque el atacante cambie de IP.
_fallos_cuenta = {}
_fallos_cuenta_lock = threading.Lock()
_MAX_FALLOS_CUENTA = 8
_VENTANA_FALLOS_CUENTA = 600  # 10 minutos


def _cuenta_bloqueada(clave: str) -> bool:
    ahora = time.time()
    with _fallos_cuenta_lock:
        lista = [t for t in _fallos_cuenta.get(clave, []) if ahora - t < _VENTANA_FALLOS_CUENTA]
        _fallos_cuenta[clave] = lista
        return len(lista) >= _MAX_FALLOS_CUENTA


def _anotar_fallo_cuenta(clave: str):
    with _fallos_cuenta_lock:
        if len(_fallos_cuenta) > 20000:
            _fallos_cuenta.clear()
        _fallos_cuenta.setdefault(clave, []).append(time.time())


def _limpiar_fallos_cuenta(clave: str):
    with _fallos_cuenta_lock:
        _fallos_cuenta.pop(clave, None)


def _login_entrenador(usuario: str, password: str):
    """Devuelve la respuesta de login si usuario/contraseña son de un
    Entrenador; None si no corresponde (para seguir con el error normal)."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT u.id_usuario, u.username, u.password_hash
            FROM usuarios_sistema u
            JOIN roles_permisos r ON u.id_rol = r.id_rol
            WHERE (lower(u.username) = %s OR lower(u.correo) = %s)
              AND r.nombre_rol = 'Entrenador'
            """,
            ((usuario or "").strip().lower(), (usuario or "").strip().lower())
        )
        fila = cur.fetchone()
    if not fila:
        return None
    id_usuario, username, password_hash = fila
    if not (password_hash.startswith("$2b$") or password_hash.startswith("$2a$")):
        return None
    if not verify_password(password, password_hash):
        return None
    token = create_access_token({
        "sub": str(id_usuario),
        "username": username,
        "rol": "Entrenador",
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {"id_usuario": id_usuario, "username": username, "rol": "Entrenador"}
    }


@router.post("/login", response_model=TokenResponse)
def portal_login(data: PortalLoginRequest, _=Depends(limitar_intentos_login(max_intentos=60, ventana_segundos=60))):
    """
    Autentica a un socio con su correo O su usuario del portal (sin
    importar mayúsculas/espacios) y contraseña.
    Retorna un JWT para acceso al dashboard personal.
    """
    identificador = (data.email or "").strip().lower()[:150]
    if _cuenta_bloqueada(identificador):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos con esta cuenta. Espera unos minutos e intenta de nuevo."
        )
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT pa.id_socio, pa.password_hash, s.nombres, s.apellidos, s.email, pa.is_active,
                   COALESCE(s.activo, TRUE)
            FROM portal_accounts pa
            JOIN socios s ON pa.id_socio = s.id_socio
            WHERE lower(trim(s.email)) = %s OR lower(pa.username) = %s
            ORDER BY (lower(trim(s.email)) = %s) DESC
            LIMIT 1
            """,
            (identificador, identificador, identificador)
        )
        account = cur.fetchone()

    if not account:
        # ¿Es una cuenta de Entrenador? (se identifican con su usuario en el
        # mismo campo del formulario; no entran a Recepción, solo al portal).
        entrenador = _login_entrenador(data.email, data.password)
        if entrenador:
            _limpiar_fallos_cuenta(identificador)
            return entrenador
        _anotar_fallo_cuenta(identificador)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo/usuario o contraseña incorrectos"
        )

    id_socio, password_hash, nombres, apellidos, email, is_active, socio_activo = account

    if not socio_activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta ya no está habilitada. Contacta a recepción."
        )

    if not is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta está desactivada. Contacta a recepción."
        )

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
        _anotar_fallo_cuenta(identificador)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo/usuario o contraseña incorrectos"
        )
    _limpiar_fallos_cuenta(identificador)

    # Último ingreso (se muestra en Configuración > Página Web > Usuarios del Portal)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE portal_accounts SET last_login = NOW() WHERE id_socio = %s", (id_socio,))

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
    La sesión ya identifica al socio, así que no se pide la contraseña actual.
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

    # Hashear nueva contraseña
    new_hash = hash_password(data.password_nuevo)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE portal_accounts SET password_hash = %s, must_change_password = FALSE, temp_password = NULL WHERE id_socio = %s",
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
            "UPDATE portal_accounts SET password_hash = %s, must_change_password = FALSE, temp_password = NULL WHERE id_socio = %s",
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
                   (SELECT MAX(fecha_entrada) FROM asistencias_log WHERE id_socio = s.id_socio) as ultima_visita,
                   s.genero
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
        "ultima_visita": row[7].isoformat() if row[7] else None,
        "genero": row[8]
    }


# ==================== ADMINISTRACIÓN DE CUENTAS (RECEPCIÓN) ====================
# Endpoints para que el Administrador vea y gestione las cuentas del portal
# público desde la sección "Página Web" de Configuración en recepción.

@router.get("/accounts")
def listar_cuentas_portal(usuario=Depends(require_rol(["Administrador"]))):
    """
    Lista todas las cuentas del portal público, con datos del socio dueño.
    Si la cuenta todavía no cambió su contraseña temporal (must_change_password
    = TRUE), se incluye esa contraseña en texto plano para que recepción se la
    pueda entregar. Una vez que el socio la cambia, ya no se puede ver.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT pa.id_socio, s.nombres, s.apellidos, s.email, pa.username,
                   pa.temp_password, pa.must_change_password, pa.is_active,
                   pa.created_at, pa.last_login, s.dni, s.telefono,
                   COALESCE(s.activo, TRUE)
            FROM portal_accounts pa
            JOIN socios s ON pa.id_socio = s.id_socio
            ORDER BY COALESCE(s.activo, TRUE) DESC, pa.created_at DESC
            """
        )
        rows = cur.fetchall()

    cuentas = []
    for row in rows:
        (id_socio, nombres, apellidos, email, username, temp_password,
         must_change_password, is_active, created_at, last_login,
         dni, telefono, socio_activo) = row
        cuentas.append({
            "id_socio": id_socio,
            "nombre_completo": f"{nombres} {apellidos}".strip(),
            "email": email,
            "username": username,
            "temp_password": temp_password if must_change_password else None,
            "must_change_password": must_change_password,
            "is_active": is_active,
            "created_at": created_at.isoformat() if created_at else None,
            "last_login": last_login.isoformat() if last_login else None,
            "dni": dni,
            "telefono": telefono,
            "socio_activo": bool(socio_activo),
        })

    return {"total": len(cuentas), "cuentas": cuentas}


@router.post("/accounts/{id_socio}/reset-password")
def restablecer_contrasena_socio(
    id_socio: int,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Genera una nueva contraseña temporal para la cuenta de portal del socio.
    Útil si el socio la olvidó o si recepción necesita volver a entregarla.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_socio FROM portal_accounts WHERE id_socio = %s", (id_socio,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Este socio no tiene cuenta de portal")

        nueva_password = secrets.token_urlsafe(12)
        nuevo_hash = hash_password(nueva_password)

        cur.execute(
            """
            UPDATE portal_accounts
            SET password_hash = %s, temp_password = %s, must_change_password = TRUE
            WHERE id_socio = %s
            """,
            (nuevo_hash, nueva_password, id_socio)
        )

    return {
        "mensaje": "Contraseña restablecida",
        "id_socio": id_socio,
        "temp_password": nueva_password
    }


@router.post("/accounts/{id_socio}/toggle-active")
def alternar_estado_cuenta(
    id_socio: int,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Activa o desactiva la cuenta de portal del socio (bloquea/permite su login).
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT is_active FROM portal_accounts WHERE id_socio = %s", (id_socio,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Este socio no tiene cuenta de portal")

        nuevo_estado = not row[0]
        cur.execute(
            "UPDATE portal_accounts SET is_active = %s WHERE id_socio = %s",
            (nuevo_estado, id_socio)
        )

    return {"id_socio": id_socio, "is_active": nuevo_estado}
