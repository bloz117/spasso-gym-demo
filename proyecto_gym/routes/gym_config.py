"""
routes/gym_config.py - Endpoints de Configuración del Gimnasio

Gestiona la configuración global del gimnasio:
- Nombre y datos generales
- Habilitación/deshabilitación de lockers
- Cantidad de lockers
- Horarios
"""
from fastapi import APIRouter, HTTPException, status, Depends
from database import get_db
from schemas import GymConfigResponse, GymConfigUpdate
from dependencies import require_rol
from psycopg2.extras import Json

router = APIRouter(prefix="/api/gym", tags=["Configuración"])


@router.get("/config")
def obtener_configuracion():
    """
    Obtiene la configuración actual del gimnasio.
    Endpoint público (sin autenticación).
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_config, nombre_gimnasio, lockers_habilitados, cantidad_lockers,
                   horario_apertura, horario_cierre, precios_planes,
                   asignacion_lockers_automatica, pantalla_bienvenida_habilitada,
                   duracion_pantalla_bienvenida, pantalla_bienvenida_logo_url,
                   pantalla_bienvenida_tema
            FROM gym_config
            LIMIT 1
            """
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Configuración del gimnasio no encontrada. Contacta al administrador."
        )

    id_config, nombre_gimnasio, lockers_habilitados, cantidad_lockers, \
        horario_apertura, horario_cierre, precios_planes, asignacion_lockers_automatica, \
        pantalla_bienvenida_habilitada, duracion_pantalla_bienvenida, \
        pantalla_bienvenida_logo_url, pantalla_bienvenida_tema = row

    return {
        "id_config": id_config,
        "nombre_gimnasio": nombre_gimnasio,
        "lockers_habilitados": lockers_habilitados,
        "cantidad_lockers": cantidad_lockers,
        "horario_apertura": horario_apertura,
        "horario_cierre": horario_cierre,
        "precios_planes": precios_planes or {},
        "asignacion_lockers_automatica": bool(asignacion_lockers_automatica),
        "pantalla_bienvenida_habilitada": bool(pantalla_bienvenida_habilitada),
        "duracion_pantalla_bienvenida": duracion_pantalla_bienvenida or 4,
        "pantalla_bienvenida_logo_url": pantalla_bienvenida_logo_url,
        "pantalla_bienvenida_tema": pantalla_bienvenida_tema or "azul"
    }


@router.get("/config/lockers-status")
def obtener_estado_lockers():
    """
    Obtiene el estado de los lockers: cuántos hay disponibles, ocupados, etc.
    Endpoint público.
    """
    with get_db() as conn:
        cur = conn.cursor()
        
        # Obtener configuración
        cur.execute(
            "SELECT lockers_habilitados, cantidad_lockers FROM gym_config LIMIT 1"
        )
        config = cur.fetchone()

        if not config:
            raise HTTPException(status_code=404, detail="Configuración no encontrada")

        lockers_habilitados, cantidad_lockers = config

        # Obtener estadísticas de lockers
        cur.execute(
            """
            SELECT 
                COUNT(CASE WHEN id_socio_actual IS NULL THEN 1 END) as disponibles,
                COUNT(CASE WHEN id_socio_actual IS NOT NULL THEN 1 END) as ocupados,
                COUNT(*) as total
            FROM lockers
            """
        )
        stats = cur.fetchone()
        disponibles, ocupados, total = stats

    return {
        "lockers_habilitados": lockers_habilitados,
        "estadisticas": {
            "disponibles": disponibles,
            "ocupados": ocupados,
            "total": total,
            "porcentaje_ocupacion": (ocupados / total * 100) if total > 0 else 0
        }
    }


@router.put("/config")
def actualizar_configuracion(
    data: GymConfigUpdate,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Actualiza la configuración del gimnasio.
    Solo Administrador.
    """
    with get_db() as conn:
        cur = conn.cursor()

        # Construir actualización dinámicamente
        updates = []
        params = []

        if data.nombre_gimnasio is not None:
            updates.append("nombre_gimnasio = %s")
            params.append(data.nombre_gimnasio)

        if data.lockers_habilitados is not None:
            updates.append("lockers_habilitados = %s")
            params.append(data.lockers_habilitados)

        if data.cantidad_lockers is not None:
            updates.append("cantidad_lockers = %s")
            params.append(data.cantidad_lockers)

        if data.horario_apertura is not None:
            updates.append("horario_apertura = %s")
            params.append(data.horario_apertura)

        if data.horario_cierre is not None:
            updates.append("horario_cierre = %s")
            params.append(data.horario_cierre)

        if data.precios_planes is not None:
            updates.append("precios_planes = %s")
            params.append(Json(data.precios_planes))

        if data.asignacion_lockers_automatica is not None:
            updates.append("asignacion_lockers_automatica = %s")
            params.append(data.asignacion_lockers_automatica)

        if data.pantalla_bienvenida_habilitada is not None:
            updates.append("pantalla_bienvenida_habilitada = %s")
            params.append(data.pantalla_bienvenida_habilitada)

        if data.duracion_pantalla_bienvenida is not None:
            updates.append("duracion_pantalla_bienvenida = %s")
            params.append(data.duracion_pantalla_bienvenida)

        if data.pantalla_bienvenida_logo_url is not None:
            updates.append("pantalla_bienvenida_logo_url = %s")
            params.append(data.pantalla_bienvenida_logo_url)

        if data.pantalla_bienvenida_tema is not None:
            updates.append("pantalla_bienvenida_tema = %s")
            params.append(data.pantalla_bienvenida_tema)

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay campos para actualizar"
            )

        # Actualizar solo el primer registro (hay uno único)
        cur.execute(
            """
            UPDATE gym_config 
            SET """ + ", ".join(updates) + """
            RETURNING id_config
            """,
            params
        )

        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="No se pudo actualizar la configuración")

    return obtener_configuracion()


@router.post("/config/toggle-lockers")
def alternar_lockers(
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Activa/desactiva la funcionalidad de lockers en el gimnasio.
    Invierte el estado actual.
    """
    with get_db() as conn:
        cur = conn.cursor()
        
        # Obtener estado actual
        cur.execute("SELECT lockers_habilitados FROM gym_config LIMIT 1")
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Configuración no encontrada")

        estado_actual = row[0]
        nuevo_estado = not estado_actual

        # Actualizar
        cur.execute(
            "UPDATE gym_config SET lockers_habilitados = %s",
            (nuevo_estado,)
        )

    return {
        "mensaje": "Estado de lockers actualizado",
        "lockers_habilitados": nuevo_estado
    }


@router.get("/health")
def health_check_gym():
    """
    Verifica que la configuración del gimnasio existe y es accesible.
    Útil para healthchecks del frontend.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_config FROM gym_config LIMIT 1")
        exists = cur.fetchone() is not None

    return {
        "status": "ok" if exists else "configuracion_incompleta",
        "gimnasio_configurado": exists
    }
