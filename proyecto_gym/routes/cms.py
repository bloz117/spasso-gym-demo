"""
routes/cms.py - Endpoints del CMS (Content Management System)

Gestiona los temas visuales y personalización del portal público.
Permite cambiar colores, animaciones, tipografía y layouts.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from database import get_db
from schemas import CMSThemeResponse, CMSThemeUpdate
from dependencies import require_rol
import json

router = APIRouter(prefix="/api/cms", tags=["CMS"])


@router.get("/themes")
def listar_temas():
    """
    Lista todos los temas disponibles en el sistema.
    Endpoint público (sin autenticación).
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_tema, nombre_tema, colores, animaciones, botones_estilo, 
                   tipografia, layouts, activo
            FROM cms_theme
            ORDER BY nombre_tema
            """
        )
        rows = cur.fetchall()

    themes = []
    for row in rows:
        id_tema, nombre_tema, colores_json, animaciones_json, botones_json, \
            tipografia_json, layouts_json, activo = row

        themes.append({
            "id_tema": id_tema,
            "nombre_tema": nombre_tema,
            "colores": json.loads(colores_json) if isinstance(colores_json, str) else colores_json,
            "animaciones": json.loads(animaciones_json) if isinstance(animaciones_json, str) else animaciones_json,
            "botones_estilo": json.loads(botones_json) if isinstance(botones_json, str) else botones_json,
            "tipografia": json.loads(tipografia_json) if isinstance(tipografia_json, str) else tipografia_json,
            "layouts": json.loads(layouts_json) if isinstance(layouts_json, str) else layouts_json,
            "activo": activo
        })

    return {
        "total_temas": len(themes),
        "temas": themes
    }


@router.get("/themes/{id_tema}")
def obtener_tema_detalle(id_tema: int):
    """
    Obtiene el detalle completo de un tema específico.
    Endpoint público.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_tema, nombre_tema, colores, animaciones, botones_estilo, 
                   tipografia, layouts, activo
            FROM cms_theme
            WHERE id_tema = %s
            """,
            (id_tema,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Tema no encontrado")

    id_tema, nombre_tema, colores_json, animaciones_json, botones_json, \
        tipografia_json, layouts_json, activo = row

    return {
        "id_tema": id_tema,
        "nombre_tema": nombre_tema,
        "colores": json.loads(colores_json) if isinstance(colores_json, str) else colores_json,
        "animaciones": json.loads(animaciones_json) if isinstance(animaciones_json, str) else animaciones_json,
        "botones_estilo": json.loads(botones_json) if isinstance(botones_json, str) else botones_json,
        "tipografia": json.loads(tipografia_json) if isinstance(tipografia_json, str) else tipografia_json,
        "layouts": json.loads(layouts_json) if isinstance(layouts_json, str) else layouts_json,
        "activo": activo
    }


@router.get("/active-theme")
def obtener_tema_activo():
    """
    Obtiene el tema activo actualmente.
    Frontend consultará este endpoint para aplicar el estilo.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_tema, nombre_tema, colores, animaciones, botones_estilo, 
                   tipografia, layouts, activo
            FROM cms_theme
            WHERE activo = TRUE
            LIMIT 1
            """
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No hay tema activo configurado")

    id_tema, nombre_tema, colores_json, animaciones_json, botones_json, \
        tipografia_json, layouts_json, activo = row

    return {
        "id_tema": id_tema,
        "nombre_tema": nombre_tema,
        "colores": json.loads(colores_json) if isinstance(colores_json, str) else colores_json,
        "animaciones": json.loads(animaciones_json) if isinstance(animaciones_json, str) else animaciones_json,
        "botones_estilo": json.loads(botones_json) if isinstance(botones_json, str) else botones_json,
        "tipografia": json.loads(tipografia_json) if isinstance(tipografia_json, str) else tipografia_json,
        "layouts": json.loads(layouts_json) if isinstance(layouts_json, str) else layouts_json,
        "activo": activo
    }


@router.put("/themes/{id_tema}")
def actualizar_tema(
    id_tema: int,
    data: CMSThemeUpdate,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Actualiza un tema existente. Solo Administrador.
    Puede actualizar colores, animaciones, tipografía, etc.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id_tema FROM cms_theme WHERE id_tema = %s",
            (id_tema,)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Tema no encontrado")

        # Construir la actualización dinámicamente
        updates = []
        params = []

        if data.colores is not None:
            updates.append("colores = %s")
            params.append(json.dumps(data.colores))

        if data.animaciones is not None:
            updates.append("animaciones = %s")
            params.append(json.dumps(data.animaciones))

        if data.botones_estilo is not None:
            updates.append("botones_estilo = %s")
            params.append(json.dumps(data.botones_estilo))

        if data.tipografia is not None:
            updates.append("tipografia = %s")
            params.append(json.dumps(data.tipografia))

        if data.layouts is not None:
            updates.append("layouts = %s")
            params.append(json.dumps(data.layouts))

        if data.activo is not None:
            updates.append("activo = %s")
            params.append(data.activo)

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay campos para actualizar"
            )

        params.append(id_tema)
        query = f"UPDATE cms_theme SET {', '.join(updates)} WHERE id_tema = %s RETURNING id_tema"

        cur.execute(query, params)
        result = cur.fetchone()

    if result:
        return obtener_tema_detalle(id_tema)
    else:
        raise HTTPException(status_code=400, detail="No se pudo actualizar el tema")


@router.post("/themes/{id_tema}/activate")
def activar_tema(
    id_tema: int,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Activa un tema y desactiva los demás.
    Solo Administrador.
    """
    with get_db() as conn:
        cur = conn.cursor()
        
        # Verificar que el tema existe
        cur.execute("SELECT id_tema FROM cms_theme WHERE id_tema = %s", (id_tema,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Tema no encontrado")

        # Desactivar todos los temas
        cur.execute("UPDATE cms_theme SET activo = FALSE")

        # Activar el tema especificado
        cur.execute(
            "UPDATE cms_theme SET activo = TRUE WHERE id_tema = %s",
            (id_tema,)
        )

    return {
        "mensaje": "Tema activado exitosamente",
        "id_tema": id_tema
    }


@router.get("/export")
def exportar_tema_activo():
    """
    Exporta el tema activo en formato JSON.
    Útil para copias de seguridad o migración.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_tema, nombre_tema, colores, animaciones, botones_estilo, 
                   tipografia, layouts
            FROM cms_theme
            WHERE activo = TRUE
            LIMIT 1
            """
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No hay tema activo para exportar")

    id_tema, nombre_tema, colores_json, animaciones_json, botones_json, \
        tipografia_json, layouts_json = row

    export_data = {
        "id_tema": id_tema,
        "nombre_tema": nombre_tema,
        "colores": json.loads(colores_json) if isinstance(colores_json, str) else colores_json,
        "animaciones": json.loads(animaciones_json) if isinstance(animaciones_json, str) else animaciones_json,
        "botones_estilo": json.loads(botones_json) if isinstance(botones_json, str) else botones_json,
        "tipografia": json.loads(tipografia_json) if isinstance(tipografia_json, str) else tipografia_json,
        "layouts": json.loads(layouts_json) if isinstance(layouts_json, str) else layouts_json
    }

    return export_data
