-- 008_asistencia_lockers_biometrico.sql
-- Soporte para: registrar entrada/salida por huella y asignar/liberar
-- casillero automáticamente (o manualmente) en el mismo evento.
--
-- NOTA: la auditoría inicial del proyecto decía que asistencias_log.
-- fecha_salida ya existía, pero al probar contra la base de datos real
-- (primera prueba en vivo con el lector) salió el error
-- "no existe la columna «fecha_salida»" — la documentación original
-- describía el diseño planeado, no necesariamente lo que terminó
-- creado. Por eso esta migración también la agrega, de forma segura
-- (no rompe nada si en algún ambiente sí llegara a existir).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'asistencias_log' AND column_name = 'fecha_salida'
    ) THEN
        ALTER TABLE asistencias_log
            ADD COLUMN fecha_salida TIMESTAMPTZ NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'asistencias_log' AND column_name = 'id_locker'
    ) THEN
        ALTER TABLE asistencias_log
            ADD COLUMN id_locker INTEGER NULL REFERENCES gestion_lockers(id_locker);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'gym_config' AND column_name = 'asignacion_lockers_automatica'
    ) THEN
        ALTER TABLE gym_config
            ADD COLUMN asignacion_lockers_automatica BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;
