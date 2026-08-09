"""
routes/productos.py - Inventario de productos (tienda del gimnasio)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Body
from database import get_db
from dependencies import require_rol

router = APIRouter(prefix="/api/productos", tags=["Productos / Inventario"])


def _row_to_dict(r):
    return {
        "id_producto": r[0],
        "codigo": r[1],
        "nombre": r[2],
        "categoria": r[3],
        "precio_compra": float(r[4]),
        "precio_venta": float(r[5]),
        "cantidad": r[6],
        "stock_minimo": r[7],
        "stock_maximo": r[8],
        "imagen_url": r[9],
        "activo": r[10],
    }


COLUMNAS = """
    id_producto, codigo, nombre, categoria, precio_compra, precio_venta,
    cantidad, stock_minimo, stock_maximo, imagen_url, activo
"""


@router.get("/")
def listar_productos(
    incluir_inactivos: bool = False,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Lista todos los productos del inventario."""
    with get_db() as conn:
        cur = conn.cursor()
        if incluir_inactivos:
            cur.execute(f"SELECT {COLUMNAS} FROM productos ORDER BY nombre")
        else:
            cur.execute(f"SELECT {COLUMNAS} FROM productos WHERE activo = TRUE ORDER BY nombre")
        rows = cur.fetchall()

    return [_row_to_dict(r) for r in rows]


@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_producto(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """Crea un producto nuevo en el inventario. Solo Administrador."""
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre del producto es obligatorio")

    codigo = (data.get("codigo") or "").strip() or None
    categoria = (data.get("categoria") or "otros").strip()
    precio_compra = float(data.get("precio_compra", 0) or 0)
    precio_venta = float(data.get("precio_venta", 0) or 0)
    cantidad = int(data.get("cantidad", 0) or 0)
    stock_minimo = int(data.get("stock_minimo", 5) or 5)
    stock_maximo = int(data.get("stock_maximo", 100) or 100)
    imagen_url = data.get("imagen_url")

    with get_db() as conn:
        cur = conn.cursor()

        if codigo:
            cur.execute("SELECT id_producto FROM productos WHERE codigo = %s", (codigo,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail=f"Ya existe un producto con el código '{codigo}'")

        cur.execute(
            f"""
            INSERT INTO productos (codigo, nombre, categoria, precio_compra, precio_venta,
                                    cantidad, stock_minimo, stock_maximo, imagen_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING {COLUMNAS}
            """,
            (codigo, nombre, categoria, precio_compra, precio_venta, cantidad, stock_minimo, stock_maximo, imagen_url)
        )
        row = cur.fetchone()

    return _row_to_dict(row)


@router.put("/{id_producto}")
def actualizar_producto(
    id_producto: int,
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """Actualiza los datos de un producto existente. Solo Administrador."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_producto FROM productos WHERE id_producto = %s", (id_producto,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        cur.execute(
            f"""
            UPDATE productos SET
                codigo = COALESCE(%s, codigo),
                nombre = COALESCE(%s, nombre),
                categoria = COALESCE(%s, categoria),
                precio_compra = COALESCE(%s, precio_compra),
                precio_venta = COALESCE(%s, precio_venta),
                cantidad = COALESCE(%s, cantidad),
                stock_minimo = COALESCE(%s, stock_minimo),
                stock_maximo = COALESCE(%s, stock_maximo),
                imagen_url = COALESCE(%s, imagen_url),
                actualizado_en = NOW()
            WHERE id_producto = %s
            RETURNING {COLUMNAS}
            """,
            (
                data.get("codigo"), data.get("nombre"), data.get("categoria"),
                data.get("precio_compra"), data.get("precio_venta"), data.get("cantidad"),
                data.get("stock_minimo"), data.get("stock_maximo"), data.get("imagen_url"),
                id_producto
            )
        )
        row = cur.fetchone()

    return _row_to_dict(row)


@router.post("/{id_producto}/stock")
def registrar_movimiento_stock(
    id_producto: int,
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Registra una entrada/salida/ajuste de stock (para reponer mercadería).
    Recibe: { tipo: 'entrada'|'salida'|'ajuste', cantidad, motivo }
    """
    tipo = data.get("tipo", "entrada")
    if tipo not in ("entrada", "salida", "ajuste"):
        raise HTTPException(status_code=422, detail="tipo debe ser 'entrada', 'salida' o 'ajuste'")

    try:
        cantidad = int(data.get("cantidad"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="cantidad debe ser un número entero")

    motivo = data.get("motivo") or ("Reposición de stock" if tipo == "entrada" else "Ajuste de inventario")
    id_usuario = int(usuario["sub"])

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT cantidad FROM productos WHERE id_producto = %s", (id_producto,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        if tipo == "ajuste":
            nueva_cantidad = cantidad
        elif tipo == "entrada":
            nueva_cantidad = row[0] + cantidad
        else:
            nueva_cantidad = row[0] - cantidad
            if nueva_cantidad < 0:
                raise HTTPException(status_code=422, detail="No hay suficiente stock para esa salida")

        cur.execute(
            "UPDATE productos SET cantidad = %s, actualizado_en = NOW() WHERE id_producto = %s",
            (nueva_cantidad, id_producto)
        )
        cur.execute(
            """
            INSERT INTO productos_movimientos (id_producto, tipo, cantidad, motivo, id_usuario)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (id_producto, tipo, cantidad, motivo, id_usuario)
        )

    return {"success": True, "id_producto": id_producto, "cantidad_actual": nueva_cantidad}


@router.delete("/{id_producto}")
def eliminar_producto(
    id_producto: int,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Desactiva un producto (soft delete). No se borra físicamente porque puede
    tener ventas históricas asociadas en ventas_detalle.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_producto FROM productos WHERE id_producto = %s", (id_producto,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        cur.execute("UPDATE productos SET activo = FALSE, actualizado_en = NOW() WHERE id_producto = %s", (id_producto,))

    return {"success": True, "message": "Producto desactivado"}
