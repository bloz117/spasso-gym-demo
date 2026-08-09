"""
routes/socios.py - CRUD de socios/atletas (módulo de recepción)
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import get_db
from schemas import SocioCreate, SocioResponse
from dependencies import require_rol
from auth import hash_password
from typing import Optional
from datetime import date
import re
import secrets
import unicodedata


def _generar_username(cur, nombres: str, apellidos: str) -> str:
    """
    Genera un username único a partir de la primera letra del nombre + el
    apellido, en minúsculas y sin tildes/espacios (ej: 'Juan Quispe' -> 'jquispe').
    Si ya existe, agrega un sufijo numérico incremental.
    """
    def normalizar(texto: str) -> str:
        sin_tildes = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
        return re.sub(r'[^a-z0-9]', '', sin_tildes.lower())

    base = (normalizar(nombres)[:1] + normalizar(apellidos.split(' ')[0] if apellidos else ''))
    if not base:
        base = 'socio'

    username = base
    sufijo = 1
    while True:
        cur.execute("SELECT 1 FROM portal_accounts WHERE username = %s", (username,))
        if not cur.fetchone():
            return username
        sufijo += 1
        username = f"{base}{sufijo}"

router = APIRouter(prefix="/api/socios", tags=["Socios"])


@router.post("/", response_model=SocioResponse, status_code=status.HTTP_201_CREATED)
def registrar_socio(
    data: SocioCreate,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Registra un nuevo socio/atleta en el sistema.
    Accesible para Administrador y Recepcionista.
    
    IMPORTANTE: Al crear un socio, se auto-genera automáticamente una cuenta
    en el portal (portal_accounts) con contraseña temporal.
    """
    with get_db() as conn:
        cur = conn.cursor()

        # Verificar si ya existe el DNI (más seguro que depender solo del UNIQUE constraint)
        cur.execute("SELECT id_socio FROM socios WHERE dni = %s", (data.dni,))
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un socio registrado con el DNI {data.dni}"
            )

        # Verificar email duplicado si se proporcionó
        if data.email:
            cur.execute("SELECT id_socio FROM socios WHERE email = %s", (data.email,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El correo electrónico ya está registrado"
                )

        # CREAR SOCIO
        cur.execute(
            """
            INSERT INTO socios (nombres, apellidos, dni, email)
            VALUES (%s, %s, %s, %s)
            RETURNING id_socio, nombres, apellidos, dni, email, fecha_registro
            """,
            (data.nombres, data.apellidos, data.dni, data.email)
        )
        socio = cur.fetchone()
        id_socio = socio[0]

        # AUTO-GENERAR CUENTA DE PORTAL
        # Genera una contraseña temporal aleatoria que el socio debe cambiar en su primer login
        username = _generar_username(cur, data.nombres, data.apellidos)
        password_temporal = secrets.token_urlsafe(12)  # 12 caracteres aleatorios
        password_hash = hash_password(password_temporal)

        cur.execute(
            """
            INSERT INTO portal_accounts (id_socio, username, password_hash, must_change_password)
            VALUES (%s, %s, %s, TRUE)
            ON CONFLICT (id_socio) DO NOTHING
            """,
            (id_socio, username, password_hash)
        )

    return {
        "id_socio": socio[0],
        "nombres": socio[1],
        "apellidos": socio[2],
        "dni": socio[3],
        "email": socio[4],
        "fecha_registro": socio[5],
        "portal_credentials": {
            "email": socio[4],
            "temp_password": password_temporal,
        } if socio[4] else None,
    }


@router.put("/{id_socio}")
def actualizar_socio(
    id_socio: int,
    data: SocioCreate,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Actualiza los datos básicos de un socio existente (nombres, apellidos,
    dni, email). No modifica la membresía ni la cuenta del portal.
    """
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT id_socio FROM socios WHERE id_socio = %s", (id_socio,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Socio no encontrado")

        # DNI/email duplicados en OTRO socio
        cur.execute(
            "SELECT id_socio FROM socios WHERE dni = %s AND id_socio != %s",
            (data.dni, id_socio)
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe otro socio registrado con el DNI {data.dni}"
            )

        if data.email:
            cur.execute(
                "SELECT id_socio FROM socios WHERE email = %s AND id_socio != %s",
                (data.email, id_socio)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El correo electrónico ya está registrado por otro socio"
                )

        # foto_url es opcional: si no viene en el body (None), se deja la
        # foto que ya tenía el socio en vez de borrarla. Para quitar la
        # foto explícitamente, el frontend manda foto_url como cadena vacía.
        if data.foto_url is not None:
            cur.execute(
                """
                UPDATE socios
                SET nombres = %s, apellidos = %s, dni = %s, email = %s, foto_url = %s
                WHERE id_socio = %s
                RETURNING id_socio, nombres, apellidos, dni, email, fecha_registro, foto_url
                """,
                (data.nombres, data.apellidos, data.dni, data.email, data.foto_url, id_socio)
            )
        else:
            cur.execute(
                """
                UPDATE socios
                SET nombres = %s, apellidos = %s, dni = %s, email = %s
                WHERE id_socio = %s
                RETURNING id_socio, nombres, apellidos, dni, email, fecha_registro, foto_url
                """,
                (data.nombres, data.apellidos, data.dni, data.email, id_socio)
            )
        socio = cur.fetchone()

    return {
        "id_socio": socio[0],
        "nombres": socio[1],
        "apellidos": socio[2],
        "dni": socio[3],
        "email": socio[4],
        "fecha_registro": socio[5],
        "foto_url": socio[6],
    }


@router.get("/buscar")
def buscar_socios(
    q: str = Query(..., min_length=2, description="DNI, nombre o apellido"),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Búsqueda rápida de socios por DNI, nombre o apellido.
    Endpoint clave para la recepción: buscar al atleta antes de registrar ingreso.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_socio, nombres, apellidos, dni, email, fecha_registro
            FROM socios
            WHERE activo = true
              AND (dni ILIKE %s
               OR nombres ILIKE %s
               OR apellidos ILIKE %s)
            ORDER BY apellidos, nombres
            LIMIT 20
            """,
            (f"%{q}%", f"%{q}%", f"%{q}%")
        )
        rows = cur.fetchall()

    return [
        {
            "id_socio": r[0],
            "nombres": r[1],
            "apellidos": r[2],
            "dni": r[3],
            "email": r[4],
            "fecha_registro": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]


@router.get("/vencimientos")
def listar_vencimientos(
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Lista miembresías por vencer o vencidas.
    Usado para el módulo de renovaciones.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id_socio, s.nombres, s.apellidos, s.dni, m.tipo_membresia, 
                   m.plan, m.fecha_inicio, m.fecha_vencimiento, m.estado
            FROM socios s
            JOIN membresias m ON s.id_socio = m.id_socio
            WHERE m.estado IN ('activo', 'por-vencer', 'vencido')
            AND (m.fecha_vencimiento <= NOW() + INTERVAL '7 days'
                 OR m.fecha_vencimiento < NOW())
            ORDER BY m.fecha_vencimiento ASC
            """
        )
        rows = cur.fetchall()

    return [
        {
            "id_socio": r[0],
            "nombres": r[1],
            "apellidos": r[2],
            "dni": r[3],
            "tipo_membresia": r[4],
            "plan": r[5],
            "fecha_inicio": r[6].isoformat() if r[6] else None,
            "fecha_vencimiento": r[7].isoformat() if r[7] else None,
            "estado": r[8],
        }
        for r in rows
    ]


@router.get("/{id_socio}")
def obtener_socio(
    id_socio: int,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """Obtiene el detalle completo de un socio por su ID."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id_socio, s.nombres, s.apellidos, s.dni, s.email, s.fecha_registro, s.foto_url,
                   -- Última asistencia
                   (SELECT MAX(a.fecha_entrada) FROM asistencias_log a WHERE a.id_socio = s.id_socio),
                   -- Conteo de visitas totales
                   (SELECT COUNT(*) FROM asistencias_log a WHERE a.id_socio = s.id_socio)
            FROM socios s
            WHERE s.id_socio = %s
            """,
            (id_socio,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Socio no encontrado")

    return {
        "id_socio": row[0],
        "nombres": row[1],
        "apellidos": row[2],
        "dni": row[3],
        "email": row[4],
        "fecha_registro": row[5].isoformat() if row[5] else None,
        "foto_url": row[6],
        "ultima_asistencia": row[7].isoformat() if row[7] else None,
        "total_visitas": row[8],
    }


@router.get("/")
def listar_socios(
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=200, ge=5, le=1000),
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Lista paginada de socios, con su membresía más reciente incluida
    (plan, fechas y estado calculado al momento). Antes esta lista NO traía
    nada de membresía, y el frontend rellenaba plan/estado usando el
    endpoint de /vencimientos — pero ese endpoint solo devuelve socios con
    membresías por vencer o vencidas (7 días), así que cualquier socio con
    una membresía activa y vigente por más de 7 días aparecía como "Sin
    membresía" en Miembros y Estadísticas, aunque sí tuviera un plan pagado.
    """
    offset = (pagina - 1) * por_pagina
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id_socio, s.nombres, s.apellidos, s.dni, s.email, s.fecha_registro,
                   m.plan, m.tipo_membresia, m.fecha_inicio, m.fecha_vencimiento
            FROM socios s
            LEFT JOIN LATERAL (
                SELECT plan, tipo_membresia, fecha_inicio, fecha_vencimiento
                FROM membresias
                WHERE membresias.id_socio = s.id_socio
                  AND estado <> 'retirado'
                ORDER BY fecha_vencimiento DESC
                LIMIT 1
            ) m ON true
            WHERE s.activo = true
            ORDER BY s.fecha_registro DESC
            LIMIT %s OFFSET %s
            """,
            (por_pagina, offset)
        )
        rows = cur.fetchall()
        cur.execute("SELECT COUNT(*) FROM socios WHERE activo = true")
        total = cur.fetchone()[0]

    hoy = date.today()
    socios_resp = []
    for r in rows:
        (id_socio, nombres, apellidos, dni, email, fecha_registro,
         plan, tipo_membresia, fecha_inicio, fecha_vencimiento) = r

        dias_restantes = None
        estado_membresia = "sin-membresia"
        if fecha_vencimiento:
            dias_restantes = (fecha_vencimiento.date() - hoy).days
            if dias_restantes < 0:
                estado_membresia = "vencido"
            elif dias_restantes <= 7:
                estado_membresia = "por-vencer"
            else:
                estado_membresia = "activo"

        socios_resp.append({
            "id_socio": id_socio,
            "nombres": nombres,
            "apellidos": apellidos,
            "dni": dni,
            "email": email,
            "fecha_registro": fecha_registro.isoformat() if fecha_registro else None,
            "plan": plan,
            "tipo_membresia": tipo_membresia,
            "fecha_inicio_membresia": fecha_inicio.isoformat() if fecha_inicio else None,
            "fecha_vencimiento": fecha_vencimiento.isoformat() if fecha_vencimiento else None,
            "dias_restantes": dias_restantes,
            "estado_membresia": estado_membresia,
        })

    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "socios": socios_resp
    }


@router.post("/{id_socio}/renovar")
def renovar_membresia(
    id_socio: int,
    data: dict,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Renueva la membresía de un socio.
    Recibe: { plan, tipo_membresia, duracion_dias, monto, metodo_pago }
    """
    with get_db() as conn:
        cur = conn.cursor()

        # Verificar que el socio existe
        cur.execute("SELECT id_socio FROM socios WHERE id_socio = %s", (id_socio,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Socio no encontrado")

        # Actualizar membresía actual (la antigua, si existe)
        cur.execute(
            """
            UPDATE membresias SET estado = 'renovado'
            WHERE id_socio = %s AND estado = 'activo'
            """,
            (id_socio,)
        )

        # Crear nueva membresía
        from datetime import datetime, timedelta
        fecha_inicio = datetime.now()
        duracion = data.get("duracion_dias", 30)
        fecha_vencimiento = fecha_inicio + timedelta(days=duracion)

        cur.execute(
            """
            INSERT INTO membresias (id_socio, tipo_membresia, plan, fecha_inicio, 
                                   fecha_vencimiento, estado, monto, metodo_pago)
            VALUES (%s, %s, %s, %s, %s, 'activo', %s, %s)
            RETURNING id_membresia, fecha_inicio, fecha_vencimiento
            """,
            (
                id_socio,
                data.get("tipo_membresia"),
                data.get("plan"),
                fecha_inicio,
                fecha_vencimiento,
                data.get("monto", 0),
                data.get("metodo_pago", "efectivo"),
            )
        )
        nueva_membresia = cur.fetchone()
        id_membresia = nueva_membresia[0]

        # Registrar también como venta (para que aparezca en Ventas/Reportes,
        # igual que las ventas de productos) siempre que tenga un monto asociado.
        monto = data.get("monto", 0) or 0
        if monto > 0:
            id_usuario = int(usuario["sub"])
            cur.execute(
                """
                INSERT INTO ventas_cabecera (id_socio, id_usuario, total, origen_venta)
                VALUES (%s, %s, %s, 'recepcion')
                RETURNING id_venta
                """,
                (id_socio, id_usuario, monto)
            )
            id_venta = cur.fetchone()[0]
            cur.execute(
                """
                INSERT INTO ventas_detalle (id_venta, id_item, tipo_item, cantidad, subtotal)
                VALUES (%s, %s, 'plan', 1, %s)
                """,
                (id_venta, id_membresia, monto)
            )

        conn.commit()

    return {
        "success": True,
        "message": f"Membresía renovada exitosamente",
        "id_membresia": id_membresia,
        "fecha_inicio": nueva_membresia[1].isoformat(),
        "fecha_vencimiento": nueva_membresia[2].isoformat(),
    }


@router.delete("/{id_socio}")
def retirar_socio(
    id_socio: int,
    usuario=Depends(require_rol(["Administrador", "Recepcionista"]))
):
    """
    Elimina a un socio de las listas de la app (botón de eliminar en
    Miembros/Estadísticas). No es un borrado real: es un soft-delete.
    - socios.activo pasa a false -> deja de aparecer en listados y
      búsquedas, y ya no se identifica por huella para marcar asistencia.
    - Si tenía un casillero asignado, se libera.
    - Si tenía una asistencia abierta (sin salida), se cierra.
    - Su membresía se marca 'retirado'.
    Todo su historial (ventas, asistencias, membresías, huella guardada)
    se queda intacto en la base de datos como respaldo — nada se borra.
    """
    with get_db() as conn:
        cur = conn.cursor()

        # Verificar que existe
        cur.execute("SELECT id_socio FROM socios WHERE id_socio = %s", (id_socio,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Socio no encontrado")

        # Marcar membresía como retirado
        cur.execute(
            """
            UPDATE membresias SET estado = 'retirado'
            WHERE id_socio = %s AND estado IN ('activo', 'por-vencer')
            """,
            (id_socio,)
        )

        # Liberar casillero si tenía uno asignado
        cur.execute(
            "UPDATE gestion_lockers SET estado = 'Libre', id_socio_actual = NULL "
            "WHERE id_socio_actual = %s",
            (id_socio,)
        )

        # Cerrar asistencia abierta si tenía una (sin marcar salida)
        cur.execute(
            "UPDATE asistencias_log SET fecha_salida = NOW() "
            "WHERE id_socio = %s AND fecha_salida IS NULL",
            (id_socio,)
        )

        # Soft-delete: deja de aparecer en listas, búsquedas e identificación
        # biométrica, pero la fila y todo su historial se quedan en la BD.
        cur.execute("UPDATE socios SET activo = false WHERE id_socio = %s", (id_socio,))

        conn.commit()

    return {
        "success": True,
        "message": f"Socio ID {id_socio} eliminado de las listas (su historial queda respaldado en la base de datos)",
        "id_socio": id_socio,
    }
