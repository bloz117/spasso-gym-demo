-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 002: SPASSO GYM — PORTAL PÚBLICO + CMS + RUTINAS
-- Versión: 2.0 | Fecha: Junio 2026
-- Descripción: Crear tablas para autenticación de socios, configuración visual del 
--              portal público, temas CMS, y rutinas de entrenamiento
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION;

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA 1: CUENTAS DEL PORTAL PÚBLICO (socios)
-- ══════════════════════════════════════════════════════════════════════════════
-- Almacena credenciales de socios para acceder al portal público del gimnasio
-- (ver planes, rutinas, cambiar contraseña, etc.)

CREATE TABLE IF NOT EXISTS portal_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relación con la tabla de socios existente
    socio_id INTEGER NOT NULL UNIQUE REFERENCES socios(id_socio) ON DELETE CASCADE,
    
    -- Credenciales
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Contraseña temporal (se borra después del primer cambio)
    temp_password VARCHAR(100),
    
    -- Flag de seguridad: debe cambiar contraseña en primer login
    must_change_password BOOLEAN DEFAULT TRUE,
    
    -- Estado de la cuenta
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT portal_username_not_empty CHECK (LENGTH(TRIM(username)) > 0),
    CONSTRAINT portal_password_not_empty CHECK (LENGTH(TRIM(password_hash)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_portal_accounts_username ON portal_accounts(username);
CREATE INDEX IF NOT EXISTS idx_portal_accounts_socio_id ON portal_accounts(socio_id);
CREATE INDEX IF NOT EXISTS idx_portal_accounts_is_active ON portal_accounts(is_active);

COMMENT ON TABLE portal_accounts IS 'Autenticación de socios en el portal público';
COMMENT ON COLUMN portal_accounts.temp_password IS 'Se asigna al crear, se borra tras primer cambio';
COMMENT ON COLUMN portal_accounts.must_change_password IS 'Fuerza cambio de password en primer login';


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA 2: CONFIGURACIÓN GLOBAL DEL GIMNASIO
-- ══════════════════════════════════════════════════════════════════════════════
-- Almacena configuración de negocio (módulos habilitados, capacidades, etc.)
-- RESTRICCIÓN: Solo puede haber una fila en esta tabla

CREATE TABLE IF NOT EXISTS gym_config (
    id SERIAL PRIMARY KEY,
    
    -- Configuración de casilleros
    lockers_enabled BOOLEAN DEFAULT FALSE,
    locker_count INTEGER DEFAULT 0 CHECK (locker_count >= 0),
    
    -- Información del gimnasio
    gym_name VARCHAR(200) DEFAULT 'Spasso Sauna & Gym',
    
    -- Auditoría
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by INTEGER REFERENCES usuarios_sistema(id_usuario),
    
    -- Restricción: solo una fila permitida
    CONSTRAINT only_one_config CHECK (id = 1)
);

-- Crear índice para forzar que solo exista una fila
CREATE UNIQUE INDEX IF NOT EXISTS idx_gym_config_single ON gym_config(id);

COMMENT ON TABLE gym_config IS 'Configuración global del gimnasio. Solo una fila.';
COMMENT ON COLUMN gym_config.locker_count IS 'Número total de casilleros disponibles';
COMMENT ON COLUMN gym_config.updated_by IS 'Usuario que última vez modificó esta configuración';


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA 3: CONFIGURACIÓN VISUAL DEL CMS (Temas)
-- ══════════════════════════════════════════════════════════════════════════════
-- Almacena presets visuales para personalizar el portal público sin código
-- (paletas de color, animaciones, tipografía, layout)

CREATE TABLE IF NOT EXISTS cms_theme (
    id SERIAL PRIMARY KEY,
    
    -- Presets visuales (cada uno con 5 opciones)
    color_palette VARCHAR(50) NOT NULL CHECK (color_palette IN (
        'midnight_fire', 'ocean_sport', 'forest_strength', 
        'sunset_energy', 'monochrome_elite'
    )),
    
    animation_preset VARCHAR(50) NOT NULL CHECK (animation_preset IN (
        'pulse', 'slide_fade', 'zoom_in', 'bounce_light', 'none'
    )),
    
    button_shape VARCHAR(50) NOT NULL CHECK (button_shape IN (
        'rounded_full', 'rounded_md', 'square', 'pill_outline', 'neon_border'
    )),
    
    typography VARCHAR(50) NOT NULL CHECK (typography IN (
        'roboto_modern', 'montserrat_bold', 'inter_clean', 
        'oswald_sport', 'playfair_premium'
    )),
    
    layout_preset VARCHAR(50) NOT NULL CHECK (layout_preset IN (
        'hero_centered', 'sidebar_left', 'grid_cards', 
        'full_width_banner', 'minimal_list'
    )),
    
    -- CSS personalizado adicional (opcional)
    custom_css TEXT,
    
    -- Solo un tema puede estar activo
    is_active BOOLEAN DEFAULT FALSE,
    
    -- Auditoría
    created_by INTEGER NOT NULL REFERENCES usuarios_sistema(id_usuario),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT theme_name_unique CHECK (
        (is_active = TRUE AND id IS NOT NULL) OR is_active = FALSE
    )
);

CREATE INDEX IF NOT EXISTS idx_cms_theme_active ON cms_theme(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cms_theme_created_by ON cms_theme(created_by);

COMMENT ON TABLE cms_theme IS 'Temas visuales del portal público. Solo uno puede estar activo.';
COMMENT ON COLUMN cms_theme.color_palette IS 'Esquema de colores: midnight_fire, ocean_sport, etc.';
COMMENT ON COLUMN cms_theme.animation_preset IS 'Tipo de animaciones: pulse, slide_fade, zoom_in, etc.';
COMMENT ON COLUMN cms_theme.button_shape IS 'Forma de botones: rounded_full, square, neon_border, etc.';
COMMENT ON COLUMN cms_theme.typography IS 'Familia tipográfica: Roboto, Montserrat, Inter, etc.';
COMMENT ON COLUMN cms_theme.layout_preset IS 'Layout: hero_centered, sidebar_left, grid_cards, etc.';


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA 4: RUTINAS DE ENTRENAMIENTO RECOMENDADAS
-- ══════════════════════════════════════════════════════════════════════════════
-- Almacena rutinas de ejercicio (básico, medio, avanzado) con ejercicios detallados
-- Cada rutina contiene una estructura JSONB de ejercicios

CREATE TABLE IF NOT EXISTS workout_routines (
    id SERIAL PRIMARY KEY,
    
    -- Nivel de dificultad
    level VARCHAR(20) NOT NULL CHECK (level IN ('basico', 'medio', 'avanzado')),
    
    -- Información de la rutina
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Duración estimada (minutos)
    duration_minutes INTEGER DEFAULT 45,
    
    -- Array de ejercicios (JSONB para flexibilidad)
    -- Estructura: [
    --   {
    --     "name": "Sentadillas",
    --     "sets": 3,
    --     "reps": "12",
    --     "rest_seconds": 60,
    --     "muscle_group": "Cuádriceps",
    --     "instructions": "..."
    --   },
    --   ...
    -- ]
    exercises JSONB NOT NULL,
    
    -- Estado
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT routine_exercises_not_empty CHECK (jsonb_array_length(exercises) > 0)
);

CREATE INDEX IF NOT EXISTS idx_workout_routines_level ON workout_routines(level);
CREATE INDEX IF NOT EXISTS idx_workout_routines_is_active ON workout_routines(is_active);

COMMENT ON TABLE workout_routines IS 'Rutinas de entrenamiento recomendadas por nivel (básico, medio, avanzado)';
COMMENT ON COLUMN workout_routines.exercises IS 'Array JSONB de ejercicios con detalles (sets, reps, descanso, etc.)';


-- ══════════════════════════════════════════════════════════════════════════════
-- DATOS SEMILLA: CONFIGURACIÓN INICIAL
-- ══════════════════════════════════════════════════════════════════════════════

-- gym_config: Fila única con configuración inicial
-- NOTA: updated_by/created_by NO se asumen como id_usuario=1 — se busca
-- dinámicamente el primer usuario existente en usuarios_sistema, porque
-- asumir un ID fijo rompía esta migración entera si el admin no tenía
-- exactamente id_usuario=1 (violación de llave foránea que revertía TODA
-- la transacción, incluyendo las tablas ya creadas).
INSERT INTO gym_config (id, lockers_enabled, locker_count, gym_name, updated_by)
VALUES (1, FALSE, 0, 'Spasso Sauna & Gym', (SELECT id_usuario FROM usuarios_sistema ORDER BY id_usuario LIMIT 1))
ON CONFLICT DO NOTHING;

-- cms_theme: Tema por defecto activo
INSERT INTO cms_theme (
    color_palette, animation_preset, button_shape, typography, layout_preset,
    custom_css, is_active, created_by
)
SELECT
    'ocean_sport',
    'slide_fade',
    'rounded_md',
    'inter_clean',
    'hero_centered',
    NULL,
    TRUE,
    id_usuario
FROM usuarios_sistema
ORDER BY id_usuario
LIMIT 1
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- DATOS SEMILLA: RUTINAS DE ENTRENAMIENTO (9 rutinas: 3 por nivel)
-- ══════════════════════════════════════════════════════════════════════════════

-- RUTINAS BÁSICAS (3 rutinas)
INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'basico',
    'Introducción al Gimnasio',
    'Rutina para principiantes que comienzan su viaje fitness. Enfocada en técnica y adaptación.',
    40,
    '[
      {
        "name": "Caminata en Cinta",
        "sets": 1,
        "reps": "10 minutos",
        "rest_seconds": 0,
        "muscle_group": "Calentamiento",
        "instructions": "Comienza a ritmo lento, aumenta gradualmente la velocidad"
      },
      {
        "name": "Sentadillas con Peso Corporal",
        "sets": 3,
        "reps": "12",
        "rest_seconds": 60,
        "muscle_group": "Piernas",
        "instructions": "Desciende lentamente, mantén el pecho arriba, rodillas no pasen puntas de pies"
      },
      {
        "name": "Flexiones de Pecho Inclinadas",
        "sets": 3,
        "reps": "10",
        "rest_seconds": 60,
        "muscle_group": "Pecho",
        "instructions": "Usa un banco inclinado, controla el descenso, exhala al subir"
      },
      {
        "name": "Remo con Máquina",
        "sets": 3,
        "reps": "12",
        "rest_seconds": 60,
        "muscle_group": "Espalda",
        "instructions": "Tira hacia tu cuerpo, mantén la espalda recta, no uses impulso"
      },
      {
        "name": "Extensión de Brazos con Polea",
        "sets": 3,
        "reps": "15",
        "rest_seconds": 45,
        "muscle_group": "Brazos",
        "instructions": "Brazos rectos, contrae bíceps, movimiento controlado"
      },
      {
        "name": "Abdominal Máquina",
        "sets": 3,
        "reps": "15",
        "rest_seconds": 45,
        "muscle_group": "Abdomen",
        "instructions": "Contrae lentamente, evita usar el cuello, exhala en la contracción"
      },
      {
        "name": "Estiramiento General",
        "sets": 1,
        "reps": "5 minutos",
        "rest_seconds": 0,
        "muscle_group": "Enfriamiento",
        "instructions": "Estira cada grupo muscular por 30 segundos, respira profundamente"
      }
    ]'::jsonb,
    TRUE
);

INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'basico',
    'Full Body Principiante',
    'Entrena todo el cuerpo con ejercicios básicos. Ideal para construir base sólida.',
    45,
    '[
      {
        "name": "Bicicleta Estática",
        "sets": 1,
        "reps": "5 minutos",
        "rest_seconds": 0,
        "muscle_group": "Calentamiento",
        "instructions": "Ritmo moderado, aumenta intensidad gradualmente"
      },
      {
        "name": "Press de Pecho con Mancuernas",
        "sets": 3,
        "reps": "10",
        "rest_seconds": 90,
        "muscle_group": "Pecho",
        "instructions": "Mancuernas al nivel del pecho, sube controladamente, contrae al subir"
      },
      {
        "name": "Jalón Frontal Máquina",
        "sets": 3,
        "reps": "12",
        "rest_seconds": 75,
        "muscle_group": "Espalda",
        "instructions": "Tira hacia el pecho, no uses impulso de piernas, palmas hacia adelante"
      },
      {
        "name": "Prensa de Piernas",
        "sets": 4,
        "reps": "12",
        "rest_seconds": 90,
        "muscle_group": "Piernas",
        "instructions": "Rodillas no traspasen puntas, desciende lentamente, sube explosivamente"
      },
      {
        "name": "Curl de Bíceps con Mancuernas",
        "sets": 3,
        "reps": "12",
        "rest_seconds": 60,
        "muscle_group": "Brazos",
        "instructions": "Movimiento semicircular, codo fijo, contrae en la subida"
      },
      {
        "name": "Extensión de Tríceps Cuerda",
        "sets": 3,
        "reps": "12",
        "rest_seconds": 60,
        "muscle_group": "Brazos",
        "instructions": "Empuja hacia abajo, brazos totalmente extendidos, contrae tríceps"
      },
      {
        "name": "Abdominales en Banco Plano",
        "sets": 3,
        "reps": "20",
        "rest_seconds": 45,
        "muscle_group": "Abdomen",
        "instructions": "Manos cruzadas en pecho, contrae abdomen, no tires del cuello"
      }
    ]'::jsonb,
    TRUE
);

INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'basico',
    'Circuito Cardio + Tono',
    'Combina cardio y tonificación. Mejora resistencia y quema calorías.',
    35,
    '[
      {
        "name": "Jumping Jacks",
        "sets": 3,
        "reps": "30 segundos",
        "rest_seconds": 30,
        "muscle_group": "Cardio",
        "instructions": "Salta mientras abres piernas y subes brazos, ritmo constante"
      },
      {
        "name": "Burpees (Modificado)",
        "sets": 3,
        "reps": "10",
        "rest_seconds": 45,
        "muscle_group": "Full Body",
        "instructions": "Flexión + salto, movimiento explosivo controlado"
      },
      {
        "name": "Escalada Estática",
        "sets": 3,
        "reps": "20 segundos",
        "rest_seconds": 40,
        "muscle_group": "Cardio",
        "instructions": "Alterna piernas rápidamente en posición de flexión"
      },
      {
        "name": "Sentadilla Dinámica",
        "sets": 3,
        "reps": "15",
        "rest_seconds": 45,
        "muscle_group": "Piernas",
        "instructions": "Con salto, explosiva pero controlada"
      },
      {
        "name": "Flexiones",
        "sets": 3,
        "reps": "8",
        "rest_seconds": 45,
        "muscle_group": "Pecho",
        "instructions": "Contacto total del cuerpo con el piso, descenso lento"
      }
    ]'::jsonb,
    TRUE
);


