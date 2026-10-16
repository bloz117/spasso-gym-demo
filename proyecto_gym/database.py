import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
import os
import time
import threading
from dotenv import load_dotenv

load_dotenv()

# El pool se inicializa en None — se crea en la primera llamada a get_db()
_connection_pool = None

# Máximo de conexiones simultáneas a PostgreSQL (DB_POOL_MAX en .env).
# Si llegan más peticiones a la vez, esperan su turno en vez de fallar con
# "connection pool exhausted" (importante con muchos socios conectados).
_POOL_MAX = int(os.getenv("DB_POOL_MAX", "20"))
_slots = threading.BoundedSemaphore(_POOL_MAX)

# Si una conexión estuvo inactiva más de esto, se verifica con un SELECT 1 antes
# de usarla (las bases en la nube, ej. Neon, cierran conexiones al "dormirse").
_REVALIDAR_TRAS = float(os.getenv("DB_REVALIDAR_SEG", "20"))

# Función opcional que se ejecuta después de cada commit exitoso con la misma
# conexión (la usa main_cloud.py para detectar cambios que Recepción debe traer).
POST_COMMIT = None


class _Conexion(psycopg2.extensions.connection):
    """Conexión con atributos propios (_ultimo_uso) — psycopg2 no permite ponerlos
    en la clase base."""
    _ultimo_uso = 0.0


def _parametros_conexion():
    """Parámetros de conexión. Acepta DATABASE_URL (Neon/Render/Supabase) o las
    variables sueltas DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD (+ DB_SSLMODE)."""
    extra = {
        "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "15")),
        # TCP keepalive: detecta pronto una conexión que la nube cerró
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 3,
    }
    zona = os.getenv("APP_TIMEZONE")
    if zona:
        # Hora del gimnasio: CURRENT_DATE / now() / timestamps sin zona coinciden con Recepción
        extra["options"] = f"-c timezone={zona}"
    url = os.getenv("DATABASE_URL")
    if url:
        return {"dsn": url, **extra}
    params = dict(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "spasso_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    ssl = os.getenv("DB_SSLMODE")
    if ssl:
        params["sslmode"] = ssl
    if str(params["host"]).startswith("/"):
        # socket Unix (pruebas): sin keepalives TCP
        for k in ("keepalives", "keepalives_idle", "keepalives_interval", "keepalives_count"):
            extra.pop(k, None)
    return {**params, **extra}


def get_pool():
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=_POOL_MAX,
            connection_factory=_Conexion,
            **_parametros_conexion(),
        )
    return _connection_pool


def _obtener_conexion_valida():
    """getconn() descartando conexiones muertas (nube que se durmió, reinicios)."""
    p = get_pool()
    ultimo_error = None
    for _ in range(4):
        conn = p.getconn()
        try:
            if conn.closed:
                raise psycopg2.OperationalError("conexión cerrada")
            inactiva = time.time() - getattr(conn, "_ultimo_uso", 0)
            if inactiva > _REVALIDAR_TRAS:
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.close()
                conn.rollback()
            return conn
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            ultimo_error = e
            try:
                p.putconn(conn, close=True)
            except Exception:
                pass
    raise ultimo_error or RuntimeError("No se pudo obtener una conexión a la base de datos")


@contextmanager
def get_db():
    # Espera hasta 20 s por una conexión libre (cola ordenada de peticiones).
    if not _slots.acquire(timeout=20):
        raise RuntimeError("Base de datos ocupada, intenta de nuevo en unos segundos")
    try:
        conn = _obtener_conexion_valida()
        try:
            yield conn
            conn.commit()
            if POST_COMMIT is not None:
                try:
                    POST_COMMIT(conn)
                    conn.commit()
                except Exception:
                    conn.rollback()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn._ultimo_uso = time.time()
            try:
                get_pool().putconn(conn)
            except Exception:
                pass
    finally:
        _slots.release()
