"""
routes/cms.py - Endpoints del CMS (Content Management System)

Gestiona los temas visuales y personalización del portal público.
Permite cambiar colores, animaciones, tipografía y layouts.
"""
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel
from database import get_db
from schemas import CMSThemeResponse, CMSThemeUpdate
from dependencies import require_rol
from typing import Optional
import json
import os
import re

router = APIRouter(prefix="/api/cms", tags=["CMS"])

# Carpeta real de música del portal público (PaginaGimnasio/music). El
# portal sirve todo ese directorio estático en /portal-static/music/...
# (ver main.py, mount de /portal-static), así que guardar/leer archivos
# acá es exactamente lo que el navegador va a reproducir.
_MUSICA_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "PaginaGimnasio", "music"
)
_EXTENSIONES_MUSICA_PERMITIDAS = (".mp3", ".ogg", ".wav", ".m4a")


class MusicaUpdate(BaseModel):
    archivo: str


def _listar_archivos_musica():
    if not os.path.isdir(_MUSICA_DIR):
        return []
    return sorted(
        f for f in os.listdir(_MUSICA_DIR)
        if f.lower().endswith(_EXTENSIONES_MUSICA_PERMITIDAS)
    )


def _nombre_archivo_seguro(nombre: str) -> str:
    """Evita path traversal (../, rutas absolutas) en nombres de archivo
    que vienen del cliente (música o imágenes)."""
    base = os.path.basename(nombre)
    base = re.sub(r"[^\w \-.()]", "_", base)
    return base


# Carpeta real de imágenes del portal público (PaginaGimnasio/img). El
# carrusel del inicio (ver PaginaGimnasio/funciones.js, heroImages) hoy usa
# una lista fija de archivos de esta carpeta; estos endpoints permiten
# elegir cuáles de esos archivos se usan (y subir nuevos) desde Recepción.
_IMG_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "PaginaGimnasio", "img"
)
_EXTENSIONES_IMG_PERMITIDAS = (".png", ".jpg", ".jpeg", ".webp", ".gif")

# Mismas 4 fotos que trae PaginaGimnasio/funciones.js por defecto (const
# heroImages) — si nunca se guardó nada en hero_imagenes, se usan estas.
_HERO_IMAGENES_POR_DEFECTO = [
    "carrusel1.png",
    "carrusel2.jpeg",
    "carrusel3.jpg",
    "carrusel4.jpg",
]


class HeroImagenesUpdate(BaseModel):
    archivos: list[str]


def _listar_archivos_imagenes():
    if not os.path.isdir(_IMG_DIR):
        return []
    return sorted(
        f for f in os.listdir(_IMG_DIR)
        if f.lower().endswith(_EXTENSIONES_IMG_PERMITIDAS)
    )


# Tipos de fondo de PÁGINA (global: inicio+beneficios+gimnasio+planes) que
# entiende PaginaGimnasio/funciones.js (window.__establecerFondoPagina) y
# fondos-animados.js. 'fotos' es el valor por defecto (usa el aurora CSS de
# siempre, sin fondo personalizado); los otros 4 son shaders WebGL2;
# 'solido' es un color plano o degradado (1 o 2 valores en "colores"). El
# carrusel de fotos del hero (#inicio) es independiente de esto.
_TIPOS_FONDO_HERO_VALIDOS = (
    "fotos", "aurora", "floating-lines", "lightfall", "grainient", "solido"
)

_FONDO_HERO_POR_DEFECTO = {"tipo": "fotos", "colores": [], "estatico": False}


