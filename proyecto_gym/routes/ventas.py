"""
routes/ventas.py - Punto de Venta (POS) para recepción
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import get_db
from schemas import VentaCreate, VentaResponse
from dependencies import require_rol
from datetime import date, timedelta

router = APIRouter(prefix="/api/ventas", tags=["Ventas / POS"])


@router.post("/", response_model=VentaResponse, status_code=status.HTTP_201_CREATED)
def registrar_venta(
    data: VentaCreate,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Registra una venta completa (cabecera + detalle) en una sola transacción.
    
    Usa una transacción explícita: si falla el detalle, se revierte la cabecera.
    Esto garantiza coherencia en la base de datos (no quedan ventas sin detalle).
    """
    id_usuario = int(usuario["sub"])

    with get_db() as conn:
        cur = conn.cursor()

        # 1. Insertar cabecera de venta
        cur.execute(
            """
            INSERT INTO ventas_cabecera (id_socio, id_usuario, total, origen_venta)
            VALUES (%s, %s, %s, %s)
            RETURNING id_venta, fecha_venta
            """,
            (data.id_socio, id_usuario, data.total, data.origen_venta)
        )
        id_venta, fecha_venta = cur.fetchone()

        # 2. Insertar detalle de venta (todos los ítems)
        for item in data.items:
            cur.execute(
                """
                INSERT INTO ventas_detalle (id_venta, id_item, tipo_item, cantidad, subtotal)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (id_venta, item.id_item, item.tipo_item, item.cantidad, item.subtotal)
            )

            # Si es un producto físico, descontar del inventario
            if item.tipo_item == "producto":
                cur.execute(
                    "UPDATE productos SET cantidad = cantidad - %s, actualizado_en = NOW() "
                    "WHERE id_producto = %s",
                    (item.cantidad, item.id_item)
                )

    return {
        "id_venta": id_venta,
        "total": data.total,
        "fecha_venta": fecha_venta,
        "mensaje": "Venta registrada exitosamente"
    }


@router.get("/historial")
def historial_ventas(
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=20, ge=5, le=100),
    solo_productos: bool = Query(default=True, description="Si es True (por defecto), excluye ventas de membresías/planes y solo deja lo vendido en el punto de venta"),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Lista paginada de ventas (cabecera) con nombre del socio y usuario que
    la registró. Usada por el panel de Ventas y por Reportes.

    Por defecto excluye las ventas que son únicamente renovaciones/planes de
    membresía (esas se registran en ventas_cabecera para el cálculo de
    ingresos totales, pero el punto de venta de productos solo debe mostrar
    lo que efectivamente se vendió como producto).
    """
    offset = (pagina - 1) * por_pagina
    filtro_tipo = "AND EXISTS (SELECT 1 FROM ventas_detalle d2 WHERE d2.id_venta = v.id_venta AND d2.tipo_item != 'plan')" if solo_productos else ""

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT v.id_venta, v.fecha_venta, v.total, v.origen_venta,
                   s.nombres, s.apellidos, u.username,
                   (SELECT COUNT(*) FROM ventas_detalle d WHERE d.id_venta = v.id_venta) AS num_items,
                   (SELECT STRING_AGG(
                       CASE d.tipo_item
                           WHEN 'producto' THEN COALESCE(p.nombre, 'Producto #' || d.id_item) || ' x' || d.cantidad
                           WHEN 'plan' THEN COALESCE(m.plan, 'Membresía')
                           ELSE 'Servicio'
                       END,
                       ', '
                   )
                    FROM ventas_detalle d
                    LEFT JOIN productos p ON d.tipo_item = 'producto' AND p.id_producto = d.id_item
                    LEFT JOIN membresias m ON d.tipo_item = 'plan' AND m.id_membresia = d.id_item
                    WHERE d.id_venta = v.id_venta) AS detalle_items
            FROM ventas_cabecera v
            LEFT JOIN socios s ON v.id_socio = s.id_socio
            LEFT JOIN usuarios_sistema u ON v.id_usuario = u.id_usuario
            WHERE 1=1 {filtro_tipo}
            ORDER BY v.fecha_venta DESC
            LIMIT %s OFFSET %s
            """,
            (por_pagina, offset)
        )
        rows = cur.fetchall()
        cur.execute(f"SELECT COUNT(*) FROM ventas_cabecera v WHERE 1=1 {filtro_tipo}")
        total = cur.fetchone()[0]

    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "ventas": [
            {
                "id_venta": r[0],
                "fecha_venta": r[1].isoformat() if r[1] else None,
                "total": float(r[2]),
                "origen_venta": r[3],
                "nombre_socio": f"{r[4]} {r[5]}" if r[4] else "Visitante",
                "vendedor": r[6] or "—",
                "num_items": r[7],
                "detalle_items": r[8] or f"{r[7]} ítem(s)",
            }
            for r in rows
        ]
    }


@router.get("/resumen-hoy")
def resumen_ventas_hoy(
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Resumen financiero del día para el panel de recepción."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as monto_total,
                COALESCE(SUM(CASE WHEN origen_venta = 'recepcion' THEN total ELSE 0 END), 0) as monto_recepcion
            FROM ventas_cabecera
            WHERE fecha_venta::date = CURRENT_DATE
            """
        )
        row = cur.fetchone()

    return {
        "total_ventas": row[0],
        "monto_total": float(row[1]),
        "monto_recepcion": float(row[2]),
        "moneda": "Bs."
    }


@router.get("/reporte")
def reporte_ventas(
    periodo: str = Query("mes", description="dia, semana o mes"),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Reporte de ventas para un período específico.
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

        # Resumen de ventas en el período
        cur.execute(
            """
            SELECT
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as monto_total,
                COALESCE(SUM(CASE WHEN origen_venta = 'recepcion' THEN total ELSE 0 END), 0) as monto_recepcion,
                COALESCE(SUM(CASE WHEN origen_venta = 'portal' THEN total ELSE 0 END), 0) as monto_portal
            FROM ventas_cabecera
            WHERE fecha_venta::date >= %s AND fecha_venta::date <= %s
            """,
            (fecha_inicio, hoy)
        )
        row = cur.fetchone()

    return {
        "periodo": periodo,
        "fecha_inicio": fecha_inicio.isoformat(),
        "fecha_fin": hoy.isoformat(),
        "total_ventas": row[0] or 0,
        "monto_total": float(row[1]) if row[1] else 0.0,
        "monto_recepcion": float(row[2]) if row[2] else 0.0,
        "monto_portal": float(row[3]) if row[3] else 0.0,
        "moneda": "Bs."
    }


@router.get("/planes-disponibles")
def listar_planes(
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Lista los planes disponibles para el POS de recepción."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id_plan, nombre_plan, precio_base, duracion_dias FROM planes ORDER BY precio_base"
        )
        rows = cur.fetchall()

    return [
        {
            "id_plan": r[0],
            "nombre_plan": r[1],
            "precio_base": float(r[2]),
            "duracion_dias": r[3],
        }
        for r in rows
    ]


@router.get("/metodos-pago")
def listar_metodos_pago(
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Lista los métodos de pago disponibles."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_metodo, nombre_metodo FROM metodos_pago ORDER BY nombre_metodo")
        rows = cur.fetchall()

    return [{"id_metodo": r[0], "nombre_metodo": r[1]} for r in rows]
