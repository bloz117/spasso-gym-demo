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
from datetime import date, datetime
import json
import psycopg2

router = APIRouter(prefix="/api/portal", tags=["Portal Cliente"])


def _duracion_minutos_segura(fecha_entrada, fecha_salida):
    """
    Resta dos datetimes de asistencias_log tolerando que uno tenga
    tzinfo y el otro no (columna mixta: registros viejos guardados sin
    zona horaria y registros nuevos del biométrico que sí la traen).
    Python no deja restar un datetime "aware" con uno "naive"
    directamente (TypeError), así que se les quita la tzinfo a ambos
    antes de restar - para la duración en minutos no importa la zona.
    """
    if not fecha_entrada or not fecha_salida:
        return None
    if fecha_entrada.tzinfo is not None:
        fecha_entrada = fecha_entrada.replace(tzinfo=None)
    if fecha_salida.tzinfo is not None:
        fecha_salida = fecha_salida.replace(tzinfo=None)
    return (fecha_salida - fecha_entrada).total_seconds() / 60


@router.get("/me/plan")
def obtener_plan_actual(socio=Depends(get_current_socio)):
    """
    Obtiene el plan activo del socio con información de vigencia.
    Muestra si está activo, próximo a vencer, o vencido.
    """
    id_socio = socio.get("id_socio")

    with get_db() as conn:
        cur = conn.cursor()
        # Buscar la membresía vigente más reciente del socio (misma tabla y
        # criterio que usa Recepción: routes/socios.py).
        cur.execute(
            """
            SELECT id_membresia, tipo_membresia, plan, fecha_inicio, fecha_vencimiento, estado, monto
            FROM membresias
            WHERE id_socio = %s AND estado <> 'retirado'
            ORDER BY fecha_vencimiento DESC
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

    id_membresia, tipo_membresia, nombre_plan, fecha_inicio, fecha_vencimiento, estado, monto = plan_row

    # fecha_vencimiento puede venir como datetime (timestamp) o como date
    # según la columna; se normaliza a date antes de comparar/restar.
    fecha_venc_dia = fecha_vencimiento.date() if isinstance(fecha_vencimiento, datetime) else fecha_vencimiento

    hoy = date.today()
    if fecha_venc_dia and fecha_venc_dia < hoy:
        estado_plan = 'vencido'
    else:
        estado_plan = 'activo'

    return {
        "id_socio": id_socio,
        "plan": {
            "id_membresia": id_membresia,
            "nombre_plan": nombre_plan,
            "tipo_membresia": tipo_membresia,
            "precio_base": float(monto) if monto is not None else None,
            "fecha_inicio": fecha_inicio.isoformat() if fecha_inicio else None,
            "fecha_vencimiento": fecha_vencimiento.isoformat() if fecha_vencimiento else None,
            "estado": estado_plan,
            "dias_restantes": (fecha_venc_dia - hoy).days if fecha_venc_dia else None
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
                "duracion_minutos": _duracion_minutos_segura(row[1], row[2])
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
                AVG(EXTRACT(EPOCH FROM (fecha_salida::timestamp - fecha_entrada::timestamp))/60)::int as promedio_duracion_minutos
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

    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id_locker, numero_locker, zona, estado
                FROM gestion_lockers
                WHERE id_socio_actual = %s
                """,
                (id_socio,)
            )
            locker = cur.fetchone()
    except psycopg2.errors.UndefinedTable:
        # El módulo de Lockers no está habilitado/migrado en este
        # gimnasio (la tabla "lockers" no existe todavía). No es un
        # error del socio: simplemente no tiene casillero que mostrar.
        return {
            "id_socio": id_socio,
            "locker": None,
            "mensaje": "El módulo de casilleros no está disponible en este gimnasio"
        }

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


from rutina_util import solo_ejercicios_nuevos  # noqa: E402


