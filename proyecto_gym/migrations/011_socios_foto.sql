-- 011_socios_foto.sql
-- Foto de perfil opcional para cada socio (mismo patrón ya usado para
-- fotos de productos y el logo de la pantalla de bienvenida: se guarda
-- como base64 directamente en la columna, sin servidor de archivos aparte).
-- Se usa en la tarjeta de detalle del socio (botón del ojo en Miembros /
-- Estadísticas), donde también se puede editar nombre, correo, carnet y
-- volver a registrar la huella.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'socios' AND column_name = 'foto_url'
    ) THEN
        ALTER TABLE socios
            ADD COLUMN foto_url TEXT NULL;
    END IF;
END $$;
