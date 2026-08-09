"""
schemas.py - Modelos Pydantic para validación de datos entrada/salida.

Pydantic valida automáticamente tipos, longitudes y formatos ANTES
de que los datos lleguen a la base de datos. Esto previene errores SQL
y ataques de inyección a nivel de modelo de datos.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import re


# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: dict


# ─────────────────────────────────────────────
# SOCIOS (Atletas / Clientes)
# ─────────────────────────────────────────────

class SocioCreate(BaseModel):
    nombres: str = Field(..., min_length=2, max_length=100)
    apellidos: str = Field(..., min_length=2, max_length=100)
    dni: str = Field(..., min_length=5, max_length=20)
    email: Optional[EmailStr] = None
    foto_url: Optional[str] = None

    @field_validator('dni')
    @classmethod
    def dni_solo_alfanumerico(cls, v):
        if not re.match(r'^[A-Za-z0-9\-]+$', v):
            raise ValueError('El DNI solo puede contener letras, números y guiones')
        return v.upper()


class SocioResponse(BaseModel):
    id_socio: int
    nombres: str
    apellidos: str
    dni: str
    email: Optional[str]
    fecha_registro: datetime


# ─────────────────────────────────────────────
# ASISTENCIAS (Registro de Ingreso)
# ─────────────────────────────────────────────

class AsistenciaCreate(BaseModel):
    # Puede registrarse por DNI (más común en recepción) o id directo
    dni_socio: str = Field(..., min_length=5, max_length=20)


class AsistenciaResponse(BaseModel):
    id_log: int
    id_socio: int
    nombres: str
    apellidos: str
    fecha_entrada: datetime


# ─────────────────────────────────────────────
# VENTAS (POS de Recepción)
# ─────────────────────────────────────────────

class VentaItem(BaseModel):
    id_item: int
    tipo_item: str = Field(..., pattern=r'^(plan|producto|servicio)$')
    cantidad: int = Field(default=1, ge=1)
    subtotal: float = Field(..., gt=0)


class VentaCreate(BaseModel):
    id_socio: Optional[int] = None  # Puede ser venta sin socio (visitante)
    id_metodo_pago: int
    items: list[VentaItem] = Field(..., min_length=1)
    total: float = Field(..., gt=0)
    origen_venta: str = Field(default="recepcion", pattern=r'^(recepcion|web|app)$')


class VentaResponse(BaseModel):
    id_venta: int
    total: float
    fecha_venta: datetime
    mensaje: str = "Venta registrada exitosamente"


# ─────────────────────────────────────────────
# PLANES
# ─────────────────────────────────────────────

class PlanResponse(BaseModel):
    id_plan: int
    nombre_plan: str
    precio_base: float
    duracion_dias: int


# ─────────────────────────────────────────────
# LOCKERS
# ─────────────────────────────────────────────

class LockerAsignar(BaseModel):
    id_socio: int


class LockerResponse(BaseModel):
    id_locker: int
    numero_locker: int
    zona: str
    estado: str
    id_socio_actual: Optional[int]


# ─────────────────────────────────────────────
# PORTAL AUTENTICACIÓN (Socio)
# ─────────────────────────────────────────────

class PortalLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class PortalChangePasswordRequest(BaseModel):
    password_actual: str = Field(..., min_length=1)
    password_nuevo: str = Field(..., min_length=8)


# ─────────────────────────────────────────────
# PORTAL CLIENTE (Dashboard del Socio)
# ─────────────────────────────────────────────

class PlanPortalResponse(BaseModel):
    id_plan: int
    nombre_plan: str
    precio_base: float
    duracion_dias: int
    fecha_inicio: Optional[datetime]
    fecha_vencimiento: Optional[datetime]


class EjercicioResponse(BaseModel):
    nombre: str
    series: int
    repeticiones: int
    peso_kg: Optional[float]
    descanso_segundos: int


class RutinaResponse(BaseModel):
    id_rutina: int
    nombre_rutina: str
    nivel: str
    descripcion: Optional[str]
    ejercicios: list[dict]  # JSONB data


# ─────────────────────────────────────────────
# CMS - TEMAS VISUALES
# ─────────────────────────────────────────────

class CMSThemeResponse(BaseModel):
    id_tema: int
    nombre_tema: str
    colores: dict
    animaciones: dict
    botones_estilo: dict
    tipografia: dict
    layouts: dict
    activo: bool


class CMSThemeUpdate(BaseModel):
    colores: Optional[dict] = None
    animaciones: Optional[dict] = None
    botones_estilo: Optional[dict] = None
    tipografia: Optional[dict] = None
    layouts: Optional[dict] = None
    activo: Optional[bool] = None


# ─────────────────────────────────────────────
# CONFIGURACIÓN DEL GIMNASIO
# ─────────────────────────────────────────────

class GymConfigResponse(BaseModel):
    id_config: int
    nombre_gimnasio: str
    lockers_habilitados: bool
    cantidad_lockers: int
    horario_apertura: Optional[str]
    horario_cierre: Optional[str]
    precios_planes: dict = {}
    asignacion_lockers_automatica: bool = False
    pantalla_bienvenida_habilitada: bool = False
    duracion_pantalla_bienvenida: int = 4
    pantalla_bienvenida_logo_url: Optional[str] = None
    pantalla_bienvenida_tema: str = "azul"


class GymConfigUpdate(BaseModel):
    nombre_gimnasio: Optional[str] = None
    lockers_habilitados: Optional[bool] = None
    cantidad_lockers: Optional[int] = None
    horario_apertura: Optional[str] = None
    horario_cierre: Optional[str] = None
    precios_planes: Optional[dict] = None
    asignacion_lockers_automatica: Optional[bool] = None
    pantalla_bienvenida_habilitada: Optional[bool] = None
    duracion_pantalla_bienvenida: Optional[int] = None
    pantalla_bienvenida_logo_url: Optional[str] = None
    pantalla_bienvenida_tema: Optional[str] = None
