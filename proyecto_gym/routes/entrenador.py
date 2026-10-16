"""
routes/entrenador.py - Panel del entrenador (se usa desde el portal público).

Las cuentas de Entrenador NO entran a Recepción: inician sesión en el portal
público (ver portal_auth.py) y desde ahí arman la rutina semanal de cada
socio cuyo plan incluye rutina de entrenador (planes.incluye_rutina).
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from database import get_db
from dependencies import require_rol
import json

router = APIRouter(prefix="/api/entrenador", tags=["Entrenador"])

DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

# El Administrador asigna socios a cada entrenador (tabla entrenador_socios).
# Columna 5 = "tiene acceso" (asignado a ESTE entrenador). Se pasa id_entrenador.
_SQL_SOCIOS = """
    SELECT s.id_socio, s.nombres, s.apellidos, m.plan, m.fecha_vencimiento,
           EXISTS (SELECT 1 FROM entrenador_socios es
                   WHERE es.id_socio = s.id_socio AND es.id_entrenador = %s) AS incluye,
           r.publicada, r.actualizado_en, s.genero
    FROM socios s
    LEFT JOIN LATERAL (
        SELECT plan, fecha_vencimiento FROM membresias
        WHERE id_socio = s.id_socio AND estado <> 'retirado'
        ORDER BY fecha_vencimiento DESC LIMIT 1
    ) m ON TRUE
    LEFT JOIN rutinas_socio r ON r.id_socio = s.id_socio
    WHERE COALESCE(s.activo, TRUE) = TRUE
"""


def _id_usuario(usuario):
    try:
        return int(usuario.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Sesión inválida")


def _texto(v, n):
    return str(v or "").strip()[:n]


def _entero(v, defecto, minimo=1, maximo=99):
    try:
        return max(minimo, min(maximo, int(v)))
    except (TypeError, ValueError):
        return defecto


def limpiar_rutina(data: dict) -> dict:
    """Valida y normaliza la rutina que manda el entrenador."""
    dias_in = data.get("dias") or []
    dias = []
    for d in dias_in[:7]:
        if not isinstance(d, dict):
            continue
        nombre_dia = _texto(d.get("dia"), 20)
        if nombre_dia not in DIAS:
            continue
        ejercicios = []
        for e in (d.get("ejercicios") or [])[:30]:
            if not isinstance(e, dict) or not _texto(e.get("nombre"), 120):
                continue
            ejercicios.append({
                "id": _texto(e.get("id"), 20),
                "nombre": _texto(e.get("nombre"), 120),
                "series": _entero(e.get("series"), 3),
                "repeticiones": _texto(e.get("repeticiones"), 20) or "10",
                "descanso": _texto(e.get("descanso"), 20),
                "nota": _texto(e.get("nota"), 200),
            })
        dias.append({"dia": nombre_dia, "ejercicios": ejercicios})
    return {
        "nombre": _texto(data.get("nombre"), 80) or "Rutina semanal",
        "notas": _texto(data.get("notas"), 400),
        "dias": dias,
    }


@router.get("/socios")
def listar_socios(usuario=Depends(require_rol(["Entrenador"]))):
    """Socios que el Administrador le asignó a este entrenador."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(_SQL_SOCIOS + " ORDER BY s.nombres, s.apellidos", (_id_usuario(usuario),))
        rows = cur.fetchall()
        cur.execute("SELECT id_socio FROM perfil_fisico_socio")
        con_datos = {x[0] for x in cur.fetchall()}
    return [
        {
            "id_socio": r[0],
            "nombre": f"{r[1] or ''} {r[2] or ''}".strip(),
            "plan": r[3],
            "vencimiento": r[4].isoformat() if r[4] else None,
            "genero": r[8],
            "tiene_datos": r[0] in con_datos,
            "tiene_rutina": r[6] is not None,
            "publicada": bool(r[6]),
            "actualizada": r[7].isoformat() if r[7] else None,
        }
        for r in rows if r[5]
    ]


