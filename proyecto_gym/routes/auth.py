"""
routes/auth.py - Endpoints de autenticación
"""
from fastapi import APIRouter, HTTPException, status, Depends, Body
from database import get_db
from schemas import LoginRequest, TokenResponse
from auth import verify_password, create_access_token, hash_password
from dependencies import require_rol

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    """
    Autentica a un usuario del sistema (admin o recepcionista).
    Retorna un JWT que el frontend debe guardar y enviar en cada request.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT u.id_usuario, u.username, u.password_hash, r.nombre_rol
            FROM usuarios_sistema u
            JOIN roles_permisos r ON u.id_rol = r.id_rol
            WHERE u.username = %s
            """,
            (data.username,)
        )
        user = cur.fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos"
        )

    id_usuario, username, password_hash, nombre_rol = user

    # IMPORTANTE: El dato inicial en tu SQL tiene contraseña en texto plano ('12345').
    # Este bloque de compatibilidad maneja la migración transparente:
    # la primera vez que el usuario inicia sesión con texto plano, lo hasheamos.
    is_valid = False
    if password_hash.startswith("$2b$") or password_hash.startswith("$2a$"):
        # Ya está hasheado con bcrypt
        is_valid = verify_password(data.password, password_hash)
    else:
        # Contraseña en texto plano (dato inicial) — comparar y migrar
        if data.password == password_hash:
            is_valid = True
            # Migrar a bcrypt automáticamente
            new_hash = hash_password(data.password)
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE usuarios_sistema SET password_hash = %s WHERE id_usuario = %s",
                    (new_hash, id_usuario)
                )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos"
        )

    token = create_access_token({
        "sub": str(id_usuario),
        "username": username,
        "rol": nombre_rol
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            "id_usuario": id_usuario,
            "username": username,
            "rol": nombre_rol
        }
    }


ROLES_VALIDOS = {
    "admin": "Administrador",
    "administrador": "Administrador",
    "recepcionista": "Recepcionista",
}


@router.get("/usuarios")
def listar_usuarios(usuario=Depends(require_rol(["Administrador"]))):
    """Lista todas las cuentas del sistema (solo Administrador)."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT u.id_usuario, u.username, r.nombre_rol
            FROM usuarios_sistema u
            JOIN roles_permisos r ON u.id_rol = r.id_rol
            ORDER BY u.id_usuario
            """
        )
        rows = cur.fetchall()

    return [
        {"id_usuario": r[0], "username": r[1], "rol": r[2]}
        for r in rows
    ]


@router.post("/usuarios", status_code=status.HTTP_201_CREATED)
def crear_usuario(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Crea una nueva cuenta de usuario del sistema (recepción/administración).
    Solo Administrador. Recibe: { username, password, rol }
    """
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    rol_solicitado = (data.get("rol") or "recepcionista").strip().lower()

    if len(username) < 3:
        raise HTTPException(status_code=422, detail="El nombre de usuario debe tener al menos 3 caracteres")
    if len(password) < 4:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 4 caracteres")

    nombre_rol = ROLES_VALIDOS.get(rol_solicitado)
    if not nombre_rol:
        raise HTTPException(status_code=422, detail=f"Rol inválido: {rol_solicitado}")

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT id_usuario FROM usuarios_sistema WHERE username = %s", (username,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail=f"Ya existe un usuario con el nombre '{username}'")

        cur.execute("SELECT id_rol FROM roles_permisos WHERE nombre_rol = %s", (nombre_rol,))
        rol_row = cur.fetchone()
        if not rol_row:
            raise HTTPException(status_code=500, detail=f"El rol '{nombre_rol}' no existe en roles_permisos")
        id_rol = rol_row[0]

        password_hash = hash_password(password)
        cur.execute(
            """
            INSERT INTO usuarios_sistema (username, password_hash, id_rol)
            VALUES (%s, %s, %s)
            RETURNING id_usuario
            """,
            (username, password_hash, id_rol)
        )
        id_usuario = cur.fetchone()[0]

    return {
        "id_usuario": id_usuario,
        "username": username,
        "rol": nombre_rol,
        "mensaje": "Usuario creado exitosamente"
    }
