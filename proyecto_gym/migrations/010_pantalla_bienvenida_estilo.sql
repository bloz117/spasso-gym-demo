-- 010_pantalla_bienvenida_estilo.sql
-- Personalización visual de la pantalla de bienvenida de socios:
-- logo (imagen en base64, mismo patrón ya usado para fotos de productos)
-- y un tema de color a elegir entre unos presets.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gym_config' AND column_name = 'pantalla_bienvenida_logo_url'
    ) THEN
        ALTER TABLE gym_config
            ADD COLUMN pantalla_bienvenida_logo_url TEXT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gym_config' AND column_name = 'pantalla_bienvenida_tema'
    ) THEN
        ALTER TABLE gym_config
            ADD COLUMN pantalla_bienvenida_tema VARCHAR(20) NOT NULL DEFAULT 'azul';
    END IF;
END $$;
