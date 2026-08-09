from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import os
from dotenv import load_dotenv

load_dotenv()

from routes.auth import router as auth_router
from routes.socios import router as socios_router
from routes.asistencias import router as asistencias_router
from routes.ventas import router as ventas_router
from routes.lockers import router as lockers_router
from routes.portal_auth import router as portal_auth_router
from routes.portal_client import router as portal_client_router
from routes.cms import router as cms_router
from routes.gym_config import router as gym_config_router
from routes.routines import router as routines_router
from routes.stats import router as stats_router
from routes.productos import router as productos_router
from routes.biometria import router as biometria_router
from routes.planes import router as planes_router

app = FastAPI(
    title="Spasso Sauna & Gym — API de Recepción",
    description="Backend para gestión de socios, asistencias y ventas",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)


@app.on_event("startup")
def verificar_conexion_db():
    """Al arrancar, verifica la conexión a PostgreSQL con un mensaje claro."""
    try:
        from database import get_db
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1")
        print("\n✅ Conexión a PostgreSQL establecida correctamente.")
        print("🌐 Documentación disponible en: http://localhost:7000/api/docs\n")
    except Exception as e:
        print("\n" + "=" * 60)
        print("❌ ERROR: No se pudo conectar a PostgreSQL.")
        print(f"   Detalle: {e}")
        print("\n   Verifica que:")
        print("   1. PostgreSQL esté corriendo en pgAdmin (icono verde en el servidor)")
        print("   2. Tu archivo .env tenga los datos correctos:")
        print(f"      DB_HOST={os.getenv('DB_HOST', 'NO CONFIGURADO')}")
        print(f"      DB_PORT={os.getenv('DB_PORT', 'NO CONFIGURADO')}")
        print(f"      DB_NAME={os.getenv('DB_NAME', 'NO CONFIGURADO')}")
        print(f"      DB_USER={os.getenv('DB_USER', 'NO CONFIGURADO')}")
        print("      DB_PASSWORD=<tu contraseña>")
        print("   3. El archivo .env esté en la misma carpeta que main.py")
        print("=" * 60 + "\n")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(socios_router)
app.include_router(asistencias_router)
app.include_router(ventas_router)
app.include_router(lockers_router)
app.include_router(portal_auth_router)
app.include_router(portal_client_router)
app.include_router(cms_router)
app.include_router(gym_config_router)
app.include_router(routines_router)
app.include_router(stats_router)
app.include_router(productos_router)
app.include_router(biometria_router)
app.include_router(planes_router)

if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Montar archivos de Spasso (para recepción)
spasso_path = os.path.join(os.path.dirname(__file__), "..", "Spasso")
if os.path.exists(spasso_path):
    app.mount("/static-spasso", StaticFiles(directory=spasso_path), name="spasso")

# Montar archivos del portal público
portal_path = os.path.join(os.path.dirname(__file__), "..", "PaginaGimnasio")
if os.path.exists(portal_path):
    app.mount("/portal-static", StaticFiles(directory=portal_path), name="portal-static")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "servicio": "Spasso API"}


@app.get("/pantalla-socios")
def serve_pantalla_socios():
    """
    Pantalla opcional de bienvenida para socios (pensada para un segundo
    monitor de cara al socio): muestra el logo del gimnasio en reposo, y
    cuando alguien marca entrada/salida con la huella en recepción, se
    actualiza sola mostrando sus datos unos segundos. Ver
    templates/pantalla_socios.html.
    """
    pantalla = os.path.join(os.path.dirname(__file__), "templates", "pantalla_socios.html")
    if os.path.exists(pantalla):
        return FileResponse(pantalla)
    return JSONResponse({"mensaje": "Pantalla de socios no encontrada"}, status_code=404)


@app.get("/portal")
def serve_portal():
    """Sirve el portal público para socios"""
    portal_index = os.path.join(os.path.dirname(__file__), "..", "PaginaGimnasio", "index.html")
    if os.path.exists(portal_index):
        return FileResponse(portal_index)
    return JSONResponse({"mensaje": "Portal no encontrado"}, status_code=404)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    # IMPORTANTE: nunca devolver el HTML de la SPA para una ruta /api/...
    # que no coincidió con ningún endpoint real (por ejemplo, por una barra
    # final faltante en el frontend). Sin este guardia, un error de ese tipo
    # se ve como un 200 OK con HTML, en vez de un 404 claro — eso costó horas
    # de depuración porque el error en consola era "Unexpected token '<'"
    # en lugar de un mensaje evidente de endpoint no encontrado.
    if full_path.startswith("api/"):
        return JSONResponse({"detail": f"Endpoint no encontrado: /{full_path}"}, status_code=404)

    for candidate in ["templates/recepcion.html", "templates/index.html"]:
        if os.path.exists(candidate):
            return FileResponse(candidate)
    return JSONResponse({"mensaje": "Coloca recepcion.html en la carpeta templates/"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=7000, reload=False)
