@echo off
REM ════════════════════════════════════════════════════════════════════════════════
REM SAHLA-LIK Backend - Setup and Test Script
REM ════════════════════════════════════════════════════════════════════════════════

echo.
echo ════════════════════════════════════════════════════════════════
echo   SAHLA-LIK Backend - Setup Script
echo ════════════════════════════════════════════════════════════════
echo.

REM Check if MySQL is accessible
echo [1/4] Checking MySQL connection...
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ MySQL not found in PATH. Please install MySQL or add it to PATH.
    echo.
    echo To setup the database manually:
    echo   1. Open MySQL command line or Workbench
    echo   2. Run: mysql -u root -p ^< schema.sql
    echo.
    goto :skip_db
)

REM Import schema
echo ✅ MySQL found
echo [2/4] Importing database schema...
cd /d "%~dp0"
mysql -u root -p < schema.sql
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Database import failed. You can import manually:
    echo   mysql -u root -p ^< schema.sql
    echo.
    goto :skip_db
)
echo ✅ Database schema imported successfully!

:skip_db
echo.
echo [3/4] Checking npm dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
) else (
    echo ✅ Dependencies installed
)

echo.
echo [4/4] Starting server...
echo.
echo ════════════════════════════════════════════════════════════════
echo   Server starting on http://localhost:3001
echo   Press Ctrl+C to stop
echo ════════════════════════════════════════════════════════════════
echo.

call npm start
