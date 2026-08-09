"""
routes/planes.py - Catálogo de planes de membresía, editable desde
Configuración: categorías (pestañas) y los planes dentro de cada una
(nombre, precio, duración, descripción).

Antes esto estaba escrito directo en el HTML de recepcion.html (5
pestañas fijas y 13 tarjetas fijas) — ahora vive en la base de datos
(tablas `categorias_planes` y `planes`) y se administra desde acá.

Importante: las membresías ya registradas (tabla `membresias`) guardan el
nombre del plan como texto en el momento de la venta, NO una referencia
al id del plan. Por eso editar o eliminar un plan de este catálogo nunca
afecta el historial de membresías ya vendidas.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Body
from database import get_db
from dependencies import require_rol

router = APIRouter(prefix="/api/planes", tags=["Planes / Catálogo"])


def _plan_a_dict(r):
    return {
        "id_plan": r[0],
        "id_categoria": r[1],
        "nombre_plan": r[2],
        "precio_base": float(r[3]) if r[3] is not None else 0.0,
        "duracion_dias": r[4],
        "descripcion": r[5],
        "activo": r[6],
    }


COLUMNAS_PLAN = "id_plan, id_categoria, nombre_plan, precio_base, duracion_dias, descripcion, activo"


@router.get("/categorias")
def listar_categorias_con_planes(
    incluir_inactivos: bool = False,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Devuelve todas las categorías (pestañas) con sus planes anidados, en
    el orden en que deben mostrarse. Único endpoint que necesitan Registro,
    Renovaciones y el panel de Configuración para pintar todo el catálogo.
    """
    with get_db() as conn:
        cur = conn.cursor()

        if incluir_inactivos:
            cur.execute("SELECT id_categoria, nombre, orden, activo FROM categorias_planes ORDER BY orden, id_categoria")
        else:
            cur.execute("SELECT id_categoria, nombre, orden, activo FROM categorias_planes WHERE activo = true ORDER BY orden, id_categoria")
        categorias = cur.fetchall()

        if incluir_inactivos:
            cur.execute(f"SELECT {COLUMNAS_PLAN} FROM planes ORDER BY precio_base")
        else:
            cur.execute(f"SELECT {COLUMNAS_PLAN} FROM planes WHERE activo = true ORDER BY precio_base")
        planes = cur.fetchall()

    planes_por_categoria = {}
    for p in planes:
        planes_por_categoria.setdefault(p[1], []).append(_plan_a_dict(p))

    return [
        {
            "id_categoria": c[0],
            "nombre": c[1],
            "orden": c[2],
            "activo": c[3],
            "planes": planes_por_categoria.get(c[0], []),
        }
        for c in categorias
    ]


