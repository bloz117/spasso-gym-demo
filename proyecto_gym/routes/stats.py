"""
routes/stats.py - Estadísticas y dashboard del sistema
"""
from fastapi import APIRouter, Depends
from database import get_db
from dependencies import require_rol
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/stats", tags=["Estadísticas"])


@router.get("/dashboard")
def obtener_dashboard_stats(
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Obtiene las estadísticas principales del dashboard:
    - Miembros activos
    - Asistencias de hoy
    - Lockers ocupados
    - Ingresos del día
    """
    with get_db() as conn:
        cur = conn.cursor()
        hoy = datetime.now().date().isoformat()
        
        # Miembros activos
        cur.execute(
            """
            SELECT COUNT(*) FROM membresias
            WHERE estado = 'activo'
            AND fecha_vencimiento > NOW()
            """
        )
        miembros_activos = cur.fetchone()[0]
        
        # Asistencias de hoy
        cur.execute(
            """
            SELECT COUNT(*) FROM asistencias
            WHERE DATE(fecha_ingreso) = %s
            """,
            (hoy,)
        )
        asistencias_hoy = cur.fetchone()[0]
        
        # Lockers ocupados
        cur.execute(
            """
            SELECT COUNT(*) FROM lockers
            WHERE ocupado = TRUE
            """
        )
        lockers_ocupados = cur.fetchone()[0]
        
        # Ingresos de hoy (membresías + ventas)
        cur.execute(
            """
            SELECT COALESCE(SUM(monto), 0) FROM movimientos_dinero
            WHERE DATE(fecha) = %s AND tipo_movimiento = 'ingreso'
            """,
            (hoy,)
        )
        ingresos_hoy = cur.fetchone()[0] or 0
        
    return {
        "miembros_activos": miembros_activos,
        "asistencias_hoy": asistencias_hoy,
        "lockers_ocupados": lockers_ocupados,
        "ingresos_hoy": float(ingresos_hoy),
        "fecha": hoy
    }


@router.get("/ingresos-mensuales")
def ingresos_mensuales(
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Ingresos reales de los últimos 6 meses (suma de todas las ventas
    registradas en ventas_cabecera, que incluye tanto productos como
    membresías/renovaciones desde que ambas se registran ahí).
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT TO_CHAR(fecha_venta, 'YYYY-MM') AS mes, COALESCE(SUM(total), 0)
            FROM ventas_cabecera
            WHERE fecha_venta >= (CURRENT_DATE - INTERVAL '6 months')
            GROUP BY mes
            ORDER BY mes
            """
        )
        rows = cur.fetchall()

    return {"meses": [{"mes": r[0], "total": float(r[1])} for r in rows]}
