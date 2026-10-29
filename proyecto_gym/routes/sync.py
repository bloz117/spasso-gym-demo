"""
routes/sync.py — Endpoints de sincronización.

* /api/sync/push|pull|ping|digest|media/*  → SOLO en la nube (APP_MODE=cloud),
  protegidos con firma HMAC (ver sync_core.py). Recepción es el único cliente.
* /api/sync/admin/*                         → SOLO en Recepción (rol Administrador):
  estado de la sincronización, "sincronizar todo" y verificación contra la nube.
"""
import hashlib
import json
import os
import re
import secrets
import threading
import time
from collections import defaultdict

import psycopg2
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, Response

import sync_core as sc
from database import get_db
from dependencies import require_rol

router = APIRouter(prefix="/api/sync", tags=["Sincronización"])

MODO = os.getenv("APP_MODE", "local").strip().lower()

# ─────────────────────────────────────────────────────────────────────────
# Estado en memoria de la nube (para que /ping NO toque la base de datos y así
# la base gratuita pueda "dormirse" cuando nadie la usa)
# ─────────────────────────────────────────────────────────────────────────
_boot = secrets.token_hex(4)
_seq = {"v": -1}
_fallos = defaultdict(list)
_fallos_lock = threading.Lock()


def leer_seq(conn):
    """Último id del outbox de la nube (cambios que Recepción aún no trajo)."""
    cur = conn.cursor()
    cur.execute("SELECT CASE WHEN is_called THEN last_value ELSE 0 END FROM sync_outbox_id_seq")
    _seq["v"] = int(cur.fetchone()[0])
    conn.rollback()


def post_commit_nube(conn):
    leer_seq(conn)


def _ip(request: Request):
    return request.client.host if request.client else "?"


def _limite_fallos(ip):
    ahora = time.time()
    with _fallos_lock:
        _fallos[ip] = [t for t in _fallos[ip] if ahora - t < 300]
        if len(_fallos[ip]) >= 20:
            raise HTTPException(status_code=429, detail="Demasiados intentos")


def _registrar_fallo(ip):
    with _fallos_lock:
        _fallos[ip].append(time.time())


async def firmado_nube(request: Request):
    """Verifica la firma HMAC de la petición y deja el cuerpo en request.state.body."""
    if MODO != "cloud":
        raise HTTPException(status_code=404, detail="No encontrado")
    secreto = os.getenv("SYNC_SECRET", "")
    if len(secreto) < 32:
        raise HTTPException(status_code=503, detail="Sincronización no configurada")
    ip = _ip(request)
    _limite_fallos(ip)
    largo = request.headers.get("content-length")
    limite = sc.MAX_BODY if not request.url.path.startswith("/api/sync/media/") else 20 * 1024 * 1024
    if largo and int(largo) > limite:
        raise HTTPException(status_code=413, detail="Petición demasiado grande")
    body = await request.body()
    if len(body) > limite:
        raise HTTPException(status_code=413, detail="Petición demasiado grande")
    path_qs = request.url.path + (("?" + request.url.query) if request.url.query else "")
    ok, motivo = sc.verificar_firma(secreto, request.method, path_qs, request.headers, body)
    if not ok:
        _registrar_fallo(ip)
        # Solo se revela el motivo del reloj (no expone nada secreto); el resto es genérico
        # Huella corta (6 hex de un SHA-256) para que Recepción diga si las claves son iguales, sin revelar la clave
        fp = hashlib.sha256(secreto.encode()).hexdigest()[:6]
        raise HTTPException(status_code=401,
                            detail=("No autorizado (hora)" if "hora" in (motivo or "") else "No autorizado") + f" fp={fp}")
    request.state.body = body


# ─────────────────────────────────────────────────────────────────────────
# NUBE: ping / push / pull / digest
# ─────────────────────────────────────────────────────────────────────────
@router.get("/ping")
def ping(request: Request, _=Depends(firmado_nube)):
    # NO consulta la base: responde desde memoria
    return {"boot": _boot, "seq": _seq["v"], "ahora": int(time.time())}


@router.post("/push")
def push(request: Request, _=Depends(firmado_nube)):
    try:
        data = json.loads(request.state.body or b"{}")
        items = data.get("items") or []
    except Exception:
        raise HTTPException(status_code=400, detail="JSON inválido")
    if not isinstance(items, list) or len(items) > sc.MAX_ITEMS_PUSH * 2:
        raise HTTPException(status_code=400, detail="Demasiados cambios en una petición")

    resultados = []
    with get_db() as conn:
        cur = conn.cursor()
        sc.activar_modo_aplicar(cur)
        for i, it in enumerate(items):
            try:
                spec = sc.POR_NOMBRE[it["t"]]
                op = it["op"]
                if op not in ("U", "D"):
                    raise ValueError("operación inválida")
                cur.execute("SAVEPOINT it")
                sc.aplicar_item(cur, spec, op, it["pk"], it.get("row"), "push")
                cur.execute("RELEASE SAVEPOINT it")
                resultados.append({"i": i, "ok": True})
            except Exception as e:
                try:
                    cur.execute("ROLLBACK TO SAVEPOINT it")
                except Exception:
                    pass
                resultados.append({
                    "i": i, "ok": False, "error": str(e).splitlines()[0][:300],
                    "fk": isinstance(e, psycopg2.errors.ForeignKeyViolation),
                })
    return {"resultados": resultados}


