-- =====================================================================
-- schema_cloud.sql — Base de datos de la NUBE (portal público)
--
-- Contiene SOLO lo que el portal necesita. No hay: huellas, ventas, caja,
-- cuentas de Administrador/Recepcionista, configuración de correo ni fotos.
-- Es idempotente (se puede ejecutar muchas veces): main_cloud.py lo corre
-- al arrancar.
-- Los datos los llena Recepción por sincronización (sync_core.py).
-- =====================================================================

CREATE TABLE IF NOT EXISTS roles_permisos (
    id_rol     INTEGER PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

-- Solo cuentas de Entrenador (las de personal de Recepción NUNCA llegan acá)
CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id_usuario    INTEGER PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    id_rol        INTEGER REFERENCES roles_permisos(id_rol),
    permisos      TEXT,
    correo        VARCHAR(150),
    login_huella  BOOLEAN NOT NULL DEFAULT FALSE,
    id_socio_huella INTEGER
);

CREATE TABLE IF NOT EXISTS categorias_planes (
    id_categoria INTEGER PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    orden        INTEGER NOT NULL DEFAULT 0,
    activo       BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planes (
    id_plan        INTEGER PRIMARY KEY,
    nombre_plan    VARCHAR(100) NOT NULL,
    precio_base    NUMERIC,
    duracion_dias  INTEGER NOT NULL,
    id_categoria   INTEGER NOT NULL REFERENCES categorias_planes(id_categoria),
    descripcion    TEXT,
    activo         BOOLEAN NOT NULL DEFAULT TRUE,
    tarjeta_config JSONB,
    incluye_rutina BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS socios (
    id_socio       INTEGER PRIMARY KEY,
    uuid_web       UUID DEFAULT gen_random_uuid() UNIQUE,
    nombres        VARCHAR(100) NOT NULL,
    apellidos      VARCHAR(100) NOT NULL,
    dni            VARCHAR(30) NOT NULL UNIQUE,
    email          VARCHAR(150) UNIQUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    foto_url       TEXT,                 -- no se sincroniza (queda vacío)
    activo         BOOLEAN NOT NULL DEFAULT TRUE,
    genero         VARCHAR(10),
    telefono       VARCHAR(30)           -- no se sincroniza (queda vacío)
);

CREATE TABLE IF NOT EXISTS portal_accounts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_socio              INTEGER NOT NULL UNIQUE REFERENCES socios(id_socio) ON DELETE CASCADE,
    username              VARCHAR(100) UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    temp_password         VARCHAR(100),  -- nunca se sincroniza: en la nube siempre vacío
    must_change_password  BOOLEAN DEFAULT TRUE,
    is_active             BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT now(),
    last_login            TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ DEFAULT now(),
    bienvenida_enviada_en TIMESTAMPTZ,
    sync_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS membresias (
    id_membresia      INTEGER PRIMARY KEY,
    id_socio          INTEGER NOT NULL REFERENCES socios(id_socio) ON DELETE CASCADE,
    tipo_membresia    VARCHAR(50),
    plan              VARCHAR(100),
    fecha_inicio      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_vencimiento TIMESTAMPTZ NOT NULL,
    estado            VARCHAR(30) NOT NULL DEFAULT 'activo',
    monto             NUMERIC DEFAULT 0,
    metodo_pago       VARCHAR(30) DEFAULT 'efectivo',   -- no se sincroniza
    creado_en         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_membresias_socio ON membresias (id_socio, fecha_vencimiento DESC);

CREATE TABLE IF NOT EXISTS gestion_lockers (
    id_locker       INTEGER PRIMARY KEY,
    numero_locker   INTEGER NOT NULL UNIQUE,
    zona            VARCHAR(50),
    estado          VARCHAR(30) DEFAULT 'Libre',
    id_socio_actual INTEGER REFERENCES socios(id_socio) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asistencias_log (
    id_log         INTEGER PRIMARY KEY,
    id_socio       INTEGER REFERENCES socios(id_socio) ON DELETE CASCADE,
    fecha_entrada  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_hardware    INTEGER,              -- no se sincroniza
    id_locker      INTEGER,
    fecha_salida   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_asistencias_socio ON asistencias_log (id_socio, fecha_entrada DESC);

CREATE TABLE IF NOT EXISTS entrenador_socios (
    id_entrenador INTEGER NOT NULL REFERENCES usuarios_sistema(id_usuario) ON DELETE CASCADE,
    id_socio      INTEGER NOT NULL REFERENCES socios(id_socio) ON DELETE CASCADE,
    PRIMARY KEY (id_entrenador, id_socio)
);

CREATE TABLE IF NOT EXISTS workout_routines (
    id               INTEGER PRIMARY KEY,
    level            VARCHAR(50) NOT NULL,
    name             VARCHAR(150) NOT NULL,
    description      TEXT,
    duration_minutes INTEGER DEFAULT 45,
    exercises        JSONB NOT NULL,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cms_theme (
    id               INTEGER PRIMARY KEY,
    color_palette    VARCHAR(50) NOT NULL,
    animation_preset VARCHAR(50) NOT NULL,
    button_shape     VARCHAR(50) NOT NULL,
    typography       VARCHAR(50) NOT NULL,
    layout_preset    VARCHAR(50) NOT NULL,
    custom_css       TEXT,
    is_active        BOOLEAN DEFAULT FALSE,
    created_by       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    musica_archivo   VARCHAR(200) DEFAULT 'worry (Slowed).mp3',
    hero_imagenes    TEXT,
    hero_fondo       TEXT,
    contenido_portal TEXT
);

-- Datos que NACEN en la nube (se traen de vuelta a Recepción)
CREATE TABLE IF NOT EXISTS perfil_fisico_socio (
    id_socio        INTEGER PRIMARY KEY REFERENCES socios(id_socio) ON DELETE CASCADE,
    estatura_cm     NUMERIC(5,1),
    peso_kg         NUMERIC(5,1),
    actividad       VARCHAR(20),
    objetivo        VARCHAR(20),
    dias_semana     INTEGER,
    lesiones        TEXT,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    peso_inicial_kg NUMERIC(5,1),
    desde           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rutinas_socio (
    id_socio       INTEGER PRIMARY KEY REFERENCES socios(id_socio) ON DELETE CASCADE,
    id_entrenador  INTEGER REFERENCES usuarios_sistema(id_usuario) ON DELETE SET NULL,
    contenido      TEXT NOT NULL,
    publicada      BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Imágenes y música subidas desde Recepción (el disco de Render es efímero,
-- por eso los archivos viven en la base de datos de la nube)
CREATE TABLE IF NOT EXISTS portal_media (
    carpeta    VARCHAR(20)  NOT NULL,
    nombre     VARCHAR(200) NOT NULL,
    mime       VARCHAR(80)  NOT NULL,
    sha256     CHAR(64)     NOT NULL,
    tamano     INTEGER      NOT NULL,
    datos      BYTEA        NOT NULL,
    actualizado TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (carpeta, nombre)
);
