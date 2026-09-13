@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  单张生图（用来试提示词）
echo ============================================
echo.
set /p PROMPT=请输入提示词，然后回车: 
if "%PROMPT%"=="" goto empty
echo.
node sider.mjs gen "%PROMPT%" --out out
echo.
pause
exit /b

:empty
echo 没有输入提示词。
pause
