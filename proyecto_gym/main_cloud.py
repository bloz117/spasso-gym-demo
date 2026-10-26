"""
main_cloud.py — Servidor de la NUBE (portal público).

Es un programa APARTE de main.py (Recepción). Solo expone lo que el portal necesita:
login de socios/entrenadores, datos del socio, rutinas, contenido de la página y los
endpoints de sincronización (firmados). NO incluye: recepción, ventas, huellas,
cuentas de personal ni nada administrativo.

Arranque (Render):  uvicorn main_cloud:app --host 0.0.0.0 --port $PORT
Variables obligatorias:
    DATABASE_URL   cadena de conexión de Postgres en la nube (ej. Neon, con sslmode=require)
    SECRET_KEY     clave para firmar sesiones (mínimo 32 caracteres, aleatoria)
    SYNC_SECRET    secreto compartido con Recepción (mínimo 32 caracteres)
Opcionales: CORS_ORIGINS, IA_API_URL/IA_API_KEY/IA_MODEL (generador de rutinas con IA),
            APP_TIMEZONE (por defecto America/La_Paz)
"""
import os
import re
import sys
import time

# La nube es el modo "cloud" y trabaja con la hora del gimnasio (no con UTC)
os.environ["APP_MODE"] = "cloud"
os.environ.setdefault("TZ", "America/La_Paz")
os.environ.setdefault("APP_TIMEZONE", os.environ["TZ"])
if hasattr(time, "tzset"):
    time.tzset()

from dotenv import load_dotenv

load_dotenv()


def _exigir_configuracion():
    """La nube NO arranca con claves débiles o ausentes (evita un portal inseguro)."""
    problemas = []
    sk = os.getenv("SECRET_KEY", "")
    if len(sk) < 32 or "fallback" in sk.lower() or "change" in sk.lower():
        problemas.append("SECRET_KEY debe tener al menos 32 caracteres aleatorios")
    if len(os.getenv("SYNC_SECRET", "")) < 32:
        problemas.append("SYNC_SECRET debe tener al menos 32 caracteres")
    if sk and sk == os.getenv("SYNC_SECRET", ""):
        problemas.append("SECRET_KEY y SYNC_SECRET deben ser distintos")
    if not os.getenv("DATABASE_URL") and not os.getenv("DB_HOST"):
        problemas.append("Falta DATABASE_URL (conexión a la base de datos de la nube)")
    if problemas:
        raise RuntimeError("Configuración de la nube incompleta/insegura:\n - " + "\n - ".join(problemas))


_exigir_configuracion()

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles

import database
import sync_core
from routes import sync as sync_routes
from routes.cms import router as cms_router
from routes.entrenador import router as entrenador_router
from routes.portal_auth import router as portal_auth_router
from routes.portal_client import router as portal_client_router
from routes.recuperacion import router_portal as recuperacion_portal_router

app = FastAPI(
    title="Spasso — Portal (nube)",
    docs_url=None, redoc_url=None, openapi_url=None,  # sin documentación pública
)

BASE = os.path.dirname(os.path.abspath(__file__))
PORTAL_DIR = os.path.abspath(os.path.join(BASE, "..", "PaginaGimnasio"))


# ── Arranque: esquema de la nube + sincronización ─────────────────────────
@app.on_event("startup")
def _preparar_nube():
    with database.get_db() as conn:
        cur = conn.cursor()
        with open(os.path.join(BASE, "cloud", "schema_cloud.sql"), encoding="utf-8") as f:
            cur.execute(f.read())
    with database.get_db() as conn:
        sync_core.asegurar_esquema_sync(conn, "cloud")
    with database.get_db() as conn:
        sync_routes.leer_seq(conn)
    database.POST_COMMIT = sync_routes.post_commit_nube
    print("✅ Nube lista (base de datos conectada, esquema verificado)", flush=True)


# ── CORS: por defecto cerrado (el portal se sirve desde este mismo origen) ──
_origenes = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if _origenes:
    app.add_middleware(
        CORSMiddleware, allow_origins=_origenes, allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"], allow_headers=["Authorization", "Content-Type"],
    )

# ── Lista blanca de rutas /api (todo lo demás: 404) ───────────────────────
_PERMITIDAS = [
    ("POST", r"^/api/portal/(login|change-password|force-change-password)$"),
    ("GET", r"^/api/portal/me(/[A-Za-z0-9_\-]+)*$"),
    ("PUT", r"^/api/portal/me/perfil-fisico$"),
    ("GET", r"^/api/entrenador/socios(/\d+/rutina)?$"),
    ("PUT", r"^/api/entrenador/socios/\d+/(rutina|genero)$"),
    ("POST", r"^/api/entrenador/ia/rutina$"),
    ("GET", r"^/api/cms/(active-theme|contenido|hero-imagenes|hero-fondo|musica)$"),
    ("GET", r"^/api/health$"),
    ("GET", r"^/api/sync/(ping|pull|digest|media/index)$"),
    ("POST", r"^/api/sync/push$"),
    ("PUT", r"^/api/sync/media/(img|music)/[^/]+$"),
]
_PERMITIDAS = [(m, re.compile(p)) for m, p in _PERMITIDAS]


