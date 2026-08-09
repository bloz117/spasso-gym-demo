@echo off
REM ══════════════════════════════════════════════════════════════════════════════
REM Ejecutar migración 002 de Spasso Gym en PostgreSQL (Windows)
REM Versión: 1.0
REM ══════════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ══════════════════════════════════════════════════════════════════════════════
echo  SPASSO GYM - EJECUTAR MIGRACION 002
echo ══════════════════════════════════════════════════════════════════════════════
echo.

REM Verificar que PostgreSQL esté disponible
echo 📡 Verificando conexión a PostgreSQL...

REM Ejecutar el script de migración en Python
python execute_migration.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ MIGRACION COMPLETADA EXITOSAMENTE
    echo.
    echo Próximos pasos:
    echo   1. Proceder a FASE 3 (Endpoints API)
    echo   2. Crear routers para autenticación del portal
    echo   3. Implementar CRUD de portal_accounts
    echo.
) else (
    echo.
    echo ❌ ERROR EN MIGRACION
    echo.
)

pause
