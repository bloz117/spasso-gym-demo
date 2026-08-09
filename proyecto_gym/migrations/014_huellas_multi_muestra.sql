-- 014_huellas_multi_muestra.sql
-- Antes se guardaba UNA sola imagen por huella. Eso hacía que un enrolamiento
-- de mala calidad (dedo mal puesto, movido, etc.) quedara guardado tal cual,
-- sin forma de detectar el error en el momento — y luego esa huella no se
-- reconocía bien, o peor, se confundía con la de otra persona.
--
-- Ahora Registro y "Volver a registrar huella" piden 3 toques del dedo en
-- vez de 1-2, y el backend exige que los 3 sean del mismo dedo (se
-- comparan entre sí) antes de guardarlos — si no coinciden, se rechaza el
-- enrolamiento entero y se le pide a la recepcionista repetirlo. Al
-- identificar (Asistencia/Renovaciones), se compara la huella recién
-- tocada contra las 3 muestras guardadas de cada socio y se exige que
-- calce con al menos 2 de las 3 (si el socio tiene las 3) para aceptarla
-- — así una coincidencia de casualidad con una sola muestra ya no alcanza
-- para confundir a dos personas.
--
-- Compatibilidad: las huellas ya guardadas ANTES de esta migración quedan
-- con solo 1 muestra (imagen_png) y NULL en las columnas nuevas — siguen
-- funcionando igual que antes (con 1 sola muestra alcanza para aceptar),
-- no hace falta volver a registrar a nadie por esto.
--
-- Idempotente: seguro de correr más de una vez.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'huellas_biometricas' AND column_name = 'imagen_png_2'
    ) THEN
        ALTER TABLE huellas_biometricas ADD COLUMN imagen_png_2 BYTEA;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'huellas_biometricas' AND column_name = 'imagen_png_3'
    ) THEN
        ALTER TABLE huellas_biometricas ADD COLUMN imagen_png_3 BYTEA;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'huellas_biometricas' AND column_name = 'num_keypoints_2'
    ) THEN
        ALTER TABLE huellas_biometricas ADD COLUMN num_keypoints_2 INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'huellas_biometricas' AND column_name = 'num_keypoints_3'
    ) THEN
        ALTER TABLE huellas_biometricas ADD COLUMN num_keypoints_3 INTEGER;
    END IF;
END $$;
