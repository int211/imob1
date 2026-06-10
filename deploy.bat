@echo off
echo ====================================
echo  Deploy completo: GitHub + Vercel
echo ====================================
echo.

echo [1/4] Build frontend...
call npx vite build
if %errorlevel% neq 0 (
    echo ERRO: Build falhou!
    pause
    exit /b 1
)

echo [2/4] Git add + commit...
git add -A
git commit -m "deploy %date% %time%"

echo [3/4] Git push...
git push
if %errorlevel% neq 0 (
    echo AVISO: git push falhou, continuando mesmo assim...
)

echo [4/4] Vercel deploy...
vercel --prod --yes

echo.
echo ====================================
echo  OK! Site: https://imobil.vercel.app
echo ====================================
pause
