"""
routes/routines.py - Endpoints de Rutinas de Entrenamiento

Gestiona las rutinas de entrenamiento disponibles en el sistema.
Los administradores pueden crear/editar rutinas.
Los socios pueden verlas en el portal.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import get_db
from dependencies import require_rol
import json

router = APIRouter(prefix="/api/routines", tags=["Rutinas"])


@router.get("/")
def listar_rutinas(
    nivel: str = Query(None, description="Filtrar por nivel: principiante, intermedio, avanzado"),
    limite: int = Query(100, ge=1, le=500)
):
    """
    Lista todas las rutinas de entrenamiento.
    Endpoint público. Opcionalmente filtra por nivel.
    """
    with get_db() as conn:
        cur = conn.cursor()

        if nivel and nivel in ['principiante', 'intermedio', 'avanzado']:
            cur.execute(
                """
                SELECT id_rutina, nombre_rutina, nivel, descripcion, ejercicios
                FROM workout_routines
                WHERE nivel = %s
                ORDER BY nombre_rutina
                LIMIT %s
                """,
                (nivel, limite)
            )
        else:
            cur.execute(
                """
                SELECT id_rutina, nombre_rutina, nivel, descripcion, ejercicios
                FROM workout_routines
                ORDER BY nivel, nombre_rutina
                LIMIT %s
                """,
                (limite,)
            )

        rows = cur.fetchall()

    routines = []
    for row in rows:
        id_rutina, nombre_rutina, nivel_rutina, descripcion, ejercicios_json = row
        ejercicios = json.loads(ejercicios_json) if isinstance(ejercicios_json, str) else ejercicios_json

        routines.append({
            "id_rutina": id_rutina,
            "nombre_rutina": nombre_rutina,
            "nivel": nivel_rutina,
            "descripcion": descripcion,
            "ejercicios": ejercicios,
            "cantidad_ejercicios": len(ejercicios) if ejercicios else 0
        })

    return {
        "total": len(routines),
        "filtro_nivel": nivel or "todas",
        "routines": routines
    }


@router.get("/{id_rutina}")
def obtener_rutina(id_rutina: int):
    """
    Obtiene el detalle completo de una rutina.
    Endpoint público.
    """
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
        "id_rutina": id_rutina,
        "nombre_rutina": nombre_rutina,
        "nivel": nivel,
        "descripcion": descripcion,
        "ejercicios": ejercicios,
        "cantidad_ejercicios": len(ejercicios) if ejercicios else 0
    }


@router.post("/")
def crear_rutina(
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Crea una nueva rutina de entrenamiento.
    Solo Administrador.
    
    Debe enviar en body:
    {
        "nombre_rutina": "string",
        "nivel": "principiante|intermedio|avanzado",
        "descripcion": "string",
        "ejercicios": [
            {
                "nombre": "string",
                "series": int,
                "repeticiones": int,
                "peso_kg": float (optional),
                "descanso_segundos": int
            }
        ]
    }
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint en desarrollo. Use directamente SQL o dashboard de admin."
    )


@router.put("/{id_rutina}")
def actualizar_rutina(
    id_rutina: int,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Actualiza una rutina existente.
    Solo Administrador.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint en desarrollo. Use directamente SQL o dashboard de admin."
    )


@router.delete("/{id_rutina}")
def eliminar_rutina(
    id_rutina: int,
    usuario=Depends(require_rol(["Administrador"]))
):
    """
    Elimina una rutina.
    Solo Administrador. (Soft delete recomendado en producción)
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint en desarrollo. Use directamente SQL o dashboard de admin."
    )


@router.get("/stats/by-level")
def estadisticas_por_nivel():
    """
    Obtiene estadísticas de rutinas agrupadas por nivel.
    Endpoint público.
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT nivel, COUNT(*) as cantidad
            FROM workout_routines
            GROUP BY nivel
            ORDER BY nivel
            """
        )
        rows = cur.fetchall()

    stats = {row[0]: row[1] for row in rows}

    return {
        "estadisticas": stats,
        "total_rutinas": sum(stats.values())
    }