class FondoHeroUpdate(BaseModel):
    tipo: str
    colores: list[str] = []
    estatico: bool = False


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
    Frontend (portal público) consulta este endpoint para aplicar el estilo.

    NOTA: la tabla real cms_theme (migración 002) guarda presets simples por
    columna (color_palette, animation_preset, button_shape, typography,
    layout_preset), no los blobs JSON que este endpoint devolvía antes; esa
    versión anterior consultaba columnas que nunca existieron (id_tema,
    colores, animaciones, etc.) y siempre fallaba con 500.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, color_palette, animation_preset, button_shape,
                   typography, layout_preset, custom_css, is_active,
                   musica_archivo, hero_imagenes, hero_fondo
            FROM cms_theme
            WHERE is_active = TRUE
            LIMIT 1
            """
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No hay tema activo configurado")

    (id_tema, color_palette, animation_preset, button_shape, typography,
     layout_preset, custom_css, is_active, musica_archivo, hero_imagenes_json,
     hero_fondo_json) = row

    try:
        hero_imagenes = json.loads(hero_imagenes_json) if hero_imagenes_json else None
    except (TypeError, ValueError):
        hero_imagenes = None

    try:
        hero_fondo = json.loads(hero_fondo_json) if hero_fondo_json else None
    except (TypeError, ValueError):
        hero_fondo = None

    return {
        "id_tema": id_tema,
        "configuracion": {
            "paleta": color_palette,
            "animaciones": animation_preset,
            "botones": button_shape,
            "tipografia": typography,
            "layout": layout_preset,
            "musica": musica_archivo,
            "hero_imagenes": hero_imagenes or _HERO_IMAGENES_POR_DEFECTO,
            "hero_fondo": hero_fondo or _FONDO_HERO_POR_DEFECTO
        },
        "custom_css": custom_css,
        "activo": is_active
    }


@router.get("/musica")
def listar_musica_portal():
    """
    Lista los archivos de música disponibles en PaginaGimnasio/music y
    cuál está activo actualmente. Endpoint público (el portal no necesita
    login para saber qué pistas existen, aunque solo Recepción las cambia).
    """
    archivos = _listar_archivos_musica()

    activo = None
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT musica_archivo FROM cms_theme WHERE is_active = TRUE LIMIT 1"
        )
        row = cur.fetchone()
        if row:
            activo = row[0]

    return {"archivos": archivos, "activo": activo}


@router.put("/musica")
def cambiar_musica_portal(
    data: MusicaUpdate,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Cambia la pista de música de fondo del portal público, eligiendo entre
    los archivos ya presentes en PaginaGimnasio/music. Solo Administrador,
    desde el editor de Página Web en Recepción.
    """
    disponibles = _listar_archivos_musica()
    if data.archivo not in disponibles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ese archivo de música no existe en la carpeta del portal"
        )

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE cms_theme SET musica_archivo = %s, updated_at = NOW() "
            "WHERE is_active = TRUE RETURNING id",
            (data.archivo,)
        )
        result = cur.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="No hay tema activo configurado")

    return {"mensaje": "Música actualizada", "archivo": data.archivo}