@router.get("/me/rutina-entrenador")
def obtener_rutina_entrenador(socio=Depends(get_current_socio)):
    """Rutina semanal publicada por el entrenador, si el plan del socio la incluye."""
    id_socio = socio.get("id_socio")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT EXISTS (SELECT 1 FROM entrenador_socios WHERE id_socio = %s),
                   r.contenido, r.publicada, r.actualizado_en
            FROM (SELECT 1) x
            LEFT JOIN rutinas_socio r ON r.id_socio = %s
            """,
            (id_socio, id_socio)
        )
        fila = cur.fetchone()
    if not fila or not fila[0]:
        return {"incluida": False}
    if not fila[1] or not fila[2]:
        return {"incluida": True, "rutina": None}
    return {
        "incluida": True,
        "rutina": solo_ejercicios_nuevos(json.loads(fila[1])),
        "actualizada": fila[3].isoformat() if fila[3] else None,
    }


# ----------------------------------------------------------------------
# Datos físicos del socio (para que el entrenador arme su rutina)
# ----------------------------------------------------------------------
ACTIVIDADES = ("sedentario", "ligero", "activo", "muy_activo")
OBJETIVOS = ("bajar_grasa", "ganar_musculo", "tonificar", "resistencia", "salud")


def _num(v, minimo, maximo, nombre):
    if v in (None, ""):
        return None
    try:
        n = round(float(v), 1)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"{nombre} inválido")
    if n < minimo or n > maximo:
        raise HTTPException(status_code=422, detail=f"{nombre} fuera de rango ({minimo}-{maximo})")
    return n


@router.get("/me/perfil-fisico")
def obtener_perfil_fisico(socio=Depends(get_current_socio)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT estatura_cm, peso_kg, actividad, objetivo, dias_semana, lesiones, actualizado_en, peso_inicial_kg, desde "
            "FROM perfil_fisico_socio WHERE id_socio = %s",
            (socio.get("id_socio"),),
        )
        r = cur.fetchone()
    if not r:
        return {"perfil": None}
    return {"perfil": {
        "estatura_cm": float(r[0]) if r[0] is not None else None,
        "peso_kg": float(r[1]) if r[1] is not None else None,
        "actividad": r[2], "objetivo": r[3], "dias_semana": r[4], "lesiones": r[5] or "",
        "actualizado": r[6].isoformat() if r[6] else None,
        "peso_inicial_kg": float(r[7]) if r[7] is not None else (float(r[1]) if r[1] is not None else None),
        "desde": r[8].isoformat() if r[8] else (r[6].isoformat() if r[6] else None),
    }}


@router.put("/me/perfil-fisico")
def guardar_perfil_fisico(data: dict, socio=Depends(get_current_socio)):
    estatura = _num(data.get("estatura_cm"), 100, 250, "Estatura")
    peso = _num(data.get("peso_kg"), 30, 300, "Peso")
    actividad = data.get("actividad") or None
    objetivo = data.get("objetivo") or None
    if actividad and actividad not in ACTIVIDADES:
        raise HTTPException(status_code=422, detail="Nivel de actividad inválido")
    if objetivo and objetivo not in OBJETIVOS:
        raise HTTPException(status_code=422, detail="Objetivo inválido")
    try:
        dias = int(data.get("dias_semana")) if data.get("dias_semana") not in (None, "") else None
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Días por semana inválido")
    if dias is not None and not (1 <= dias <= 7):
        raise HTTPException(status_code=422, detail="Días por semana debe ser entre 1 y 7")
    lesiones = str(data.get("lesiones") or "").strip()[:300]
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO perfil_fisico_socio (id_socio, estatura_cm, peso_kg, actividad, objetivo, dias_semana, lesiones, actualizado_en, peso_inicial_kg, desde)
            VALUES (%s, %s, %s, %s, %s, %s, %s, now(), %s, now())
            ON CONFLICT (id_socio) DO UPDATE SET
                estatura_cm = EXCLUDED.estatura_cm, peso_kg = EXCLUDED.peso_kg,
                actividad = EXCLUDED.actividad, objetivo = EXCLUDED.objetivo,
                dias_semana = EXCLUDED.dias_semana, lesiones = EXCLUDED.lesiones,
                actualizado_en = now(),
                peso_inicial_kg = COALESCE(perfil_fisico_socio.peso_inicial_kg, EXCLUDED.peso_inicial_kg),
                desde = COALESCE(perfil_fisico_socio.desde, EXCLUDED.desde)
            """,
            (socio.get("id_socio"), estatura, peso, actividad, objetivo, dias, lesiones, peso),
        )
    return {"mensaje": "Datos guardados"}


@router.get("/me/pulso")
def pulso_socio(socio=Depends(get_current_socio)):
    """
    "Firma" muy liviana del estado del socio (asistencias, casillero, membresía).
    El portal la consulta cada ~2 s y solo vuelve a pedir los datos completos
    cuando la firma cambia (así se ve al instante lo que pasa en Recepción).
    Una sola consulta SQL (un solo viaje a la base de datos).
    """
    id_socio = socio.get("id_socio")
    sql_asist = (
        "(SELECT COALESCE(MAX(id_log), 0) || ',' || COUNT(*) || ',' || COUNT(fecha_salida) || ',' || "
        "COALESCE(MAX(id_locker)::text, '-') FROM asistencias_log WHERE id_socio = %(s)s)"
    )
    sql_memb = (
        "(SELECT COALESCE(id_membresia::text, '') || ',' || COALESCE(fecha_vencimiento::text, '') || ',' || "
        "COALESCE(estado, '') || ',' || COALESCE(plan, '') FROM membresias "
        "WHERE id_socio = %(s)s AND estado <> 'retirado' ORDER BY fecha_vencimiento DESC LIMIT 1)"
    )
    sql_lock = "(SELECT id_locker::text FROM gestion_lockers WHERE id_socio_actual = %(s)s LIMIT 1)"
    with get_db() as conn:
        cur = conn.cursor()
        try:
            cur.execute(f"SELECT {sql_asist}, {sql_lock}, {sql_memb}", {"s": id_socio})
        except psycopg2.errors.UndefinedTable:
            # Módulo de casilleros no migrado: la firma sigue funcionando sin él.
            conn.rollback()
            cur = conn.cursor()
            cur.execute(f"SELECT {sql_asist}, NULL, {sql_memb}", {"s": id_socio})
        a, lk, m = cur.fetchone()
    return {"v": "|".join([a or "-", lk or "-", m or "-"])}