@app.middleware("http")
async def _lista_blanca_y_cabeceras(request: Request, call_next):
    ruta = request.url.path
    if ruta.startswith("/api/") and request.method != "OPTIONS":
        if not any(request.method == m and p.match(ruta) for m, p in _PERMITIDAS):
            return JSONResponse({"detail": "No encontrado"}, status_code=404)
    response = await call_next(request)
    h = response.headers
    h["X-Content-Type-Options"] = "nosniff"
    h["X-Frame-Options"] = "DENY"
    h["Referrer-Policy"] = "strict-origin-when-cross-origin"
    h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if ruta.startswith("/api/"):
        h["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def _validacion(request, exc: RequestValidationError):
    mensajes = []
    for e in exc.errors():
        campo = str(e["loc"][-1]) if e.get("loc") else ""
        msg = str(e.get("msg", "")).replace("Value error, ", "")
        mensajes.append(f"{campo}: {msg}" if campo else msg)
    return JSONResponse(status_code=422, content={"detail": " | ".join(dict.fromkeys(mensajes)) or "Datos inválidos"})


@app.exception_handler(Exception)
async def _error_generico(request, exc: Exception):
    # Nunca filtrar detalles internos (SQL, rutas) al público
    print(f"❌ {request.method} {request.url.path}: {type(exc).__name__}: {str(exc)[:200]}", flush=True)
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


for r in (portal_auth_router, recuperacion_portal_router, portal_client_router, entrenador_router, cms_router, sync_routes.router):
    app.include_router(r)


@app.get("/api/health")
def salud():
    # No consulta la base: sirve para vigilar que el servicio esté despierto
    return {"status": "ok", "servicio": "Spasso portal (nube)"}


# ── Imágenes y música: lo subido desde Recepción vive en la base de datos ──
_NOMBRE_OK = re.compile(r"^[\w \-.()]{1,150}$")
_media_cache = {"t": 0.0, "idx": {}}


def _indice_media():
    if time.time() - _media_cache["t"] > 60:
        try:
            with database.get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT carpeta, nombre, sha256 FROM portal_media")
                _media_cache["idx"] = {(c, n): s for c, n, s in cur.fetchall()}
        except Exception:
            pass
        _media_cache["t"] = time.time()
    return _media_cache["idx"]


def _servir_media(carpeta: str, nombre: str, request: Request):
    if not _NOMBRE_OK.match(nombre) or nombre.startswith("."):
        return JSONResponse({"detail": "No encontrado"}, status_code=404)
    sha = _indice_media().get((carpeta, nombre))
    if sha:
        if request.headers.get("if-none-match") == f'"{sha}"':
            return Response(status_code=304)
        r = sync_routes.media_desde_db(carpeta, nombre)
        if r:
            datos, mime, sha = r
            return Response(datos, media_type=mime, headers={"ETag": f'"{sha}"', "Cache-Control": "public, max-age=300"})
    ruta = os.path.join(PORTAL_DIR, carpeta, nombre)
    if os.path.isfile(ruta):
        return FileResponse(ruta)
    return JSONResponse({"detail": "No encontrado"}, status_code=404)


@app.get("/portal-static/img/{nombre}", include_in_schema=False)
def media_img(nombre: str, request: Request):
    return _servir_media("img", nombre, request)


@app.get("/portal-static/music/{nombre}", include_in_schema=False)
def media_music(nombre: str, request: Request):
    return _servir_media("music", nombre, request)


from rutina_util import servir_con_rango  # noqa: E402


@app.get("/portal-static/vid/{ruta:path}", include_in_schema=False)
def media_video(ruta: str, request: Request):
    # Videos de ejercicios con soporte de Range (adelantar/retroceder)
    return servir_con_rango(os.path.join(PORTAL_DIR, "vid"), ruta, request)


if os.path.isdir(PORTAL_DIR):
    app.mount("/portal-static", StaticFiles(directory=PORTAL_DIR), name="portal-static")


@app.get("/", include_in_schema=False)
@app.get("/portal", include_in_schema=False)
def inicio():
    return RedirectResponse(url="/portal-static/index.html")


@app.get("/{ruta:path}", include_in_schema=False)
def cualquier_otra(ruta: str):
    # La nube NO sirve la aplicación de Recepción: cualquier otra ruta es 404
    return JSONResponse({"detail": "No encontrado"}, status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main_cloud:app", host=os.getenv("GYM_HOST", "0.0.0.0"), port=int(os.getenv("PORT", "8000")),
                proxy_headers=True, forwarded_allow_ips="*")
