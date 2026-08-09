"""
routes/asistencias.py - Registro de ingresos al gimnasio
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import get_db
from schemas import AsistenciaCreate, AsistenciaResponse
from dependencies import require_rol
from datetime import date, datetime, timedelta

router = APIRouter(prefix="/api/asistencias", tags=["Asistencias"])


@router.get("/stats")
def estadisticas_asistencias(
    periodo: str = Query("mes", description="dia, semana o mes"),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Obtiene estadísticas de asistencias para un período.
    Parámetros: periodo = 'dia', 'semana' o 'mes'
    """
    with get_db() as conn:
        cur = conn.cursor()
        hoy = date.today()
        
        # Determinar rango de fechas según período
        if periodo == "dia":
            fecha_inicio = hoy
        elif periodo == "semana":
            fecha_inicio = hoy - timedelta(days=hoy.weekday())  # Lunes de esta semana
        elif periodo == "mes":
            fecha_inicio = date(hoy.year, hoy.month, 1)
        else:
            fecha_inicio = date(hoy.year, hoy.month, 1)  # Por defecto mes

        # Total de asistencias en el período
        cur.execute(
            """
            SELECT COUNT(*) as total_asistencias
            FROM asistencias_log
            WHERE fecha_entrada::date >= %s AND fecha_entrada::date <= %s
            """,
            (fecha_inicio, hoy)
        )
        total = cur.fetchone()[0] or 0

        # Asistencias de hoy
        cur.execute(
            """
            SELECT COUNT(*) as total_hoy
            FROM asistencias_log
            WHERE fecha_entrada::date = %s
            """,
            (hoy,)
        )
        hoy_count = cur.fetchone()[0] or 0

        # Promedio diario
        dias_transcurridos = (hoy - fecha_inicio).days + 1
        promedio_diario = total / dias_transcurridos if dias_transcurridos > 0 else 0

    return {
        "periodo": periodo,
        "fecha_inicio": fecha_inicio.isoformat(),
        "fecha_fin": hoy.isoformat(),
        "total_asistencias": total,
        "asistencias_hoy": hoy_count,
        "promedio_diario": round(promedio_diario, 2)
    }


@router.post("/", response_model=AsistenciaResponse, status_code=status.HTTP_201_CREATED)
def registrar_ingreso(
    data: AsistenciaCreate,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Registra el ingreso de un atleta buscando por DNI.
    Flujo de recepción: escanear/ingresar DNI → confirmar identidad → registrar.
    """
    with get_db() as conn:
        cur = conn.cursor()

        # Buscar el socio por DNI
        cur.execute(
            "SELECT id_socio, nombres, apellidos FROM socios WHERE dni = %s",
            (data.dni_socio.upper(),)
        )
        socio = cur.fetchone()

        if not socio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No se encontró ningún atleta con el DNI {data.dni_socio}"
            )

        id_socio, nombres, apellidos = socio

        # Registrar la asistencia
        # id_hardware = 1 corresponde al lector de huella DigitalPersona 4500 del seed
        cur.execute(
            """
            INSERT INTO asistencias_log (id_socio, id_hardware)
            VALUES (%s, 1)
            RETURNING id_log, fecha_entrada
            """,
            (id_socio,)
        )
        log = cur.fetchone()

    return {
        "id_log": log[0],
        "id_socio": id_socio,
        "nombres": nombres,
        "apellidos": apellidos,
        "fecha_entrada": log[1],
    }


@router.get("/hoy")
def asistencias_hoy(
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Retorna la lista de todos los ingresos del día actual.
    Útil para el panel de recepción: 'Ver clientes del día'.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT a.id_log, s.nombres, s.apellidos, s.dni, a.fecha_entrada
            FROM asistencias_log a
            JOIN socios s ON a.id_socio = s.id_socio
            WHERE a.fecha_entrada::date = CURRENT_DATE
            ORDER BY a.fecha_entrada DESC
            """,
        )
        rows = cur.fetchall()
        cur.execute(
            "SELECT COUNT(*) FROM asistencias_log WHERE fecha_entrada::date = CURRENT_DATE"
        )
        total_hoy = cur.fetchone()[0]

    return {
        "fecha": date.today().isoformat(),
        "total_ingresos": total_hoy,
        "ingresos": [
            {
                "id_log": r[0],
                "nombres": r[1],
                "apellidos": r[2],
                "dni": r[3],
                "hora_entrada": r[4].strftime("%H:%M:%S"),
            }
            for r in rows
        ]
    }


