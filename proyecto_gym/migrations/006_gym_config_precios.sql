-- 006_gym_config_precios.sql
-- Agrega una columna JSONB a gym_config para guardar los precios de todos
-- los planes/membresías configurables desde Configuración > Configuración
-- de Precios. Antes esos campos del formulario no se guardaban en ningún
-- lado (ni en localStorage ni en la base de datos), por eso al cambiar un
-- precio y registrar un socio nuevo seguía usando el precio viejo.
-- Idempotente: seguro de correr más de una vez.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gym_config')
       AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gym_config' AND column_name = 'precios_planes'
    ) THEN
        ALTER TABLE gym_config ADD COLUMN precios_planes JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;
