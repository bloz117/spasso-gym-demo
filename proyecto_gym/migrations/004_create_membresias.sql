-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 004: CREAR TABLA `membresias` (faltaba por completo)
-- Fecha: Julio 2026
-- Descripción: routes/socios.py (renovar_membresia, listar_vencimientos,
--              retirar_socio) depende de una tabla `membresias` que nunca fue
--              creada por ninguna migración del proyecto. Sin ella, Vencimientos,
--              Renovaciones y el registro inicial de plan al crear un socio
--              fallan con "no existe la relación «membresias»".
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS membresias (
    id_membresia SERIAL PRIMARY KEY,

    id_socio INTEGER NOT NULL REFERENCES socios(id_socio) ON DELETE CASCADE,

    tipo_membresia VARCHAR(50),   -- 'plan' | 'anual' | 'seccion' | 'premium' | 'profesional'
    plan VARCHAR(100),            -- nombre visible: 'Básico', 'Estándar', 'Premium', etc.

    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_vencimiento TIMESTAMPTZ NOT NULL,

    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (
        estado IN ('activo', 'por-vencer', 'vencido', 'renovado', 'retirado')
    ),

    monto NUMERIC(10, 2) DEFAULT 0,
    metodo_pago VARCHAR(20) DEFAULT 'efectivo',

    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membresias_id_socio ON membresias(id_socio);
CREATE INDEX IF NOT EXISTS idx_membresias_estado ON membresias(estado);
CREATE INDEX IF NOT EXISTS idx_membresias_vencimiento ON membresias(fecha_vencimiento);

COMMENT ON TABLE membresias IS 'Historial de membresías/planes de cada socio (una fila por período pagado)';

COMMIT;