@router.post("/musica/subir")
async def subir_musica_portal(
    archivo: UploadFile = File(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Sube un archivo de audio nuevo a PaginaGimnasio/music y lo deja activo
    de una vez como música de fondo del portal. Solo Administrador.
    """
    nombre = _nombre_archivo_seguro(archivo.filename or "")
    if not nombre or not nombre.lower().endswith(_EXTENSIONES_MUSICA_PERMITIDAS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no soportado. Usa: {', '.join(_EXTENSIONES_MUSICA_PERMITIDAS)}"
        )

    os.makedirs(_MUSICA_DIR, exist_ok=True)
    destino = os.path.join(_MUSICA_DIR, nombre)

    contenido = await archivo.read()
    with open(destino, "wb") as f:
        f.write(contenido)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE cms_theme SET musica_archivo = %s, updated_at = NOW() "
            "WHERE is_active = TRUE RETURNING id",
            (nombre,)
        )
        result = cur.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="No hay tema activo configurado")

    return {"mensaje": "Música subida y activada", "archivo": nombre}


@router.get("/hero-imagenes")
def listar_hero_imagenes():
    """
    Lista los archivos de imagen disponibles en PaginaGimnasio/img y cuáles
    de ellos están seleccionados (y en qué orden) para el carrusel del
    inicio del portal. Endpoint público, igual que /musica.
    """
    archivos = _listar_archivos_imagenes()

    seleccionadas = None
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT hero_imagenes FROM cms_theme WHERE is_active = TRUE LIMIT 1"
        )
        row = cur.fetchone()
        if row and row[0]:
            try:
                seleccionadas = json.loads(row[0])
            except (TypeError, ValueError):
                seleccionadas = None

    return {
        "archivos": archivos,
        "seleccionadas": seleccionadas or _HERO_IMAGENES_POR_DEFECTO
    }


@router.put("/hero-imagenes")
def actualizar_hero_imagenes(
    data: HeroImagenesUpdate,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Define qué imágenes (y en qué orden) usa el carrusel del inicio del
    portal público, eligiendo entre los archivos ya presentes en
    PaginaGimnasio/img. Solo Administrador, desde Página Web en Recepción.
    """
    if not data.archivos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecciona al menos una imagen para el carrusel"
        )

    disponibles = set(_listar_archivos_imagenes())
    faltantes = [a for a in data.archivos if a not in disponibles]
    if faltantes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estas imágenes no existen en la carpeta del portal: {', '.join(faltantes)}"
        )

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE cms_theme SET hero_imagenes = %s, updated_at = NOW() "
            "WHERE is_active = TRUE RETURNING id",
            (json.dumps(data.archivos),)
        )
        result = cur.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="No hay tema activo configurado")

    return {"mensaje": "Imágenes del carrusel actualizadas", "archivos": data.archivos}


