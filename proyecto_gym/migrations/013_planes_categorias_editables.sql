-- 013_planes_categorias_editables.sql
-- Convierte el catálogo de planes (que antes estaba escrito directo en el
-- HTML: 5 pestañas fijas y 13 tarjetas fijas) en algo 100% editable desde
-- Configuración: el gimnasio puede crear/renombrar/eliminar categorías
-- (pestañas) y, dentro de cada una, crear/editar/eliminar planes con
-- nombre, precio, duración y una descripción corta.

-- 1) Categorías de planes (las pestañas). Reemplazan a las 5 fijas.
CREATE TABLE IF NOT EXISTS public.categorias_planes (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Extender la tabla `planes` ya existente (antes solo tenía
-- nombre_plan/precio_base/duracion_dias y no la usaba ningún endpoint real).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planes' AND column_name = 'id_categoria'
    ) THEN
        ALTER TABLE public.planes ADD COLUMN id_categoria INTEGER NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planes' AND column_name = 'descripcion'
    ) THEN
        ALTER TABLE public.planes ADD COLUMN descripcion TEXT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planes' AND column_name = 'activo'
    ) THEN
        ALTER TABLE public.planes ADD COLUMN activo BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- 3) Sembrar las 5 categorías por defecto (mismos nombres que ya se veían
-- en la app), solo si todavía no existe una categoría con ese nombre.
INSERT INTO public.categorias_planes (nombre, orden)
SELECT v.nombre, v.orden FROM (VALUES
    ('Planes Mensuales', 1),
    ('Pases Flexibles', 2),
    ('Planes Anuales', 3),
    ('Planes Premium', 4),
    ('Planes Profesional', 5)
) AS v(nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_planes c WHERE c.nombre = v.nombre);

-- 4) Sembrar los planes que ya se veían fijos en el HTML, solo si todavía
-- no existe un plan con ese nombre exacto (si la base ya tenía datos de
-- un seed anterior, no se duplica nada).
INSERT INTO public.planes (nombre_plan, precio_base, duracion_dias, descripcion, id_categoria)
SELECT v.nombre_plan, v.precio_base, v.duracion_dias, v.descripcion,
       (SELECT id_categoria FROM public.categorias_planes WHERE nombre = v.categoria_nombre LIMIT 1)
FROM (VALUES
    ('Básico', 120.00, 30, 'Acceso a instalaciones' || chr(10) || '1 mes completo' || chr(10) || 'Sin locker incluido', 'Planes Mensuales'),
    ('Estándar', 180.00, 30, '+ Lockers incluidos' || chr(10) || '1 mes completo' || chr(10) || 'Acceso a máquinas', 'Planes Mensuales'),
    ('Premium', 250.00, 30, '+ Clases grupales' || chr(10) || '+ Asesoría básica' || chr(10) || 'Locker premium', 'Planes Mensuales'),
    ('1 Día', 15.00, 1, 'Acceso por 1 día' || chr(10) || 'Horario completo', 'Pases Flexibles'),
    ('1 Semana', 80.00, 7, '7 días completos' || chr(10) || 'Acceso ilimitado', 'Pases Flexibles'),
    ('2 Semanas', 140.00, 14, '14 días completos' || chr(10) || 'Ideal para prueba', 'Pases Flexibles'),
    ('Socio de Oro', 550.00, 365, 'Matrícula anual inicial' || chr(10) || '+ 130 Bs mensual' || chr(10) || 'Acceso completo anual', 'Planes Anuales'),
    ('Socio Platino', 1200.00, 365, 'Pago anual completo' || chr(10) || 'Ahorro del 20%' || chr(10) || 'Beneficios exclusivos', 'Planes Anuales'),
    ('Premium Plus', 350.00, 30, '+ Entrenador personal 2x/sem' || chr(10) || '+ Nutrición básica' || chr(10) || 'Locker con llave', 'Planes Premium'),
    ('Premium Elite', 500.00, 30, 'Entrenador personal 4x/sem' || chr(10) || '+ Plan nutricional completo' || chr(10) || 'Acceso 24/7', 'Planes Premium'),
    ('Profesional', 400.00, 30, 'Para deportistas avanzados' || chr(10) || '+ Análisis corporal' || chr(10) || '+ Plan personalizado', 'Planes Profesional'),
    ('Atleta', 600.00, 30, 'Para atletas competitivos' || chr(10) || '+ Monitoreo constante' || chr(10) || '+ Suplementación básica', 'Planes Profesional')
) AS v(nombre_plan, precio_base, duracion_dias, descripcion, categoria_nombre)
WHERE NOT EXISTS (SELECT 1 FROM public.planes p WHERE p.nombre_plan = v.nombre_plan);

-- 5) Cualquier plan viejo que ya existiera antes de esta migración (por
-- ejemplo de un seed_data.sql anterior) y que se haya quedado sin
-- categoría, se asigna a "Pases Flexibles" si dura 14 días o menos, o a
-- "Planes Mensuales" si dura más — para que nada quede invisible.
UPDATE public.planes
SET id_categoria = (
    SELECT id_categoria FROM public.categorias_planes
    WHERE nombre = (CASE WHEN planes.duracion_dias <= 14 THEN 'Pases Flexibles' ELSE 'Planes Mensuales' END)
    LIMIT 1
)
WHERE id_categoria IS NULL;

-- 6) Ahora que todo plan tiene categoría, se puede exigir que la tenga.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'planes' AND column_name = 'id_categoria' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.planes ALTER COLUMN id_categoria SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'planes_id_categoria_fkey'
    ) THEN
        ALTER TABLE public.planes
            ADD CONSTRAINT planes_id_categoria_fkey
            FOREIGN KEY (id_categoria) REFERENCES public.categorias_planes(id_categoria);
    END IF;
END $$;