# ----------------------------------------------------------------------
# Administración: qué socios ve cada entrenador (solo Administrador)
# ----------------------------------------------------------------------
def _validar_entrenador(cur, id_entrenador):
    cur.execute(
        "SELECT u.username FROM usuarios_sistema u JOIN roles_permisos r ON u.id_rol = r.id_rol "
        "WHERE u.id_usuario = %s AND r.nombre_rol = 'Entrenador'",
        (id_entrenador,)
    )
    fila = cur.fetchone()
    if not fila:
        raise HTTPException(status_code=404, detail="Entrenador no encontrado")
    return fila[0]


@router.get("/admin/{id_entrenador}/socios")
def admin_listar_socios(id_entrenador: int, usuario=Depends(require_rol(["Administrador"]))):
    """Todos los socios activos con su plan y si están asignados a este entrenador."""
    with get_db() as conn:
        cur = conn.cursor()
        nombre = _validar_entrenador(cur, id_entrenador)
        cur.execute(_SQL_SOCIOS + " ORDER BY s.nombres, s.apellidos", (id_entrenador,))
        rows = cur.fetchall()
    return {
        "entrenador": nombre,
        "socios": [
            {
                "id_socio": r[0],
                "nombre": f"{r[1] or ''} {r[2] or ''}".strip(),
                "plan": r[3] or "Sin plan",
                "vencimiento": r[4].isoformat() if r[4] else None,
                "asignado": bool(r[5]),
            }
            for r in rows
        ],
    }


