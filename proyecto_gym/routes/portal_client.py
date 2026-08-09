"""
routes/portal_client.py - Endpoints del Dashboard del Socio

Proporciona acceso a la información personal del socio:
- Plan actual y vigencia
- Rutinas de entrenamiento disponibles
- Historial de visitas
- Configuración de su perfil
"""
from fastapi import APIRouter, HTTPException, status, Depends
from database import get_db
from routes.portal_auth import get_current_socio
import json

router = APIRouter(prefix="/api/portal", tags=["Portal Cliente"])


@router.get("/me/plan")
def obtener_plan_actual(socio=Depends(get_current_socio)):
    """
    Obtiene el plan activo del socio con información de vigencia.
    Muestra si está activo, próximo a vencer, o vencido.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()
        # Buscar el plan activo más reciente del socio
        cur.execute(
            """
            SELECT v.id_venta, p.id_plan, p.nombre_plan, p.precio_base, p.duracion_dias,
                   v.fecha_venta, 
                   (v.fecha_venta + (p.duracion_dias || ' days')::interval)::date as fecha_vencimiento,
                   CASE 
                       WHEN (v.fecha_venta + (p.duracion_dias || ' days')::interval) > NOW() THEN 'activo'
                       WHEN (v.fecha_venta + (p.duracion_dias || ' days')::interval) <= NOW() THEN 'vencido'
                       ELSE 'vigencia_proxima'
                   END as estado_plan
            FROM ventas v
            JOIN venta_items vi ON v.id_venta = vi.id_venta
            JOIN planes p ON vi.id_item = p.id_plan
            WHERE v.id_socio = %s AND vi.tipo_item = 'plan'
            ORDER BY v.fecha_venta DESC
            LIMIT 1
            """,
            (id_socio,)
        )
        plan_row = cur.fetchone()

    if not plan_row:
        return {
            "id_socio": id_socio,
            "plan": None,
            "mensaje": "No tienes un plan activo en el gimnasio"
        }

    id_venta, id_plan, nombre_plan, precio_base, duracion_dias, fecha_venta, fecha_vencimiento, estado = plan_row

    return {
        "id_socio": id_socio,
        "plan": {
            "id_plan": id_plan,
            "nombre_plan": nombre_plan,
            "precio_base": float(precio_base),
            "duracion_dias": duracion_dias,
            "fecha_inicio": fecha_venta.isoformat() if fecha_venta else None,
            "fecha_vencimiento": fecha_vencimiento.isoformat() if fecha_vencimiento else None,
            "estado": estado,
            "dias_restantes": (fecha_vencimiento - fecha_venta.date()).days if fecha_vencimiento and fecha_venta else None
        }
    }


@router.get("/me/routines")
def obtener_rutinas_disponibles(
    socio=Depends(get_current_socio),
    nivel: str = None
):
    """
    Obtiene las rutinas de entrenamiento disponibles para el socio.
    Opcionalmente filtra por nivel: 'principiante', 'intermedio', 'avanzado'.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()

        # Si especifica nivel, filtrar; si no, obtener todas
        if nivel and nivel in ['principiante', 'intermedio', 'avanzado']:
            cur.execute(
                """
                SELECT id_rutina, nombre_rutina, nivel, descripcion, ejercicios
                FROM workout_routines
                WHERE nivel = %s
                ORDER BY nombre_rutina
                """,
                (nivel,)
            )
        else:
            cur.execute(
                """
                SELECT id_rutina, nombre_rutina, nivel, descripcion, ejercicios
                FROM workout_routines
                ORDER BY nivel, nombre_rutina
                """
            )

        routines = cur.fetchall()

    result = []
    for row in routines:
        id_rutina, nombre_rutina, nivel, descripcion, ejercicios_json = row
        
        # Parsear JSONB
        ejercicios = json.loads(ejercicios_json) if isinstance(ejercicios_json, str) else ejercicios_json

        result.append({
            "id_rutina": id_rutina,
            "nombre_rutina": nombre_rutina,
            "nivel": nivel,
            "descripcion": descripcion,
            "ejercicios": ejercicios
        })

    return {
        "id_socio": id_socio,
        "routines": result,
        "total": len(result),
        "filtro_nivel": nivel or "todas"
    }


