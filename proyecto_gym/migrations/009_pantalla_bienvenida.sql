-- 009_pantalla_bienvenida.sql
-- Configuración para la pantalla opcional de bienvenida de socios
-- (pensada para un segundo monitor de cara al socio): muestra el logo
-- del gimnasio en reposo, y cuando alguien marca entrada/salida con la
-- huella, muestra sus datos unos segundos y vuelve al logo.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gym_config' AND column_name = 'pantalla_bienvenida_habilitada'
    ) THEN
        ALTER TABLE gym_config
            ADD COLUMN pantalla_bienvenida_habilitada BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gym_config' AND column_name = 'duracion_pantalla_bienvenida'
    ) THEN
        ALTER TABLE gym_config
            ADD COLUMN duracion_pantalla_bienvenida INTEGER NOT NULL DEFAULT 4;
    END IF;
END $$;
