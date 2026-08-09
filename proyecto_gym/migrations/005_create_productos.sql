-- 005_create_productos.sql
-- Crea la tabla de productos/inventario (tienda del gimnasio: suplementos, ropa, bebidas, etc.)
-- Idempotente: seguro de correr más de una vez.

CREATE TABLE IF NOT EXISTS productos (
    id_producto     SERIAL PRIMARY KEY,
    codigo          VARCHAR(50) UNIQUE,
    nombre          VARCHAR(150) NOT NULL,
    categoria       VARCHAR(50) NOT NULL DEFAULT 'otros',
    precio_compra   NUMERIC(10,2) NOT NULL DEFAULT 0,
    precio_venta    NUMERIC(10,2) NOT NULL DEFAULT 0,
    cantidad        INTEGER NOT NULL DEFAULT 0,
    stock_minimo    INTEGER NOT NULL DEFAULT 5,
    stock_maximo    INTEGER NOT NULL DEFAULT 100,
    imagen_url      TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);

-- Movimientos de stock (entradas de mercadería / ajustes manuales de inventario)
CREATE TABLE IF NOT EXISTS productos_movimientos (
    id_movimiento   SERIAL PRIMARY KEY,
    id_producto     INTEGER NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    cantidad        INTEGER NOT NULL,
    motivo          VARCHAR(255),
    id_usuario      INTEGER REFERENCES usuarios_sistema(id_usuario),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed inicial con los mismos productos de ejemplo que ya usaba el frontend simulado,
-- para que la migración de datos falsos -> reales sea transparente para el usuario.
INSERT INTO productos (codigo, nombre, categoria, precio_compra, precio_venta, cantidad, stock_minimo, stock_maximo, imagen_url)
SELECT * FROM (VALUES
    ('PROT-WHEY-1KG', 'Proteína Whey 1kg', 'suplementos', 120, 150, 25, 5, 50, NULL),
    ('CREAT-250G', 'Creatina 250g', 'suplementos', 80, 120, 30, 10, 40, NULL),
    ('BCAA-300G', 'BCAA 300g', 'suplementos', 100, 180, 20, 5, 30, NULL),
    ('PRE-WORK', 'Pre-workout', 'suplementos', 120, 200, 15, 5, 25, NULL),
    ('AGUA-500ML', 'Agua 500ml', 'bebidas', 3, 8, 100, 20, 150, NULL),
    ('ENERGY-DRINK', 'Bebida Energética', 'bebidas', 6, 12, 50, 10, 80, NULL),
    ('PROTEIN-BAR', 'Barra Proteica', 'suplementos', 6, 10, 60, 15, 100, NULL),
    ('CAMISETA-GYM', 'Camiseta Gym', 'ropa', 40, 80, 35, 10, 50, NULL)
) AS seed(codigo, nombre, categoria, precio_compra, precio_venta, cantidad, stock_minimo, stock_maximo, imagen_url)
WHERE NOT EXISTS (SELECT 1 FROM productos);