@router.post("/categorias", status_code=status.HTTP_201_CREATED)
def crear_categoria(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """Crea una categoría (pestaña) nueva. Solo Administrador."""
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre de la categoría es obligatorio")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_categoria FROM categorias_planes WHERE nombre = %s AND activo = true", (nombre,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail=f"Ya existe una categoría llamada '{nombre}'")

        cur.execute("SELECT COALESCE(MAX(orden), 0) + 1 FROM categorias_planes")
        siguiente_orden = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO categorias_planes (nombre, orden)
            VALUES (%s, %s)
            RETURNING id_categoria, nombre, orden, activo
            """,
            (nombre, siguiente_orden)
        )
        c = cur.fetchone()

    return {"id_categoria": c[0], "nombre": c[1], "orden": c[2], "activo": c[3], "planes": []}


@router.put("/categorias/{id_categoria}")
def actualizar_categoria(
    id_categoria: int,
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """Renombra o reordena una categoría. Solo Administrador."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_categoria FROM categorias_planes WHERE id_categoria = %s", (id_categoria,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

        nombre = data.get("nombre")
        if nombre is not None:
            nombre = nombre.strip()
            if not nombre:
                raise HTTPException(status_code=422, detail="El nombre de la categoría no puede quedar vacío")

        cur.execute(
            """
            UPDATE categorias_planes SET
                nombre = COALESCE(%s, nombre),
                orden = COALESCE(%s, orden)
            WHERE id_categoria = %s
            RETURNING id_categoria, nombre, orden, activo
            """,
            (nombre, data.get("orden"), id_categoria)
        )
        c = cur.fetchone()

    return {"id_categoria": c[0], "nombre": c[1], "orden": c[2], "activo": c[3]}


@router.delete("/categorias/{id_categoria}")
def eliminar_categoria(
    id_categoria: int,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Desactiva una categoría completa y todos sus planes (soft delete). No
    se borra nada: si un socio ya tiene una membresía comprada con un plan
    de esta categoría, ese historial no se ve afectado.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_categoria FROM categorias_planes WHERE id_categoria = %s", (id_categoria,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

        cur.execute("UPDATE planes SET activo = false WHERE id_categoria = %s", (id_categoria,))
        cur.execute("UPDATE categorias_planes SET activo = false WHERE id_categoria = %s", (id_categoria,))

    return {"success": True, "message": "Categoría y sus planes desactivados"}


@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_plan(
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """Crea un plan nuevo dentro de una categoría. Solo Administrador."""
    nombre_plan = (data.get("nombre_plan") or "").strip()
    if not nombre_plan:
        raise HTTPException(status_code=422, detail="El nombre del plan es obligatorio")

    try:
        id_categoria = int(data.get("id_categoria"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Debe indicar una categoría válida")

    try:
        precio_base = float(data.get("precio_base"))
        if precio_base <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="El precio debe ser un número mayor a 0")

    try:
        duracion_dias = int(data.get("duracion_dias"))
        if duracion_dias <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="La duración (días) debe ser un número entero mayor a 0")

    descripcion = (data.get("descripcion") or "").strip() or None

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_categoria FROM categorias_planes WHERE id_categoria = %s", (id_categoria,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Categoría no encontrada")

        cur.execute(
            f"""
            INSERT INTO planes (id_categoria, nombre_plan, precio_base, duracion_dias, descripcion)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING {COLUMNAS_PLAN}
            """,
            (id_categoria, nombre_plan, precio_base, duracion_dias, descripcion)
        )
        row = cur.fetchone()

    return _plan_a_dict(row)


@router.put("/{id_plan}")
def actualizar_plan(
    id_plan: int,
    data: dict = Body(...),
    usuario=Depends(require_rol(["Administrador"]))
):
    """Actualiza un plan existente. Solo Administrador."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_plan FROM planes WHERE id_plan = %s", (id_plan,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Plan no encontrado")

        precio_base = data.get("precio_base")
        if precio_base is not None:
            try:
                precio_base = float(precio_base)
                if precio_base <= 0:
                    raise ValueError()
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="El precio debe ser un número mayor a 0")

        duracion_dias = data.get("duracion_dias")
        if duracion_dias is not None:
            try:
                duracion_dias = int(duracion_dias)
                if duracion_dias <= 0:
                    raise ValueError()
            except (TypeError, ValueError):
                raise HTTPException(status_code=422, detail="La duración (días) debe ser un número entero mayor a 0")

        nombre_plan = data.get("nombre_plan")
        if nombre_plan is not None:
            nombre_plan = nombre_plan.strip()
            if not nombre_plan:
                raise HTTPException(status_code=422, detail="El nombre del plan no puede quedar vacío")

        id_categoria = data.get("id_categoria")
        if id_categoria is not None:
            id_categoria = int(id_categoria)
            cur.execute("SELECT id_categoria FROM categorias_planes WHERE id_categoria = %s", (id_categoria,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Categoría no encontrada")

        cur.execute(
            f"""
            UPDATE planes SET
                nombre_plan = COALESCE(%s, nombre_plan),
                precio_base = COALESCE(%s, precio_base),
                duracion_dias = COALESCE(%s, duracion_dias),
                descripcion = COALESCE(%s, descripcion),
                id_categoria = COALESCE(%s, id_categoria)
            WHERE id_plan = %s
            RETURNING {COLUMNAS_PLAN}
            """,
            (nombre_plan, precio_base, duracion_dias, data.get("descripcion"), id_categoria, id_plan)
        )
        row = cur.fetchone()

    return _plan_a_dict(row)


@router.delete("/{id_plan}")
def eliminar_plan(
    id_plan: int,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Desactiva un plan (soft delete): deja de aparecer para vender, pero las
    membresías ya vendidas con ese plan no se ven afectadas (guardan el
    nombre del plan como texto, no una referencia al catálogo).
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_plan FROM planes WHERE id_plan = %s", (id_plan,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Plan no encontrado")

        cur.execute("UPDATE planes SET activo = false WHERE id_plan = %s", (id_plan,))

    return {"success": True, "message": "Plan desactivado"}
