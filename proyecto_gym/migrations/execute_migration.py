#!/usr/bin/env python3
"""
execute_migration.py - Ejecutor de migraciones para Spasso Gym
Versión: 1.0

Uso: python execute_migration.py [--migration <numero>]

Ejemplo:
  python execute_migration.py --migration 002
  python execute_migration.py              # (ejecuta la última migración)
"""

import psycopg2
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

def get_migration_path(migration_num):
    """Retorna la ruta del archivo de migración"""
    # Asume que este script está en proyecto_gym/migrations/
    migrations_dir = Path(__file__).parent
    if migration_num == '014':
        return migrations_dir / '014_huellas_multi_muestra.sql'
    elif migration_num == '013':
        return migrations_dir / '013_planes_categorias_editables.sql'
    elif migration_num == '012':
        return migrations_dir / '012_socios_activo.sql'
    elif migration_num == '011':
        return migrations_dir / '011_socios_foto.sql'
    elif migration_num == '010':
        return migrations_dir / '010_pantalla_bienvenida_estilo.sql'
    elif migration_num == '009':
        return migrations_dir / '009_pantalla_bienvenida.sql'
    elif migration_num == '008':
        return migrations_dir / '008_asistencia_lockers_biometrico.sql'
    elif migration_num == '007':
        return migrations_dir / '007_huellas_biometricas.sql'
    elif migration_num == '006':
        return migrations_dir / '006_gym_config_precios.sql'
    elif migration_num == '005':
        return migrations_dir / '005_create_productos.sql'
    elif migration_num == '004':
        return migrations_dir / '004_create_membresias.sql'
    elif migration_num == '003':
        return migrations_dir / '003_fix_column_mismatches.sql'
    elif migration_num == '002':
        return migrations_dir / '002_spasso_portal_cms_routines.sql'
    elif migration_num == '001':
        # Migración inicial si existe
        return migrations_dir / '001_spasso_initial.sql'
    return None

def load_env():
    """Carga variables de entorno desde .env"""
    # Busca .env en el directorio padre (proyecto_gym/)
    proyecto_gym = Path(__file__).parent.parent
    env_path = proyecto_gym / '.env'
    
    if env_path.exists():
        load_dotenv(env_path)
        return True
    return False

