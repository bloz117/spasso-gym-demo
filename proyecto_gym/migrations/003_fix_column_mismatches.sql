-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 003: CORRECCIÓN DE DESAJUSTES DE COLUMNAS
-- Fecha: Julio 2026
-- Descripción: La migración 002 creó las tablas portal_accounts y gym_config con
--              nombres de columna que NO coinciden con los que usa el código Python
--              real (routes/socios.py, routes/portal_auth.py, routes/gym_config.py,
--              routes/lockers.py). Esto causaba errores 500 al registrar socios y
--              al actualizar la configuración de lockers.
--
--              Esta migración RENOMBRA las columnas para que coincidan con el
--              código (que es consistente en sí mismo entre todos los archivos),
--              en vez de reescribir el backend entero.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── portal_accounts: socio_id → id_socio ──────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'portal_accounts' AND column_name = 'socio_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'portal_accounts' AND column_name = 'id_socio'
    ) THEN
        ALTER TABLE portal_accounts RENAME COLUMN socio_id TO id_socio;
    END IF;
END $$;

-- El diseño real de login del portal usa el email del socio (tabla `socios`),
-- no un username separado. Se relaja la restricción para que el registro de
-- un socio no falle si el backend no provee username.
-- (Protegido con IF EXISTS por si esta migración se corre antes de que
--  exista la tabla portal_accounts — no debería pasar, pero así no rompe
--  toda la transacción si el orden de migraciones se altera.)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_accounts') THEN
        ALTER TABLE portal_accounts ALTER COLUMN username DROP NOT NULL;
    END IF;
END $$;

-- ── gym_config: renombrar columnas al esquema que usa el backend ──────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gym_config' AND column_name='id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gym_config' AND column_name='id_config') THEN
        ALTER TABLE gym_config RENAME COLUMN id TO id_config;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gym_config' AND column_name='lockers_enabled')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gym_config' AND column_name='lockers_habilitados') THEN
        ALTER TABLE gym_config RENAME COLUMN lockers_enabled TO lockers_habilitados;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gym_config' AND column_name='locker_count')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gym_config' AND column_name='cantidad_lockers') THEN
        ALTER TABLE gym_config RENAME COLUMN locker_count TO cantidad_lockers;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gym_config' AND column_name='gym_name')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gym_config' AND column_name='nombre_gimnasio') THEN
        ALTER TABLE gym_config RENAME COLUMN gym_name TO nombre_gimnasio;
    END IF;
END $$;

-- Columnas de horario que el backend espera pero la migración 002 nunca creó
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gym_config') THEN
        ALTER TABLE gym_config ADD COLUMN IF NOT EXISTS horario_apertura TIME;
        ALTER TABLE gym_config ADD COLUMN IF NOT EXISTS horario_cierre TIME;
    END IF;
END $$;

COMMIT;