@router.get("/pull")
def pull(request: Request, after: int = 0, limit: int = 200, _=Depends(firmado_nube)):
    limit = max(1, min(limit, 500))
    items = []
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET LOCAL timezone TO 'UTC'")
        cur.execute("SELECT id, tabla, pk, op FROM sync_outbox WHERE id > %s AND tabla = ANY(%s) "
                    "ORDER BY id LIMIT %s", (after, sc.TABLAS_BIDI, limit))
        filas = cur.fetchall()
        cursor = after
        for fid, tabla, pk, op in filas:
            cursor = max(cursor, fid)
        unicos = sc.coalescer([(f[0], f[1], f[2], f[3]) for f in filas])
        unicos.sort(key=lambda e: sc.ORDEN[e["tabla"]])
        for e in unicos:
            spec = sc.POR_NOMBRE[e["tabla"]]
            if e["op"] == "D":
                continue  # Recepción es la fuente de verdad: los borrados no vuelven
            fila = sc.leer_fila(cur, spec, e["pk"], sc.columnas(spec, "pull"))
            if fila is not None:
                items.append({"t": e["tabla"], "op": "U", "pk": e["pk"], "row": fila})
        cur.execute("SELECT CASE WHEN is_called THEN last_value ELSE 0 END FROM sync_outbox_id_seq")
        seq = int(cur.fetchone()[0])
    return {"items": items, "cursor": cursor, "more": len(filas) >= limit, "seq": seq}


@router.get("/digest")
def digest(request: Request, _=Depends(firmado_nube)):
    out = {}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET LOCAL timezone TO 'UTC'")
        for spec in sc.SPECS:
            out[spec["name"]] = sc.digest_tabla(cur, spec)
    return out


# ── Medios (imágenes/música subidas desde Recepción) ────────────────────
_PORTAL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "PaginaGimnasio"))
_CARPETAS_MEDIA = {
    "img": (".png", ".jpg", ".jpeg", ".webp", ".gif"),
    "music": (".mp3", ".ogg", ".wav", ".m4a"),
}
_MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
         ".gif": "image/gif", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
         ".m4a": "audio/mp4"}
_NOMBRE_OK = re.compile(r"^[\w \-.()]{1,150}$")
MAX_MEDIA = 15 * 1024 * 1024
_bundle_cache = {}


def _sha_archivo(ruta):
    k = (ruta, os.path.getmtime(ruta), os.path.getsize(ruta))
    c = _bundle_cache.get(ruta)
    if c and c[0] == k:
        return c[1]
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1024 * 1024), b""):
            h.update(bloque)
    _bundle_cache[ruta] = (k, h.hexdigest())
    return h.hexdigest()


def indice_local(carpeta):
    """{nombre: sha256} de los archivos de esa carpeta del portal (no recursivo)."""
    base = os.path.join(_PORTAL_DIR, carpeta)
    if not os.path.isdir(base):
        return {}
    res = {}
    for f in sorted(os.listdir(base)):
        ruta = os.path.join(base, f)
        if os.path.isfile(ruta) and f.lower().endswith(_CARPETAS_MEDIA[carpeta]) and _NOMBRE_OK.match(f):
            res[f] = _sha_archivo(ruta)
    return res


@router.get("/media/index")
def media_index(request: Request, _=Depends(firmado_nube)):
    bundle = {c: indice_local(c) for c in _CARPETAS_MEDIA}
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT carpeta, nombre, sha256 FROM portal_media")
        db = defaultdict(dict)
        for c, n, s in cur.fetchall():
            db[c][n] = s
    return {"bundle": bundle, "db": db}


@router.put("/media/{carpeta}/{nombre}")
def media_subir(carpeta: str, nombre: str, request: Request, _=Depends(firmado_nube)):
    if carpeta not in _CARPETAS_MEDIA or not _NOMBRE_OK.match(nombre) \
            or not nombre.lower().endswith(_CARPETAS_MEDIA[carpeta]):
        raise HTTPException(status_code=400, detail="Archivo no permitido")
    datos = request.state.body
    if not datos or len(datos) > MAX_MEDIA:
        raise HTTPException(status_code=400, detail="Tamaño no permitido")
    ext = os.path.splitext(nombre)[1].lower()
    sha = hashlib.sha256(datos).hexdigest()
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO portal_media (carpeta, nombre, mime, sha256, tamano, datos) "
            "VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (carpeta, nombre) DO UPDATE SET "
            "mime=EXCLUDED.mime, sha256=EXCLUDED.sha256, tamano=EXCLUDED.tamano, "
            "datos=EXCLUDED.datos, actualizado=now()",
            (carpeta, nombre, _MIME[ext], sha, len(datos), psycopg2.Binary(datos)))
    return {"ok": True, "sha256": sha}


def media_desde_db(carpeta, nombre):
    """Para main_cloud: devuelve (bytes, mime, sha) o None."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT datos, mime, sha256 FROM portal_media WHERE carpeta=%s AND nombre=%s",
                    (carpeta, nombre))
        r = cur.fetchone()
    return (bytes(r[0]), r[1], r[2]) if r else None


# ─────────────────────────────────────────────────────────────────────────
# RECEPCIÓN: administración de la sincronización
# ─────────────────────────────────────────────────────────────────────────
def _agente():
    import sync_agent
    return sync_agent


@router.get("/admin/estado")
def admin_estado(usuario=Depends(require_rol(["Administrador"]))):
    if MODO == "cloud":
        raise HTTPException(status_code=404, detail="No encontrado")
    return _agente().estado()


@router.post("/admin/sincronizar-todo")
def admin_sincronizar_todo(usuario=Depends(require_rol(["Administrador"]))):
    if MODO == "cloud":
        raise HTTPException(status_code=404, detail="No encontrado")
    return _agente().sincronizar_todo()


@router.post("/admin/verificar")
def admin_verificar(usuario=Depends(require_rol(["Administrador"]))):
    if MODO == "cloud":
        raise HTTPException(status_code=404, detail="No encontrado")
    return _agente().verificar()
