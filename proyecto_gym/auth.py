"""
auth.py - Utilidades de autenticación con JWT y bcrypt
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

_SECRET_KEY_FALLBACK = "fallback-dev-key-change-in-production"
SECRET_KEY = os.getenv("SECRET_KEY", _SECRET_KEY_FALLBACK)
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

if SECRET_KEY == _SECRET_KEY_FALLBACK:
    # Auditoría de seguridad 2026-09-25: si SECRET_KEY no está en el .env,
    # todos los JWT (login de Recepción y del Portal) se firman con este
    # valor público y conocido — cualquiera podría fabricar un token
    # válido de "Administrador" a mano. No se hace fallar el arranque
    # (para no romper nada si esto corre en un lugar inesperado), pero se
    # avisa fuerte porque es el hallazgo más serio de la auditoría.
    print("\n" + "!" * 70)
    print("¡ADVERTENCIA DE SEGURIDAD! SECRET_KEY no está configurada en .env.")
    print("Se está usando una clave de repaso PÚBLICA para firmar los tokens")
    print("de sesión — cualquiera que la conozca puede falsificar un login")
    print("de Administrador. Agrega una línea SECRET_KEY=<algo largo y random>")
    print("a tu archivo .env (y a las variables de entorno en Render) antes")
    print("de seguir usando el sistema en producción.")
    print("!" * 70 + "\n")

# bcrypt para hashear contraseñas. bcrypt es el estándar de la industria:
# es deliberadamente lento para resistir ataques de fuerza bruta.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hashea una contraseña usando bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña contra su hash bcrypt."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un JWT con los datos del usuario y un tiempo de expiración."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decodifica y valida un JWT. Retorna None si es inválido."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