def execute_migration(migration_num='002'):
    """Ejecuta una migración específica"""
    
    print("\n" + "="*80)
    print("EJECUTOR DE MIGRACIONES — SPASSO GYM")
    print("="*80)
    
    # Cargar configuración
    print("\n📂 Cargando configuración...")
    if not load_env():
        print("⚠️  Archivo .env no encontrado. Usando variables de entorno del sistema.")
    
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = int(os.getenv('DB_PORT', '5432'))
    db_name = os.getenv('DB_NAME', 'spasso_db')
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', '')
    
    print(f"   Base de datos: {db_name}")
    print(f"   Host: {db_host}:{db_port}")
    print(f"   Usuario: {db_user}")
    
    # Obtener archivo de migración
    print(f"\n📋 Buscando migración {migration_num}...")
    migration_file = get_migration_path(migration_num)
    
    if not migration_file or not migration_file.exists():
        print(f"❌ ERROR: Archivo de migración no encontrado: {migration_file}")
        return False
    
    print(f"   ✓ Archivo: {migration_file.name}")
    
    # Conectar a BD
    print(f"\n📡 Conectando a PostgreSQL...")
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=db_password
        )
        print("   ✅ Conexión exitosa")
    except psycopg2.Error as e:
        print(f"   ❌ ERROR: No se pudo conectar a PostgreSQL")
        print(f"   Detalle: {e}")
        return False
    
    # Leer y ejecutar migración
    print(f"\n⚙️  Ejecutando migración...")
    try:
        cur = conn.cursor()
        
        # Leer archivo
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        # Ejecutar
        cur.execute(sql)
        conn.commit()
        
        print("   ✅ Migración ejecutada exitosamente")
        
    except psycopg2.Error as e:
        print(f"   ❌ ERROR SQL: {e}")
        conn.rollback()
        return False
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        return False
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
    
    # Resumen
    print("\n" + "="*80)
    print("✅ MIGRACION COMPLETADA EXITOSAMENTE")
    print("="*80)
    
    if migration_num == '014':
        print("\n📊 Cambios aplicados:")
        print("   ✓ huellas_biometricas.imagen_png_2 / imagen_png_3 (y sus")
        print("     num_keypoints_2 / _3) — ahora se guardan hasta 3 muestras")
        print("     por socio en vez de 1 sola, para identificar con más")
        print("     seguridad (se exige coincidir con al menos 2 de las 3).")
        print("   ✓ Compatible con huellas ya guardadas antes: se quedan con")
        print("     1 sola muestra y siguen funcionando igual que antes.")

    if migration_num == '013':
        print("\n📊 Cambios aplicados:")
        print("   ✓ Tabla categorias_planes (las pestañas de planes, ahora")
        print("     editables: crear, renombrar, eliminar).")
        print("   ✓ planes.id_categoria / descripcion / activo — el catálogo")
        print("     completo (nombre, precio, duración, descripción) ahora")
        print("     se administra desde Configuración, no está fijo en el HTML.")
        print("   ✓ Se sembraron las 5 categorías y 13 planes que ya se veían")
        print("     en la app, para que nada cambie hasta que edites algo.")

    if migration_num == '012':
        print("\n📊 Cambios aplicados:")
        print("   ✓ socios.activo (BOOLEAN) — para el botón de eliminar")
        print("     socio: no borra nada de verdad, solo lo oculta de las")
        print("     listas. Su historial (asistencias, ventas, membresías,")
        print("     huella) se queda intacto en la base de datos.")

    if migration_num == '011':
        print("\n📊 Cambios aplicados:")
        print("   ✓ socios.foto_url (foto de perfil opcional, en base64)")
        print("     — para la tarjeta de detalle del socio (botón del ojo en")
        print("       Miembros / Estadísticas), donde también se edita nombre,")
        print("       correo, carnet y se puede volver a registrar la huella.")

    if migration_num == '010':
        print("\n📊 Cambios aplicados:")
        print("   ✓ gym_config.pantalla_bienvenida_logo_url (logo personalizado, en base64)")
        print("   ✓ gym_config.pantalla_bienvenida_tema (VARCHAR, preset de color)")

    if migration_num == '009':
        print("\n📊 Cambios aplicados:")
        print("   ✓ gym_config.pantalla_bienvenida_habilitada (BOOLEAN)")
        print("   ✓ gym_config.duracion_pantalla_bienvenida (INTEGER, segundos)")
        print("   Para la pantalla opcional de bienvenida de socios (/pantalla-socios).")

    if migration_num == '008':
        print("\n📊 Cambios aplicados:")
        print("   ✓ asistencias_log.fecha_salida — la auditoría original decía que ya")
        print("     existía, pero no era así en la base de datos real; se agrega acá.")
        print("   ✓ asistencias_log.id_locker — recuerda qué casillero se asignó en")
        print("     cada entrada, para poder liberarlo automáticamente en la salida.")
        print("   ✓ gym_config.asignacion_lockers_automatica (BOOLEAN) — controla si,")
        print("     al marcar entrada por huella, el casillero se asigna solo o si la")
        print("     recepcionista lo elige manualmente.")
        print("   (Es seguro volver a correr esta migración si ya la corriste antes:")
        print("    cada cambio se aplica solo si todavía no existe.)")

    if migration_num == '007':
        print("\n📊 Objetos creados:")
        print("   ✓ Tabla: huellas_biometricas (imagen real de huella por socio)")
        print("     — Necesaria para Registro (enrolar), Asistencia y Renovaciones")
        print("       (identificar) con el lector DigitalPersona U.are.U 4500 real.")

    if migration_num == '006':
        print("\n📊 Cambios aplicados:")
        print("   ✓ gym_config.precios_planes (JSONB) — guarda los precios configurados")
        print("     en Configuración > Configuración de Precios para que se apliquen")
        print("     de verdad al registrar/renovar miembros.")

    if migration_num == '005':
        print("\n📊 Objetos creados:")
        print("   ✓ Tabla: productos (inventario real de la tienda del gimnasio)")
        print("   ✓ Tabla: productos_movimientos (historial de entradas/salidas de stock)")
        print("   ✓ 8 productos de ejemplo (los mismos que antes eran solo simulados)")

    if migration_num == '004':
        print("\n📊 Objetos creados:")
        print("   ✓ Tabla: membresias (planes/membresías de cada socio)")
        print("     — Sin esta tabla, Vencimientos, Renovaciones y el plan")
        print("       inicial al registrar un socio daban error 500.")

    if migration_num == '003':
        print("\n📊 Cambios aplicados:")
        print("   ✓ portal_accounts.socio_id → id_socio (coincide con el backend)")
        print("   ✓ portal_accounts.username ahora es opcional (login usa email)")
        print("   ✓ gym_config: columnas renombradas a id_config/lockers_habilitados/")
        print("     cantidad_lockers/nombre_gimnasio (coincide con el backend)")
        print("   ✓ gym_config: agregadas columnas horario_apertura/horario_cierre")

    if migration_num == '002':
        print("\n📊 Objetos creados:")
        print("   ✓ Tabla: portal_accounts (autenticación de socios)")
        print("   ✓ Tabla: gym_config (configuración global)")
        print("   ✓ Tabla: cms_theme (temas visuales)")
        print("   ✓ Tabla: workout_routines (rutinas de entrenamiento)")
        print("\n📈 Datos semilla insertados:")
        print("   ✓ 1 configuración de gimnasio (gym_config)")
        print("   ✓ 1 tema CMS (ocean_sport, por defecto)")
        print("   ✓ 9 rutinas de entrenamiento:")
        print("      - 3 rutinas básicas")
        print("      - 3 rutinas intermedias")
        print("      - 3 rutinas avanzadas")
        print("      con 6-7 ejercicios cada una (JSONB)")
    
    print("\n🚀 Próximos pasos:")
    print("   1. Proceder a FASE 3 (Endpoints API)")
    print("   2. Crear router portal_auth.py (autenticación de socios)")
    print("   3. Implementar endpoints POST /api/portal/login")
    print("   4. Implementar endpoints GET /api/portal/me/plan")
    print("   5. Implementar endpoints GET /api/portal/me/routines")
    
    return True

if __name__ == '__main__':
    # Parsear argumentos
    migration_num = '002'  # Por defecto
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--migration' and len(sys.argv) > 2:
            migration_num = sys.argv[2]
        elif sys.argv[1].startswith('00'):
            migration_num = sys.argv[1]
    
    # Ejecutar
    success = execute_migration(migration_num)
    
    # Retornar código de salida
    sys.exit(0 if success else 1)