@router.post("/hero-imagenes/subir")
async def subir_hero_imagen(
    archivo: UploadFile = File(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Sube una imagen nueva a PaginaGimnasio/img y la agrega (si no estaba
    ya) a la lista de imágenes activas del carrusel del inicio. Solo
    Administrador.
    """
    nombre = _nombre_archivo_seguro(archivo.filename or "")
    if not nombre or not nombre.lower().endswith(_EXTENSIONES_IMG_PERMITIDAS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no soportado. Usa: {', '.join(_EXTENSIONES_IMG_PERMITIDAS)}"
        )

    os.makedirs(_IMG_DIR, exist_ok=True)
    destino = os.path.join(_IMG_DIR, nombre)

    contenido = await archivo.read()
    with open(destino, "wb") as f:
        f.write(contenido)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT hero_imagenes FROM cms_theme WHERE is_active = TRUE LIMIT 1"
        )
        row = cur.fetchone()
        try:
            actuales = json.loads(row[0]) if row and row[0] else list(_HERO_IMAGENES_POR_DEFECTO)
        except (TypeError, ValueError):
            actuales = list(_HERO_IMAGENES_POR_DEFECTO)

        if nombre not in actuales:
            actuales.append(nombre)

        cur.execute(
            "UPDATE cms_theme SET hero_imagenes = %s, updated_at = NOW() "
            "WHERE is_active = TRUE RETURNING id",
            (json.dumps(actuales),)
        )
        result = cur.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="No hay tema activo configurado")

    return {"mensaje": "Imagen subida y agregada al carrusel", "archivo": nombre, "archivos": actuales}


@router.get("/hero-fondo")
def obtener_fondo_hero():
    """
    Devuelve el fondo del hero configurado actualmente (fotos / uno de los
    4 shaders animados / color sólido). Endpoint público, igual que
    /musica y /hero-imagenes: el portal no necesita login para leerlo.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT hero_fondo FROM cms_theme WHERE is_active = TRUE LIMIT 1"
        )
        row = cur.fetchone()

    fondo = None
    if row and row[0]:
        try:
            fondo = json.loads(row[0])
        except (TypeError, ValueError):
            fondo = None

    return fondo or _FONDO_HERO_POR_DEFECTO


@router.put("/hero-fondo")
def actualizar_fondo_hero(
    data: FondoHeroUpdate,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Cambia el fondo del hero del portal público: fotos (carrusel de
    siempre), uno de los 4 fondos animados por shader (Aurora, Floating
    Lines, Lightfall, Grainient — ver PaginaGimnasio/fondos-animados.js) o
    un color sólido liso. 'estatico' congela el fondo animado en un solo
    cuadro (sin movimiento). Solo Administrador, desde Página Web en
    Recepción.
    """
    if data.tipo not in _TIPOS_FONDO_HERO_VALIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de fondo inválido. Usa uno de: {', '.join(_TIPOS_FONDO_HERO_VALIDOS)}"
        )

    config = {"tipo": data.tipo, "colores": data.colores, "estatico": data.estatico}

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE cms_theme SET hero_fondo = %s, updated_at = NOW() "
            "WHERE is_active = TRUE RETURNING id",
            (json.dumps(config),)
        )
        result = cur.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="No hay tema activo configurado")

    return {"mensaje": "Fondo del hero actualizado", "fondo": config}


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



# =========================================================
# CONTENIDO EDITABLE DEL PORTAL (planes, textos, contacto, promoción)
# Recepción solo edita esto; el aspecto (fondos, tema) lo elige cada
# visitante desde la propia página pública.
# =========================================================
_CONTENIDO_POR_DEFECTO = {
    "textos": {
        "titulo": "¡BIENVENIDO\nAL MEJOR GYM\n#SPASSO!",
        "subtitulo": "El lugar donde el bienestar se encuentra con el lujo. Disfruta de nuestras instalaciones premium diseñadas para tu relajación y salud.",
        "boton_hero": "Conoce Más y Sorpréndete"
    },
    "nav": {
        "inicio": "Inicio", "beneficios": "Beneficios", "gimnasio": "Gimnasio",
        "planes": "Planes", "ubicacion": "Ubicaciones y Contacto"
    },
    "titulos": {
        "beneficios": "BENEFICIOS",
        "beneficios_sub": "Pronto te darás cuenta por qué somos los mejores",
        "gimnasio": "GIMNASIO PREMIUM",
        "planes": "PLANES",
        "planes_sub": "Elige la membresía que mejor se adapte a ti",
        "ubicacion": "UBICACIONES Y CONTACTO"
    },
    "beneficios": [
        {"titulo": "MÁQUINAS\nDE PRIMERA CALIDAD",
         "texto": "Entrena con equipos de **última generación**, pensados para resultados reales."},
        {"titulo": "ATENCIÓN\nTODOS LOS DÍAS",
         "texto": "Abrimos **los 7 días de la semana**, para que entrenes cuando mejor te acomode."},
        {"titulo": "INSTRUCTORES\nDE PRIMER NIVEL",
         "texto": "Nos preocupamos por tu bienestar: seleccionamos y capacitamos **a todo nuestro personal**."}
    ],
    "imagenes": {
        "beneficios": [["logo-mdbuddy.jpg", "logo-insight.png"],
                       ["atencion1.jpg", "atencion2.jpg"],
                       ["instructores1.jpg", "instructores2.jpg"]],
        "gimnasio": ["gym1.jpeg", "gym2.jpeg", "gym3.jpeg", "gym4.jpeg", "gym5.jpeg",
                     "gym6.jpeg", "gym7.jpeg", "gym8.jpeg", "gym9.jpeg"]
    },
    "planes": [
        {"nombre": "Básico", "precio": "120", "periodo": "bs/mes",
         "descripcion": "Ideal para empezar a entrenar sin complicarte.",
         "beneficios": ["Acceso a equipos", "Horario estándar", "1 evaluación mensual"],
         "popular": False},
        {"nombre": "Premium", "precio": "180", "periodo": "bs/mes",
         "descripcion": "Para quienes quieren entrenar sin límites.",
         "beneficios": ["Acceso ilimitado", "2 sesiones con entrenador", "Acceso a clases grupales", "Uso de sauna"],
         "popular": True},
        {"nombre": "VIP", "precio": "200", "periodo": "bs/mes",
         "descripcion": "La experiencia completa, sin restricciones.",
         "beneficios": ["Acceso 24/7", "Entrenador personal", "Acceso a todas las áreas", "Plan nutricional", "2 invitados/mes"],
         "popular": False}
    ],
    "contacto": {
        "ciudad": "Sucre",
        "direccion": "Calle Nestor Galindo N° 1\nesquina Av. Canadá, zona terminal de buses.",
        "telefono": "73415902",
        "correo": "spaziosaunaclub@gmail.com",
        "horario_semana": "5:00 - 23:00",
        "horario_finde": "7:00 - 21:00"
    },
    "promocion": {
        "activa": False,
        "titulo": "",
        "texto": "",
        "vigencia": ""
    }
}


class ContenidoPortalUpdate(BaseModel):
    nav: Optional[dict] = None
    titulos: Optional[dict] = None
    beneficios: Optional[list] = None
    imagenes: Optional[dict] = None
    textos: Optional[dict] = None
    planes: Optional[list] = None
    contacto: Optional[dict] = None
    promocion: Optional[dict] = None


def _limpiar_texto(valor, maximo=300):
    return str(valor or "").strip()[:maximo]


def _leer_contenido_guardado():
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT contenido_portal FROM cms_theme WHERE is_active = TRUE LIMIT 1"
            )
            row = cur.fetchone()
            if row and row[0]:
                return json.loads(row[0])
    except Exception:
        pass
    return {}


@router.get("/contenido")
def obtener_contenido_portal():
    """Contenido editable del portal (público): lo guardado, completando con
    los valores por defecto lo que falte."""
    guardado = _leer_contenido_guardado()
    resultado = json.loads(json.dumps(_CONTENIDO_POR_DEFECTO))
    for clave in ("textos", "contacto", "promocion", "nav", "titulos"):
        if isinstance(guardado.get(clave), dict):
            resultado[clave].update(guardado[clave])
    if isinstance(guardado.get("planes"), list) and guardado["planes"]:
        resultado["planes"] = guardado["planes"]
    if isinstance(guardado.get("beneficios"), list) and len(guardado["beneficios"]) == 3:
        resultado["beneficios"] = guardado["beneficios"]
    if isinstance(guardado.get("imagenes"), dict):
        img = guardado["imagenes"]
        if isinstance(img.get("beneficios"), list) and len(img["beneficios"]) == 3:
            resultado["imagenes"]["beneficios"] = img["beneficios"]
        if isinstance(img.get("gimnasio"), list) and len(img["gimnasio"]) == 9:
            resultado["imagenes"]["gimnasio"] = img["gimnasio"]
    return resultado


@router.put("/contenido")
def guardar_contenido_portal(
    data: ContenidoPortalUpdate,
    usuario=Depends(require_rol(["Administrador"]))
):
    """Guarda planes, textos, contacto y promoción del portal público."""
    actual = obtener_contenido_portal()

    if data.textos is not None:
        actual["textos"] = {
            "titulo": _limpiar_texto(data.textos.get("titulo"), 120),
            "subtitulo": _limpiar_texto(data.textos.get("subtitulo"), 400),
            "boton_hero": _limpiar_texto(data.textos.get("boton_hero"), 60),
        }
    if data.nav is not None:
        actual["nav"] = {k: (_limpiar_texto(data.nav.get(k), 40) or _CONTENIDO_POR_DEFECTO["nav"][k])
                         for k in _CONTENIDO_POR_DEFECTO["nav"]}
    if data.titulos is not None:
        actual["titulos"] = {k: _limpiar_texto(data.titulos.get(k), 120)
                             for k in _CONTENIDO_POR_DEFECTO["titulos"]}
    if data.beneficios is not None:
        if len(data.beneficios) != 3:
            raise HTTPException(status_code=400, detail="Deben ser 3 beneficios")
        actual["beneficios"] = [
            {"titulo": _limpiar_texto(b.get("titulo"), 80), "texto": _limpiar_texto(b.get("texto"), 220)}
            for b in data.beneficios if isinstance(b, dict)
        ]
        if len(actual["beneficios"]) != 3:
            raise HTTPException(status_code=400, detail="Beneficios inválidos")
    if data.imagenes is not None:
        disponibles = set(_listar_archivos_imagenes())
        ben = data.imagenes.get("beneficios") or []
        gym = data.imagenes.get("gimnasio") or []
        if len(ben) != 3 or any(not isinstance(x, list) or len(x) != 2 for x in ben) or len(gym) != 9:
            raise HTTPException(status_code=400, detail="Estructura de imágenes inválida")
        todas = [f for par in ben for f in par] + list(gym)
        faltan = [f for f in todas if f not in disponibles]
        if faltan:
            raise HTTPException(status_code=400, detail=f"Imágenes inexistentes: {', '.join(faltan)}")
        actual["imagenes"] = {"beneficios": ben, "gimnasio": gym}
    if data.contacto is not None:
        actual["contacto"] = {
            k: _limpiar_texto(data.contacto.get(k), 200)
            for k in ("ciudad", "direccion", "telefono", "correo",
                      "horario_semana", "horario_finde")
        }
    if data.promocion is not None:
        actual["promocion"] = {
            "activa": bool(data.promocion.get("activa")),
            "titulo": _limpiar_texto(data.promocion.get("titulo"), 100),
            "texto": _limpiar_texto(data.promocion.get("texto"), 300),
            "vigencia": _limpiar_texto(data.promocion.get("vigencia"), 80),
        }
    if data.planes is not None:
        planes = []
        for p in data.planes[:8]:
            if not isinstance(p, dict):
                continue
            nombre = _limpiar_texto(p.get("nombre"), 40)
            if not nombre:
                continue
            beneficios = [
                _limpiar_texto(b, 80) for b in (p.get("beneficios") or [])
                if _limpiar_texto(b, 80)
            ][:10]
            planes.append({
                "nombre": nombre,
                "precio": _limpiar_texto(p.get("precio"), 12),
                "periodo": _limpiar_texto(p.get("periodo"), 20) or "bs/mes",
                "descripcion": _limpiar_texto(p.get("descripcion"), 140),
                "beneficios": beneficios,
                "popular": bool(p.get("popular")),
            })
        if not planes:
            raise HTTPException(status_code=400, detail="Debe haber al menos un plan")
        actual["planes"] = planes

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE cms_theme SET contenido_portal = %s, updated_at = NOW() "
            "WHERE is_active = TRUE RETURNING id",
            (json.dumps(actual, ensure_ascii=False),)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="No hay tema activo configurado")
    return {"mensaje": "Contenido del portal guardado", "contenido": actual}


@router.post("/imagenes/subir")
async def subir_imagen_portal(
    archivo: UploadFile = File(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """Sube una imagen a PaginaGimnasio/img SIN agregarla al carrusel (para
    usarla en Beneficios o Gimnasio). Solo Administrador."""
    nombre = _nombre_archivo_seguro(archivo.filename or "")
    if not nombre or not nombre.lower().endswith(_EXTENSIONES_IMG_PERMITIDAS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no soportado. Usa: {', '.join(_EXTENSIONES_IMG_PERMITIDAS)}"
        )
    contenido = await archivo.read()
    if len(contenido) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen supera 8 MB")
    os.makedirs(_IMG_DIR, exist_ok=True)
    with open(os.path.join(_IMG_DIR, nombre), "wb") as f:
        f.write(contenido)
    return {"archivo": nombre}
