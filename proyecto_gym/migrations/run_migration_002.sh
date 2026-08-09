#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# Ejecutar migración 002 de Spasso Gym en PostgreSQL (Linux/Mac)
# Versión: 1.0
# ══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo
echo "══════════════════════════════════════════════════════════════════════════════"
echo " SPASSO GYM - EJECUTAR MIGRACION 002"
echo "══════════════════════════════════════════════════════════════════════════════"
echo

cd "$PROJECT_DIR"

echo "📡 Verificando conexión a PostgreSQL..."

# Ejecutar el script de migración en Python
python3 migrations/execute_migration.py

if [ $? -eq 0 ]; then
    echo
    echo "✅ MIGRACION COMPLETADA EXITOSAMENTE"
    echo
    echo "Próximos pasos:"
    echo "  1. Proceder a FASE 3 (Endpoints API)"
    echo "  2. Crear routers para autenticación del portal"
    echo "  3. Implementar CRUD de portal_accounts"
    echo
else
    echo
    echo "❌ ERROR EN MIGRACION"
    echo
    exit 1
fi