def _turno_de(fecha_entrada) -> str:
    hora = fecha_entrada.hour
    if hora < 12:
        return "Mañana"
    if hora < 18:
        return "Tarde"
    return "Noche"


def _duracion_de(fecha_entrada, fecha_salida) -> str:
    if not fecha_salida:
        return "En curso"
    # fecha_entrada puede venir sin zona horaria (columna TIMESTAMP original)
    # mientras que fecha_salida sí la tiene (columna TIMESTAMPTZ agregada en
    # la migración 008) — Python no permite restar un datetime "naive" con
    # uno "aware" directamente, así que se igualan quitando la zona de ambos
    # antes de restar (para la duración solo importa la diferencia, no la zona).
    if fecha_salida.tzinfo is not None:
        fecha_salida = fecha_salida.replace(tzinfo=None)
    if fecha_entrada.tzinfo is not None:
        fecha_entrada = fecha_entrada.replace(tzinfo=None)
    segundos = (fecha_salida - fecha_entrada).total_seconds()
    if segundos < 0:
        return "En curso"
    horas = int(segundos // 3600)
    minutos = int((segundos % 3600) // 60)
    if horas > 0:
        return f"{horas}h {minutos}min"
    return f"{minutos}min"


@router.get("/historial")
def historial_asistencias(
    periodo: str = Query("hoy", description="hoy, ayer, semana o mes"),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Historial de asistencias con locker asignado, hora de salida, turno y
    duración — para la tabla "Historial de Asistencias del Día" en el
    módulo de Asistencia (que antes se quedaba vacía porque nunca se
    conectó a ningún endpoint real).
    """
    with get_db() as conn:
        cur = conn.cursor()
        hoy = date.today()

        if periodo == "ayer":
            fecha_inicio = hoy - timedelta(days=1)
            fecha_fin = fecha_inicio
        elif periodo == "semana":
            fecha_inicio = hoy - timedelta(days=hoy.weekday())
            fecha_fin = hoy
        elif periodo == "mes":
            fecha_inicio = date(hoy.year, hoy.month, 1)
            fecha_fin = hoy
        else:  # "hoy" o cualquier valor no reconocido
            fecha_inicio = hoy
            fecha_fin = hoy

        cur.execute(
            """
            SELECT a.id_log, s.nombres, s.apellidos, s.dni,
                   a.fecha_entrada, a.fecha_salida,
                   l.numero_locker, l.zona
            FROM asistencias_log a
            JOIN socios s ON a.id_socio = s.id_socio
            LEFT JOIN gestion_lockers l ON a.id_locker = l.id_locker
            WHERE a.fecha_entrada::date >= %s AND a.fecha_entrada::date <= %s
            ORDER BY a.fecha_entrada DESC
            """,
            (fecha_inicio, fecha_fin)
        )
        rows = cur.fetchall()

    return {
        "periodo": periodo,
        "fecha_inicio": fecha_inicio.isoformat(),
        "fecha_fin": fecha_fin.isoformat(),
        "total": len(rows),
        "registros": [
            {
                "id_log": r[0],
                "nombres": r[1],
                "apellidos": r[2],
                "dni": r[3],
                "fecha_entrada": r[4].isoformat() if r[4] else None,
                "hora_entrada": r[4].strftime("%H:%M:%S") if r[4] else None,
                "hora_salida": r[5].strftime("%H:%M:%S") if r[5] else None,
                "numero_locker": r[6],
                "zona_locker": r[7],
                "turno": _turno_de(r[4]) if r[4] else None,
                "duracion": _duracion_de(r[4], r[5]) if r[4] else None,
            }
            for r in rows
        ]
    }
