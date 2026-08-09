-- ============================================================
-- seed_data.sql — Datos iniciales para módulo de recepción
-- Ejecutar DESPUÉS del script principal de creación de tablas
-- ============================================================

-- Roles y usuario admin (contraseña '12345' — se migrará a bcrypt en el primer login)
INSERT INTO roles_permisos (nombre_rol) VALUES ('Administrador'), ('Recepcionista')
    ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO usuarios_sistema (username, password_hash, id_rol)
VALUES ('admin_veimar', '12345', 1)
    ON CONFLICT (username) DO NOTHING;

-- Usuario recepcionista de prueba
INSERT INTO usuarios_sistema (username, password_hash, id_rol)
VALUES ('recepcion1', '12345', 2)
    ON CONFLICT (username) DO NOTHING;

-- Configuración global
INSERT INTO config_global (clave, valor, categoria) VALUES
    ('moneda', 'Bs.', 'Finanzas'),
    ('label_socio', 'Atleta', 'General'),
    ('gym_nombre', 'Spasso Sauna & Gym', 'General')
ON CONFLICT (clave) DO NOTHING;

-- Hardware (lector de huella para asistencias)
INSERT INTO hardware_perfiles (tipo_dispositivo, modelo_nombre) VALUES
    ('Lector de Huella', 'DigitalPersona 4500')
ON CONFLICT DO NOTHING;

-- Lockers iniciales
INSERT INTO gestion_lockers (numero_locker, zona) VALUES
    (1, 'VIP Varonil'), (2, 'VIP Varonil'), (3, 'VIP Varonil'),
    (4, 'General Varonil'), (5, 'General Varonil'), (6, 'General Varonil'),
    (7, 'VIP Femenino'), (8, 'VIP Femenino'),
    (9, 'General Femenino'), (10, 'General Femenino')
ON CONFLICT (numero_locker) DO NOTHING;

-- Planes de membresía (sincronizados con las tarifas del HTML)
INSERT INTO planes (nombre_plan, precio_base, duracion_dias) VALUES
    ('Básico',   120.00, 30),
    ('Premium',  180.00, 30),
    ('VIP',      200.00, 30),
    ('Secion Día',    10.00, 1)
ON CONFLICT DO NOTHING;

-- Métodos de pago
INSERT INTO metodos_pago (nombre_metodo) VALUES
    ('Efectivo'),
    ('QR / Transferencia'),
    ('Tarjeta de Débito'),
    ('Tarjeta de Crédito')
ON CONFLICT DO NOTHING;

-- Beneficios maestros
INSERT INTO beneficios_maestros (descripcion) VALUES
    ('Acceso a equipos'),
    ('Horario estándar'),
    ('1 evaluación mensual'),
    ('Acceso ilimitado'),
    ('2 sesiones con entrenador'),
    ('Acceso a clases grupales'),
    ('Uso de sauna'),
    ('Acceso 24/7'),
    ('Entrenador personal'),
    ('Acceso a todas las áreas'),
    ('Plan nutricional'),
    ('2 invitados/mes')
ON CONFLICT DO NOTHING;

-- Promociones actuales
INSERT INTO promociones (nombre_promo, descuento_porcentaje, fecha_inicio, fecha_fin) VALUES
    ('Inscripción de Temporada', 30, '2025-06-01', '2025-06-30'),
    ('Día del Padre', 20, '2025-06-01', '2025-06-30')
ON CONFLICT DO NOTHING;
