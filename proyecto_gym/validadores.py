"""
validadores.py - Reglas de validación compartidas (backend).

Todas lanzan ValueError con un mensaje en español, listo para mostrarse al usuario.
Se usan desde los modelos Pydantic (schemas.py) y desde los endpoints que
reciben `dict` (productos, planes, usuarios, configuración).
"""
import re
from typing import Optional

_LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ"
_PATRON_NOMBRE = re.compile(rf"^[{_LETRAS}]+(?:[ '\-.][{_LETRAS}]+)*\.?$")
_PATRON_TELEFONO = re.compile(r"^\+?\d{7,15}$")
_PATRON_USUARIO = re.compile(r"^[A-Za-z0-9._\-]{3,30}$")
_PATRON_CORREO = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$")
_PATRON_HORA = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def nombre_persona(valor, etiqueta="El nombre", minimo=2, maximo=60) -> str:
    """Solo letras (con tildes/ñ), espacios, apóstrofe, guion y punto. Sin números."""
    v = re.sub(r"\s+", " ", str(valor or "")).strip()
    if len(v) < minimo:
        raise ValueError(f"{etiqueta} debe tener al menos {minimo} letras")
    if len(v) > maximo:
        raise ValueError(f"{etiqueta} no puede superar {maximo} caracteres")
    if not _PATRON_NOMBRE.match(v):
        raise ValueError(f"{etiqueta} solo puede contener letras (sin números ni símbolos)")
    if v.islower() or v.isupper():
        v = v.title()
    return v


def telefono(valor, obligatorio=False) -> Optional[str]:
    """Normaliza a dígitos (con + opcional). 7 a 15 dígitos."""
    v = re.sub(r"[\s\-().]", "", str(valor or ""))
    if not v:
        if obligatorio:
            raise ValueError("El teléfono es obligatorio")
        return None
    if not _PATRON_TELEFONO.match(v):
        raise ValueError("El teléfono solo puede tener números (7 a 15 dígitos) y un + inicial opcional")
    return v


def correo(valor, obligatorio=False) -> Optional[str]:
    v = str(valor or "").strip().lower()
    if not v:
        if obligatorio:
            raise ValueError("El correo es obligatorio")
        return None
    if len(v) > 150 or not _PATRON_CORREO.match(v) or ".." in v:
        raise ValueError("Ingresa un correo válido (ej: nombre@gmail.com)")
    return v


def usuario_sistema(valor) -> str:
    v = str(valor or "").strip()
    if not _PATRON_USUARIO.match(v):
        raise ValueError("El usuario debe tener 3 a 30 caracteres: letras, números, punto, guion o guion bajo (sin espacios)")
    return v


def contrasena(valor, minimo=6) -> str:
    v = str(valor or "")
    if len(v) < minimo:
        raise ValueError(f"La contraseña debe tener al menos {minimo} caracteres")
    if len(v) > 72:
        raise ValueError("La contraseña no puede superar 72 caracteres")
    if v != v.strip():
        raise ValueError("La contraseña no puede empezar ni terminar con espacios")
    return v


def texto(valor, etiqueta, minimo=1, maximo=100, obligatorio=True) -> Optional[str]:
    v = re.sub(r"\s+", " ", str(valor or "")).strip()
    if not v:
        if obligatorio:
            raise ValueError(f"{etiqueta} es obligatorio")
        return None
    if len(v) < minimo:
        raise ValueError(f"{etiqueta} debe tener al menos {minimo} caracteres")
    if len(v) > maximo:
        raise ValueError(f"{etiqueta} no puede superar {maximo} caracteres")
    return v


def decimal(valor, etiqueta, minimo=0.0, maximo=1_000_000.0, estricto_mayor=False) -> float:
    try:
        n = float(valor)
    except (TypeError, ValueError):
        raise ValueError(f"{etiqueta} debe ser un número")
    if n != n or n in (float("inf"), float("-inf")):
        raise ValueError(f"{etiqueta} debe ser un número válido")
    if (estricto_mayor and n <= minimo) or (not estricto_mayor and n < minimo):
        raise ValueError(f"{etiqueta} debe ser {'mayor a' if estricto_mayor else 'al menos'} {minimo:g}")
    if n > maximo:
        raise ValueError(f"{etiqueta} no puede superar {maximo:g}")
    return round(n, 2)


def entero(valor, etiqueta, minimo=0, maximo=1_000_000) -> int:
    try:
        f = float(valor)
        if f != int(f):
            raise ValueError()
        n = int(f)
    except (TypeError, ValueError):
        raise ValueError(f"{etiqueta} debe ser un número entero")
    if n < minimo:
        raise ValueError(f"{etiqueta} debe ser al menos {minimo}")
    if n > maximo:
        raise ValueError(f"{etiqueta} no puede superar {maximo}")
    return n


def hora(valor, etiqueta) -> Optional[str]:
    v = str(valor or "").strip()
    if not v:
        return None
    if not _PATRON_HORA.match(v):
        raise ValueError(f"{etiqueta} debe tener formato HH:MM (ej: 06:00)")
    return v
