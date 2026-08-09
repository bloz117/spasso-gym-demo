-- 012_socios_activo.sql
-- "Eliminar" un socio desde la app en realidad hace un soft-delete: se
-- marca socios.activo = false y deja de aparecer en Miembros/Estadísticas,
-- pero su fila y todo su historial (asistencias, ventas, membresías,
-- huella) se quedan intactos en la base de datos como respaldo — nada se
-- borra de verdad.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'socios' AND column_name = 'activo'
    ) THEN
        ALTER TABLE socios
            ADD COLUMN activo BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;