@router.get("/me/routine/{id_rutina}")
def obtener_rutina_detalle(
    id_rutina: int,
    socio=Depends(get_current_socio)
):
    """
    Obtiene el detalle completo de una rutina específica.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_rutina, nombre_rutina, nivel, descripcion, ejercicios
            FROM workout_routines
            WHERE id_rutina = %s
            """,
            (id_rutina,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    id_rutina, nombre_rutina, nivel, descripcion, ejercicios_json = row
    ejercicios = json.loads(ejercicios_json) if isinstance(ejercicios_json, str) else ejercicios_json

    return {
        "id_socio": id_socio,
        "rutina": {
            "id_rutina": id_rutina,
            "nombre_rutina": nombre_rutina,
            "nivel": nivel,
            "descripcion": descripcion,
            "ejercicios": ejercicios
        }
    }


@router.get("/me/visits")
def obtener_historial_visitas(
    socio=Depends(get_current_socio),
    limite: int = 20,
    pagina: int = 1
):
    """
    Obtiene el historial de visitas del socio con paginación.
    """
    id_socio = socio.get("id_socio")
    offset = (pagina - 1) * limite

    with get_db() as conn:
        cur = conn.cursor()
        
        # Total de visitas
        cur.execute(
            "SELECT COUNT(*) FROM asistencias_log WHERE id_socio = %s",
            (id_socio,)
        )
        total_visitas = cur.fetchone()[0]

        # Visitas con paginación
        cur.execute(
            """
            SELECT id_log, fecha_entrada, fecha_salida
            FROM asistencias_log
            WHERE id_socio = %s
            ORDER BY fecha_entrada DESC
            LIMIT %s OFFSET %s
            """,
            (id_socio, limite, offset)
        )
        visitas = cur.fetchall()

    return {
        "id_socio": id_socio,
        "total_visitas": total_visitas,
        "pagina": pagina,
        "por_pagina": limite,
        "visitas": [
            {
                "id_log": row[0],
                "fecha_entrada": row[1].isoformat() if row[1] else None,
                "fecha_salida": row[2].isoformat() if row[2] else None,
                "duracion_minutos": (row[2] - row[1]).total_seconds() / 60 if row[1] and row[2] else None
            }
            for row in visitas
        ]
    }


@router.get("/me/stats")
def obtener_estadisticas_socio(socio=Depends(get_current_socio)):
    """
    Obtiene estadísticas del socio: total visitas, promedio por semana, etc.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT 
                COUNT(*) as total_visitas,
                MAX(fecha_entrada) as ultima_visita,
                MIN(fecha_entrada) as primera_visita,
                AVG(EXTRACT(EPOCH FROM (fecha_salida - fecha_entrada))/60)::int as promedio_duracion_minutos
            FROM asistencias_log
            WHERE id_socio = %s
            """,
            (id_socio,)
        )
        stats = cur.fetchone()

    total_visitas, ultima_visita, primera_visita, promedio_duracion = stats or (0, None, None, None)

    return {
        "id_socio": id_socio,
        "estadisticas": {
            "total_visitas": total_visitas or 0,
            "ultima_visita": ultima_visita.isoformat() if ultima_visita else None,
            "primera_visita": primera_visita.isoformat() if primera_visita else None,
            "promedio_duracion_minutos": promedio_duracion or 0
        }
    }


@router.get("/me/locker")
def obtener_locker_asignado(socio=Depends(get_current_socio)):
    """
    Obtiene la información del locker asignado al socio, si existe.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_locker, numero_locker, zona, estado
            FROM lockers
            WHERE id_socio_actual = %s
            """,
            (id_socio,)
        )
        locker = cur.fetchone()

    if not locker:
        return {
            "id_socio": id_socio,
            "locker": None,
            "mensaje": "No tienes un locker asignado"
        }

    id_locker, numero_locker, zona, estado = locker

    return {
        "id_socio": id_socio,
        "locker": {
            "id_locker": id_locker,
            "numero_locker": numero_locker,
            "zona": zona,
            "estado": estado
        }
    }