@router.put("/admin/{id_entrenador}/socios")
def admin_asignar_socios(
    id_entrenador: int,
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """Reemplaza la lista de socios asignados: { ids: [id_socio, ...] }."""
    try:
        ids = sorted({int(i) for i in (data.get("ids") or [])})
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Lista de socios inválida")
    with get_db() as conn:
        cur = conn.cursor()
        _validar_entrenador(cur, id_entrenador)
        cur.execute("DELETE FROM entrenador_socios WHERE id_entrenador = %s", (id_entrenador,))
        for i in ids:
            cur.execute(
                "INSERT INTO entrenador_socios (id_entrenador, id_socio) "
                "SELECT %s, id_socio FROM socios WHERE id_socio = %s "
                "ON CONFLICT DO NOTHING",
                (id_entrenador, i)
            )
    return {"mensaje": f"{len(ids)} socio(s) asignado(s)", "total": len(ids)}


def _socio_elegible(cur, id_socio, id_entrenador):
    cur.execute(_SQL_SOCIOS + " AND s.id_socio = %s", (id_entrenador, id_socio))
    r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
    if not r[5]:
        raise HTTPException(status_code=403, detail="Este socio no está asignado a tu cuenta")
    return r


@router.get("/socios/{id_socio}/rutina")
def obtener_rutina(id_socio: int, usuario=Depends(require_rol(["Entrenador"]))):
    with get_db() as conn:
        cur = conn.cursor()
        r = _socio_elegible(cur, id_socio, _id_usuario(usuario))
        cur.execute("SELECT contenido, publicada FROM rutinas_socio WHERE id_socio = %s", (id_socio,))
        fila = cur.fetchone()
        cur.execute(
            "SELECT estatura_cm, peso_kg, actividad, objetivo, dias_semana, lesiones, actualizado_en, peso_inicial_kg "
            "FROM perfil_fisico_socio WHERE id_socio = %s", (id_socio,))
        pf = cur.fetchone()
    perfil = None
    if pf:
        perfil = {
            "estatura_cm": float(pf[0]) if pf[0] is not None else None,
            "peso_kg": float(pf[1]) if pf[1] is not None else None,
            "actividad": pf[2], "objetivo": pf[3], "dias_semana": pf[4], "lesiones": pf[5] or "",
            "actualizado": pf[6].isoformat() if pf[6] else None,
            "peso_inicial_kg": float(pf[7]) if pf[7] is not None else None,
        }
    rutina = json.loads(fila[0]) if fila else {"nombre": "Rutina semanal", "notas": "", "dias": []}
    return {
        "perfil": perfil,
        "socio": {"id_socio": id_socio, "nombre": f"{r[1] or ''} {r[2] or ''}".strip(), "plan": r[3], "genero": r[8]},
        "rutina": rutina,
        "publicada": bool(fila[1]) if fila else False,
    }


@router.put("/socios/{id_socio}/genero")
def fijar_genero(id_socio: int, data: dict = Body(...), usuario=Depends(require_rol(["Entrenador"]))):
    """Corrige/define el género de un socio (para socios registrados antes de guardarlo)."""
    genero = data.get("genero")
    if genero not in ("masculino", "femenino"):
        raise HTTPException(status_code=422, detail="Género inválido")
    with get_db() as conn:
        cur = conn.cursor()
        _socio_elegible(cur, id_socio, _id_usuario(usuario))
        cur.execute("UPDATE socios SET genero = %s WHERE id_socio = %s", (genero, id_socio))
    return {"genero": genero}


@router.put("/socios/{id_socio}/rutina")
def guardar_rutina(
    id_socio: int,
    data: dict = Body(...),
    usuario=Depends(require_rol(["Entrenador"]))
):
    """Guarda la rutina (borrador) o la publica para que el socio la vea."""
    rutina = limpiar_rutina(data.get("rutina") or {})
    publicar = bool(data.get("publicada"))
    if publicar and not any(d["ejercicios"] for d in rutina["dias"]):
        raise HTTPException(status_code=400, detail="Agrega al menos un ejercicio antes de publicar")
    try:
        id_entrenador = int(usuario.get("sub"))
    except (TypeError, ValueError):
        id_entrenador = None
    with get_db() as conn:
        cur = conn.cursor()
        _socio_elegible(cur, id_socio, id_entrenador)
        cur.execute(
            """
            INSERT INTO rutinas_socio (id_socio, id_entrenador, contenido, publicada, actualizado_en)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (id_socio) DO UPDATE SET
                id_entrenador = EXCLUDED.id_entrenador,
                contenido = EXCLUDED.contenido,
                publicada = EXCLUDED.publicada,
                actualizado_en = now()
            """,
            (id_socio, id_entrenador, json.dumps(rutina, ensure_ascii=False), publicar)
        )
    return {"mensaje": "Rutina publicada" if publicar else "Borrador guardado", "publicada": publicar}


# ---------------------------------------------------------------------------
# Asistente IA: arma una propuesta de rutina con los datos del socio y SOLO
# ejercicios de la biblioteca (el navegador manda un catálogo reducido).
# El servidor llama al modelo (así no hay problemas de CORS ni se expone nada).
# Por defecto usa un servicio gratuito sin cuenta ni API key (Pollinations).
# Si quieres otro proveedor compatible con OpenAI, define en el entorno:
#   IA_API_URL, IA_API_KEY, IA_MODEL
# Si ninguno responde, el portal usa el generador integrado (sin internet).
# ---------------------------------------------------------------------------
import os
import re
import urllib.request

# Proveedores sin cuenta (se prueban en orden; los servicios gratuitos anónimos
# cambian con frecuencia). Con IA_API_URL/IA_API_KEY/IA_MODEL en el archivo .env
# se usa primero tu proveedor (ej. Groq u OpenRouter con clave gratuita).
_IA_PROVEEDORES = [
    # (url, modelo, usa_json_mode)
    ("https://text.pollinations.ai/openai", "openai", False),
    ("https://text.pollinations.ai/openai", "mistral", False),
    ("https://api.llm7.io/v1/chat/completions", "gpt-4o-mini-2024-07-18", False),
    ("https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions", "Meta-Llama-3_3-70B-Instruct", False),
]


def _llamar_ia(mensajes):
    """Prueba los proveedores en orden. Devuelve (texto, proveedor) o lanza 502 con el detalle."""
    proveedores = list(_IA_PROVEEDORES)
    url_env = os.environ.get("IA_API_URL")
    if url_env:
        proveedores.insert(0, (url_env, os.environ.get("IA_MODEL", "llama-3.3-70b-versatile"), True))
    errores = []
    for url, modelo, json_mode in proveedores:
        host = url.split("/")[2]
        try:
            carga = {"model": modelo, "messages": mensajes, "temperature": 0.6}
            if json_mode:
                carga["response_format"] = {"type": "json_object"}
            headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 SpassoGym"}
            if url_env and url == url_env:
                if os.environ.get("IA_API_KEY"):
                    headers["Authorization"] = "Bearer " + os.environ["IA_API_KEY"]
            elif "llm7" in host:
                headers["Authorization"] = "Bearer unused"
            req = urllib.request.Request(url, data=json.dumps(carga).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=30) as r:
                datos = json.loads(r.read().decode("utf-8"))
            texto = datos["choices"][0]["message"]["content"]
            if texto and "{" in texto:
                return texto, host + " · " + modelo
            errores.append(host + ": respuesta vacía")
        except Exception as e:  # red caída, límite, formato distinto...
            errores.append(host + ": " + str(e)[:70])
    print("[IA] Falló todo:", errores)
    raise HTTPException(status_code=502, detail="La IA no respondió. " + " | ".join(errores))


@router.post("/ia/rutina")
def ia_generar_rutina(data: dict = Body(...), usuario=Depends(require_rol(["Entrenador"]))):
    perfil = data.get("perfil") or {}
    catalogo = data.get("catalogo") or []
    if not perfil or not catalogo:
        raise HTTPException(status_code=422, detail="Faltan los datos del socio o el catálogo")
    extra = str(data.get("extra") or "")[:200]
    dias = int(perfil.get("dias_semana") or 3)
    dias = max(1, min(6, dias))

    lineas = "\n".join(
        "%s|%s|%s|%s" % (c.get("id"), str(c.get("n"))[:60], c.get("p"), c.get("e"))
        for c in catalogo[:260]
    )
    sistema = (
        "Eres un entrenador personal experto de un gimnasio. Armas rutinas semanales seguras y "
        "progresivas. SOLO puedes usar ejercicios del catálogo, referidos por su id exacto. "
        "Respondes únicamente con un objeto JSON válido, sin texto adicional."
    )
    usuario_msg = (
        "Datos del socio: estatura %s cm, peso %s kg, nivel de actividad: %s, objetivo: %s, "
        "días disponibles por semana: %s, lesiones/limitaciones: %s.\n"
        "Indicaciones extra del entrenador: %s\n\n"
        "Arma una rutina con exactamente %d días de entrenamiento, repartidos en la semana con "
        "descanso entre sesiones (usa nombres: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado). "
        "Cada día lleva entre 5 y 7 ejercicios, equilibrando grupos musculares según el objetivo; "
        "si hay lesión evita ejercicios que la agraven. Sin repetir ejercicio en la semana. "
        "Para cardio usa repeticiones como \"10-15 min\".\n"
        "Formato EXACTO: {\"nombre\":\"...\",\"notas\":\"consejo breve para el socio\","
        "\"dias\":[{\"dia\":\"Lunes\",\"ejercicios\":[{\"id\":\"...\",\"series\":3,"
        "\"repeticiones\":\"12\",\"descanso\":\"60 s\",\"nota\":\"\"}]}]}\n\n"
        "Catálogo (id|nombre|parte|equipo):\n%s"
    ) % (
        perfil.get("estatura_cm"), perfil.get("peso_kg"), perfil.get("actividad"),
        perfil.get("objetivo"), perfil.get("dias_semana"), perfil.get("lesiones") or "ninguna",
        extra or "ninguna", dias, lineas,
    )
    texto, proveedor = _llamar_ia([
        {"role": "system", "content": sistema},
        {"role": "user", "content": usuario_msg},
    ])
    m = re.search(r"\{.*\}", texto, re.S)
    if not m:
        raise HTTPException(status_code=502, detail="La IA devolvió un formato no válido")
    try:
        return {"rutina": json.loads(m.group(0)), "proveedor": proveedor}
    except ValueError:
        raise HTTPException(status_code=502, detail="La IA devolvió un JSON no válido")