-- RUTINAS INTERMEDIAS (3 rutinas)
INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'medio',
    'Volumen Muscular Intermedio',
    'Hipertrofia con volumen moderado. Ideal para ganancia de masa muscular.',
    50,
    '[
      {
        "name": "Trotador Electrónico",
        "sets": 1,
        "reps": "5 minutos",
        "rest_seconds": 0,
        "muscle_group": "Calentamiento",
        "instructions": "Inclinación ligera, ritmo 6-7 km/h"
      },
      {
        "name": "Press de Banca Barras",
        "sets": 4,
        "reps": "8-10",
        "rest_seconds": 120,
        "muscle_group": "Pecho",
        "instructions": "Agarre ancho, baja hasta tocar pecho, explosión en subida"
      },
      {
        "name": "Remo Barras T",
        "sets": 4,
        "reps": "8-10",
        "rest_seconds": 120,
        "muscle_group": "Espalda",
        "instructions": "Peso pesado, técnica perfecta, contracción máxima"
      },
      {
        "name": "Sentadilla Profunda Barra",
        "sets": 4,
        "reps": "8-10",
        "rest_seconds": 150,
        "muscle_group": "Piernas",
        "instructions": "Máxima profundidad, rodillas alineadas, core contraído"
      },
      {
        "name": "Peso Muerto",
        "sets": 3,
        "reps": "6",
        "rest_seconds": 180,
        "muscle_group": "Full Body",
        "instructions": "Espalda recta, cadera por debajo de hombros, potencia en piernas"
      },
      {
        "name": "Curl Inclinado Mancuernas",
        "sets": 3,
        "reps": "10",
        "rest_seconds": 75,
        "muscle_group": "Brazos",
        "instructions": "Banco inclinado 45°, movimiento completo, mancuernas controladas"
      },
      {
        "name": "Fondos en Paralelas",
        "sets": 3,
        "reps": "10",
        "rest_seconds": 90,
        "muscle_group": "Tríceps",
        "instructions": "Cuerpo recto, descenso profundo, extensión total"
      }
    ]'::jsonb,
    TRUE
);

INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'medio',
    'Push/Pull/Legs Split',
    'Rutina dividida: Push (pecho, hombros, tríceps), Pull (espalda, bíceps), Legs.',
    55,
    '[
      {
        "name": "Press Sentado Mancuernas",
        "sets": 4,
        "reps": "10",
        "rest_seconds": 90,
        "muscle_group": "Hombros",
        "instructions": "Espalda recta contra respaldo, codos 90°, presión explosiva"
      },
      {
        "name": "Elevaciones Laterales",
        "sets": 3,
        "reps": "12",
        "rest_seconds": 60,
        "muscle_group": "Hombros",
        "instructions": "Codos ligeramente flexionados, sube hasta altura hombros"
      },
      {
        "name": "Aperturas Pecho Máquina",
        "sets": 3,
        "reps": "12",
        "rest_seconds": 60,
        "muscle_group": "Pecho",
        "instructions": "Apertura amplia, contrae en el cierre, movimiento liso"
      },
      {
        "name": "Dominadas o Jalón Asistido",
        "sets": 3,
        "reps": "8-10",
        "rest_seconds": 90,
        "muscle_group": "Espalda",
        "instructions": "Agarre ancho, tira hasta pecho, baja controladamente"
      },
      {
        "name": "Fila Sentado Máquina",
        "sets": 3,
        "reps": "12",
        "rest_seconds": 60,
        "muscle_group": "Espalda",
        "instructions": "Contracción máxima, no uses impulso de espalda baja"
      },
      {
        "name": "Curl Barras EZ",
        "sets": 3,
        "reps": "10",
        "rest_seconds": 60,
        "muscle_group": "Bíceps",
        "instructions": "Movimiento estricto, codo fijo, contracción en la cima"
      }
    ]'::jsonb,
    TRUE
);

INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'medio',
    'HIIT Intermedio',
    'Entrenamiento de alta intensidad. Quema máxima de calorías y resistencia cardiovascular.',
    40,
    '[
      {
        "name": "Calentamiento Dinámico",
        "sets": 1,
        "reps": "3 minutos",
        "rest_seconds": 0,
        "muscle_group": "Calentamiento",
        "instructions": "Movilidad articular, ligeros cardio"
      },
      {
        "name": "Sprints Trotador",
        "sets": 4,
        "reps": "20 segundos máxima velocidad",
        "rest_seconds": 40,
        "muscle_group": "Cardio",
        "instructions": "Máxima velocidad, recuperación activa"
      },
      {
        "name": "Sentadilla + Salto",
        "sets": 4,
        "reps": "15 segundos",
        "rest_seconds": 45,
        "muscle_group": "Piernas",
        "instructions": "Explosiva, intensidad máxima"
      },
      {
        "name": "Flexiones Explosivas",
        "sets": 3,
        "reps": "12 segundos",
        "rest_seconds": 48,
        "muscle_group": "Pecho",
        "instructions": "Lo más rápido posible con buena forma"
      },
      {
        "name": "Rodillas al Pecho Corriendo",
        "sets": 3,
        "reps": "20 segundos",
        "rest_seconds": 40,
        "muscle_group": "Cardio",
        "instructions": "Ritmo máximo, levanta rodillas alto"
      },
      {
        "name": "Recuperación Activa",
        "sets": 1,
        "reps": "2 minutos",
        "rest_seconds": 0,
        "muscle_group": "Enfriamiento",
        "instructions": "Caminata lenta, respiración profunda"
      }
    ]'::jsonb,
    TRUE
);


-- RUTINAS AVANZADAS (3 rutinas)
INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'avanzado',
    'Powerlifting Fuerza Máxima',
    'Enfocada en los tres levantamientos (sentadilla, peso muerto, press). Máxima fuerza.',
    60,
    '[
      {
        "name": "Barra Vacía + Calentamiento Dinámico",
        "sets": 2,
        "reps": "5 reps ligeras",
        "rest_seconds": 60,
        "muscle_group": "Calentamiento",
        "instructions": "Técnica perfecta desde el inicio"
      },
      {
        "name": "Sentadilla Competencia",
        "sets": 8,
        "reps": "1-3 reps",
        "rest_seconds": 180,
        "muscle_group": "Piernas",
        "instructions": "Carga máxima de forma segura, técnica de competencia"
      },
      {
        "name": "Press de Banca Competencia",
        "sets": 8,
        "reps": "1-3 reps",
        "rest_seconds": 180,
        "muscle_group": "Pecho",
        "instructions": "Máxima explosión, técnica de competencia"
      },
      {
        "name": "Peso Muerto Competencia",
        "sets": 6,
        "reps": "1-2 reps",
        "rest_seconds": 200,
        "muscle_group": "Full Body",
        "instructions": "Máxima carga, recuperación completa entre intentos"
      },
      {
        "name": "Accessorio: Sentadilla Frontal",
        "sets": 3,
        "reps": "5",
        "rest_seconds": 120,
        "muscle_group": "Piernas",
        "instructions": "Técnica impecable, volume moderado"
      },
      {
        "name": "Extensión de Espalda Máquina",
        "sets": 3,
        "reps": "8",
        "rest_seconds": 90,
        "muscle_group": "Espalda Baja",
        "instructions": "Rango completo, contracción máxima"
      }
    ]'::jsonb,
    TRUE
);

INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'avanzado',
    'Volumen Avanzado 5 Días',
    'Rutina de 5 días con volumen extremo. Requiere nutrición y descanso óptimos.',
    65,
    '[
      {
        "name": "Press de Banca Inclinado Barras",
        "sets": 5,
        "reps": "6-8",
        "rest_seconds": 120,
        "muscle_group": "Pecho Superior",
        "instructions": "Incline 30-45°, contracción máxima"
      },
      {
        "name": "Mancuernas Press",
        "sets": 4,
        "reps": "8-10",
        "rest_seconds": 90,
        "muscle_group": "Pecho",
        "instructions": "Rango completo, baja lentamente"
      },
      {
        "name": "Pec Deck Aperturas",
        "sets": 4,
        "reps": "10-12",
        "rest_seconds": 60,
        "muscle_group": "Pecho",
        "instructions": "Aislamiento completo, squeeze máximo"
      },
      {
        "name": "Press Hombros Barras",
        "sets": 4,
        "reps": "6-8",
        "rest_seconds": 120,
        "muscle_group": "Hombros",
        "instructions": "Poder y control"
      },
      {
        "name": "Laterales Máquina Hombros",
        "sets": 4,
        "reps": "10-12",
        "rest_seconds": 60,
        "muscle_group": "Hombros Laterales",
        "instructions": "Amplitud máxima de movimiento"
      },
      {
        "name": "Fondos en Paralelas Cargadas",
        "sets": 4,
        "reps": "8-10",
        "rest_seconds": 90,
        "muscle_group": "Tríceps",
        "instructions": "Peso adicional si es posible, rango profundo"
      }
    ]'::jsonb,
    TRUE
);

INSERT INTO workout_routines (level, name, description, duration_minutes, exercises, is_active)
VALUES (
    'avanzado',
    'Metabolic Conditioning Élite',
    'Acondicionamiento metabólico extremo. Resistencia anaeróbica máxima.',
    50,
    '[
      {
        "name": "Calentamiento Dinámico Completo",
        "sets": 1,
        "reps": "3 minutos",
        "rest_seconds": 0,
        "muscle_group": "Calentamiento",
        "instructions": "Movilidad activa, ROM completo"
      },
      {
        "name": "Carga Trasera (Farmers Carry + Caminata)",
        "sets": 4,
        "reps": "40 metros pesado",
        "rest_seconds": 90,
        "muscle_group": "Full Body",
        "instructions": "Mancuernas pesadas, ritmo explosivo"
      },
      {
        "name": "Battle Ropes (Cuerdas de Batalla)",
        "sets": 4,
        "reps": "30 segundos intensidad máxima",
        "rest_seconds": 30,
        "muscle_group": "Cardio",
        "instructions": "Alternar brazos rápidamente, máxima intensidad"
      },
      {
        "name": "Box Jump (Saltos en Caja)",
        "sets": 4,
        "reps": "10",
        "rest_seconds": 60,
        "muscle_group": "Piernas",
        "instructions": "Explosiva máxima, altura desafiante"
      },
      {
        "name": "Remo Máquina Errgo",
        "sets": 3,
        "reps": "500 metros tiempo",
        "rest_seconds": 120,
        "muscle_group": "Full Body",
        "instructions": "Velocidad consistente, potencia en cada remada"
      },
      {
        "name": "Enfriamiento Activo",
        "sets": 1,
        "reps": "3 minutos",
        "rest_seconds": 0,
        "muscle_group": "Recuperación",
        "instructions": "Camina lentamente, respira profundamente"
      }
    ]'::jsonb,
    TRUE
);


-- ══════════════════════════════════════════════════════════════════════════════
-- FIN DE LA MIGRACIÓN
-- ══════════════════════════════════════════════════════════════════════════════

COMMIT;

-- Nota: se quitó el \echo final — es un meta-comando exclusivo del cliente
-- psql y no es SQL válido. Al ejecutarse vía psycopg2 (execute_migration.py),
-- esa línea causaba un error de sintaxis que revertía TODA la transacción,
-- incluyendo las tablas ya creadas arriba. Por eso portal_accounts, gym_config,
-- cms_theme y workout_routines nunca quedaban creadas pese a que el resto del
-- script era correcto.
