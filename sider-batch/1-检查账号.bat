@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  检查账号 / 代理是否正常
echo ============================================
echo.
node sider.mjs models
echo.
echo 上面能列出模型 = 一切正常，可以开始批量生图。
pause
