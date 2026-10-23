"""
schemas.py - Modelos Pydantic para validación de datos entrada/salida.

Pydantic valida automáticamente tipos, longitudes y formatos ANTES
de que los datos lleguen a la base de datos. Esto previene errores SQL
y ataques de inyección a nivel de modelo de datos.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime
import re
import validadores as V


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
    genero: Optional[str] = None  # 'masculino' | 'femenino'
    telefono: Optional[str] = Field(None, max_length=30)

    @field_validator('nombres')
    @classmethod
    def _nombres(cls, v):
        return V.nombre_persona(v, "El nombre")

    @field_validator('apellidos')
    @classmethod
    def _apellidos(cls, v):
        return V.nombre_persona(v, "El apellido")

    @field_validator('dni')
    @classmethod
    def dni_solo_alfanumerico(cls, v):
        v = (v or '').strip()
        if not re.match(r'^[A-Za-z0-9\-]{5,20}$', v):
            raise ValueError('El carnet/DNI solo puede contener letras, números y guiones (5 a 20 caracteres)')
        return v.upper()

    @field_validator('email', mode='after')
    @classmethod
    def _email_minusculas(cls, v):
        return str(v).strip().lower() if v else None

    @field_validator('telefono')
    @classmethod
    def _telefono(cls, v):
        return V.telefono(v)

    @field_validator('genero')
    @classmethod
    def _genero(cls, v):
        if v in (None, ''):
            return None
        if v not in ('masculino', 'femenino'):
            raise ValueError("El género debe ser 'masculino' o 'femenino'")
        return v


class SocioResponse(BaseModel):
    id_socio: int
    nombres: str
    apellidos: str
    dni: str
    email: Optional[str]
    fecha_registro: datetime
    # Solo en la respuesta del registro: acceso al portal y si el correo de
    # bienvenida se envía solo ("automatico") o queda para enviarlo a mano.
    portal_credentials: Optional[dict] = None
    bienvenida_auto: Optional[str] = None


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
# CAJA (apertura/cierre de turno y movimientos de efectivo)
# ─────────────────────────────────────────────

class CajaAbrir(BaseModel):
    monto_apertura: float = Field(..., ge=0, le=10_000_000)


class CajaCerrar(BaseModel):
    monto_cierre_declarado: float = Field(..., ge=0)


class CajaMovimientoCreate(BaseModel):
    tipo: str = Field(..., pattern=r'^(deposito|retiro)$')
    monto: float = Field(..., gt=0, le=10_000_000)
    motivo: Optional[str] = Field(default=None, max_length=200)


# ─────────────────────────────────────────────
# ÓRDENES ABIERTAS (guardar una venta en curso sin cobrarla)
# ─────────────────────────────────────────────

class OrdenAbiertaItem(BaseModel):
    id_item: int
    tipo_item: str = Field(..., pattern=r'^(plan|producto|servicio)$')
    nombre: str
    precio: float = Field(..., gt=0)
    cantidad: int = Field(..., ge=1)


class OrdenAbiertaCreate(BaseModel):
    referencia: Optional[str] = Field(default=None, max_length=100)
    items: list[OrdenAbiertaItem] = Field(..., min_length=1)
    total: float = Field(..., gt=0)


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
    email: str
    password: str = Field(..., min_length=1)


class PortalChangePasswordRequest(BaseModel):
    password_actual: Optional[str] = Field(default=None, max_length=72)  # ya no se pide
    password_nuevo: str = Field(..., min_length=8, max_length=72)

    @field_validator('password_nuevo')
    @classmethod
    def _nueva(cls, v):
        v = V.contrasena(v, minimo=8)
        if not (re.search(r'[A-Za-z]', v) and re.search(r'\d', v)):
            raise ValueError('La contraseña nueva debe combinar letras y números')
        return v

    @model_validator(mode='after')
    def _distinta(self):
        if self.password_actual and self.password_actual == self.password_nuevo:
            raise ValueError('La contraseña nueva debe ser distinta a la actual')
        return self


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
    pantalla_bienvenida_tema: str = "auto"
    # Plantillas de tickets/comprobantes (ver routes/gym_config.py::PLANTILLA_TICKET_DEFAULT
    # para la forma exacta del dict — siempre vienen con valores por defecto
    # rellenados, nunca None, aunque el gimnasio nunca las haya personalizado).
    ticket_registro_config: dict = {}
    ticket_renovacion_config: dict = {}
    ticket_venta_config: dict = {}
    # Diseño predeterminado de la Tarjeta de Socio (ver
    # routes/gym_config.py::PLANTILLA_TARJETA_DEFAULT) — un plan puntual
    # puede tener su propio diseño especial en planes.tarjeta_config.
    tarjeta_socio_config_default: dict = {}


class GymConfigUpdate(BaseModel):
    nombre_gimnasio: Optional[str] = None
    lockers_habilitados: Optional[bool] = None
    cantidad_lockers: Optional[int] = Field(None, ge=0, le=1000)
    horario_apertura: Optional[str] = None
    horario_cierre: Optional[str] = None

    @field_validator('nombre_gimnasio')
    @classmethod
    def _nombre_gym(cls, v):
        return None if v is None else V.texto(v, "El nombre del gimnasio", minimo=2, maximo=80)

    @field_validator('horario_apertura', 'horario_cierre')
    @classmethod
    def _horas(cls, v):
        return None if v in (None, '') else V.hora(v, "El horario")
    precios_planes: Optional[dict] = None
    asignacion_lockers_automatica: Optional[bool] = None
    pantalla_bienvenida_habilitada: Optional[bool] = None
    duracion_pantalla_bienvenida: Optional[int] = Field(None, ge=1, le=60)
    pantalla_bienvenida_logo_url: Optional[str] = None
    pantalla_bienvenida_tema: Optional[str] = None
    ticket_registro_config: Optional[dict] = None
    ticket_renovacion_config: Optional[dict] = None
    ticket_venta_config: Optional[dict] = None
    tarjeta_socio_config_default: Optional[dict] = None
    hardware_config: Optional[dict] = None

    @field_validator('pantalla_bienvenida_tema')
    @classmethod
    def _tema_pantalla(cls, v):
        # Mismos fondos que Recepción; "auto" = el que use Recepción.
        if v is None:
            return v
        if v not in ('auto', 'claro', 'claro-tenue', 'liso', 'movimiento'):
            raise ValueError("El tema de la pantalla de bienvenida no es válido")
        return v
