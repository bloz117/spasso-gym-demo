"""Utilidades de la biblioteca de ejercicios en video.

Desde la biblioteca nueva (ids "hg-NNN" hombres / "mg-NNN" mujeres) las rutinas
solo pueden llevar ejercicios que tengan video. Los ids antiguos ("0001", ...)
de los GIFs se descartan al leer y al guardar.
"""
import mimetypes
import os
import re

from fastapi import Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

_ID_NUEVO = re.compile(r"^(hg|mg)-\d{1,4}$")


def id_valido(valor) -> bool:
    return bool(_ID_NUEVO.match(str(valor or "")))


def solo_ejercicios_nuevos(rutina):
    """Devuelve la rutina sin los ejercicios de la biblioteca antigua."""
    if not isinstance(rutina, dict):
        return rutina
    dias = []
    for d in rutina.get("dias") or []:
        if not isinstance(d, dict):
            continue
        nd = dict(d)
        nd["ejercicios"] = [e for e in (d.get("ejercicios") or []) if isinstance(e, dict) and id_valido(e.get("id"))]
        dias.append(nd)
    out = dict(rutina)
    out["dias"] = dias
    return out


def _trozos(ruta, ini, fin, tam=256 * 1024):
    with open(ruta, "rb") as f:
        f.seek(ini)
        resta = fin - ini + 1
        while resta > 0:
            b = f.read(min(tam, resta))
            if not b:
                break
            resta -= len(b)
            yield b


def servir_con_rango(base: str, rel: str, request: Request):
    """Sirve un archivo (video) con soporte de 'Range'. Sin esto el navegador no
    puede adelantar/retroceder el video (vuelve al inicio)."""
    base = os.path.abspath(base)
    ruta = os.path.abspath(os.path.join(base, rel))
    if not ruta.startswith(base + os.sep) or not os.path.isfile(ruta):
        return JSONResponse({"detail": "No encontrado"}, status_code=404)
    tam = os.path.getsize(ruta)
    mime = mimetypes.guess_type(ruta)[0] or "application/octet-stream"
    cab = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
    rango = request.headers.get("range")
    if rango and rango.lower().startswith("bytes="):
        try:
            a, b = rango[6:].split(",")[0].strip().split("-", 1)
            if a == "":
                ini, fin = max(0, tam - int(b)), tam - 1
            else:
                ini = int(a)
                fin = int(b) if b else tam - 1
            fin = min(fin, tam - 1)
            if ini > fin or ini >= tam:
                raise ValueError
        except ValueError:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{tam}", **cab})
        cab.update({"Content-Range": f"bytes {ini}-{fin}/{tam}", "Content-Length": str(fin - ini + 1)})
        return StreamingResponse(_trozos(ruta, ini, fin), status_code=206, media_type=mime, headers=cab)
    cab["Content-Length"] = str(tam)
    return StreamingResponse(_trozos(ruta, 0, tam - 1), media_type=mime, headers=cab)
