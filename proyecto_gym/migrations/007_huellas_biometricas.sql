-- 007_huellas_biometricas.sql
-- Tabla para guardar la huella dactilar real de cada socio (imagen PNG
-- capturada con el lector DigitalPersona U.are.U 4500) para poder
-- identificarlo automáticamente en Asistencia y Renovaciones.
-- Idempotente: seguro de correr más de una vez.

CREATE TABLE IF NOT EXISTS huellas_biometricas (
    id_huella       SERIAL PRIMARY KEY,
    id_socio        INTEGER NOT NULL UNIQUE REFERENCES socios(id_socio) ON DELETE CASCADE,
    imagen_png       BYTEA NOT NULL,
    num_keypoints   INTEGER,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_huellas_id_socio ON huellas_biometricas(id_socio);
