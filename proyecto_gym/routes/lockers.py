"""
routes/lockers.py - Gestión de lockers
"""
from fastapi import APIRouter, HTTPException, status, Depends, Body
from database import get_db
from schemas import LockerAsignar, LockerResponse
from dependencies import require_rol

router = APIRouter(prefix="/api/lockers", tags=["Lockers"])


@router.get("/")
def listar_lockers(
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Estado actual de todos los lockers."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT l.id_locker, l.numero_locker, l.zona, l.estado,
                   l.id_socio_actual, s.nombres, s.apellidos
            FROM gestion_lockers l
            LEFT JOIN socios s ON l.id_socio_actual = s.id_socio
            ORDER BY l.numero_locker
            """
        )
        rows = cur.fetchall()

    return [
        {
            "id_locker": r[0],
            "numero_locker": r[1],
            "zona": r[2],
            "estado": r[3],
            "id_socio_actual": r[4],
            "nombre_socio": f"{r[5]} {r[6]}" if r[5] else None,
        }
        for r in rows
    ]


@router.post("/{id_locker}/asignar")
def asignar_locker(
    id_locker: int,
    data: LockerAsignar,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Asigna un locker libre a un socio."""
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute(
            "SELECT estado FROM gestion_lockers WHERE id_locker = %s",
            (id_locker,)
        )
        locker = cur.fetchone()
        if not locker:
            raise HTTPException(status_code=404, detail="Locker no encontrado")
        if locker[0] != "Libre":
            raise HTTPException(status_code=409, detail="El locker no está disponible")

        cur.execute(
            """
            UPDATE gestion_lockers
            SET estado = 'Ocupado', id_socio_actual = %s
            WHERE id_locker = %s
            RETURNING numero_locker, zona
            """,
            (data.id_socio, id_locker)
        )
        resultado = cur.fetchone()

    return {
        "mensaje": f"Locker #{resultado[0]} ({resultado[1]}) asignado correctamente",
        "numero_locker": resultado[0],
        "zona": resultado[1]
    }


@router.post("/{id_locker}/liberar")
def liberar_locker(
    id_locker: int,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Libera un locker ocupado."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE gestion_lockers
            SET estado = 'Libre', id_socio_actual = NULL
            WHERE id_locker = %s AND estado = 'Ocupado'
            RETURNING numero_locker
            """,
            (id_locker,)
        )
        resultado = cur.fetchone()

    if not resultado:
        raise HTTPException(status_code=404, detail="Locker no encontrado o ya estaba libre")

    return {"mensaje": f"Locker #{resultado[0]} liberado correctamente"}


@router.put("/cantidad")
def actualizar_cantidad_lockers(
    cantidad: int = Body(..., embed=True),
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Actualiza la cantidad total de lockers en el sistema.

    IMPORTANTE: se compara contra la cantidad REAL de filas en
    gestion_lockers (no contra gym_config.cantidad_lockers), porque ese
    número guardado puede desincronizarse de la tabla real (por ejemplo si
    los lockers se crearon manualmente o en una migración previa). Confiar
    solo en el valor guardado hacía que "aumentar" la cantidad no creara
    lockers nuevos cuando el valor guardado ya era mayor al real.
    """
    if cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0")

    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT id_config FROM gym_config LIMIT 1")
        if not cur.fetchone():
            raise HTTPException(status_code=500, detail="Configuración de gym no encontrada")

        # Cantidad real de lockers que existen hoy en la tabla
        cur.execute("SELECT COUNT(*) FROM gestion_lockers")
        cantidad_actual = cur.fetchone()[0]

        # Guardar el nuevo valor de referencia en gym_config
        cur.execute("UPDATE gym_config SET cantidad_lockers = %s", (cantidad,))

        lockers_creados = 0
        if cantidad > cantidad_actual:
            lockers_creados = cantidad - cantidad_actual
            cur.execute("SELECT COALESCE(MAX(numero_locker), 0) FROM gestion_lockers")
            max_num = cur.fetchone()[0]

            for i in range(1, lockers_creados + 1):
                nuevo_numero = max_num + i
                cur.execute(
                    """
                    INSERT INTO gestion_lockers (numero_locker, zona, estado, id_socio_actual)
                    VALUES (%s, %s, 'Libre', NULL)
                    """,
                    (nuevo_numero, 'General')
                )

        conn.commit()

    mensaje = f"Cantidad de lockers actualizada a {cantidad}"
    if cantidad < cantidad_actual:
        mensaje += f" (los {cantidad_actual} lockers existentes no se eliminan automáticamente por seguridad, algunos podrían estar ocupados)"

    return {
        "mensaje": mensaje,
        "cantidad_anterior": cantidad_actual,
        "cantidad_nueva": cantidad,
        "lockers_creados": lockers_creados
    }
