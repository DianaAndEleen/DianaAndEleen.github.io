@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "TASKS=%~1"
if "%TASKS%"=="" set "TASKS=tasks\入门测试.csv"

echo ============================================
echo  批量生图
echo ============================================
echo  任务文件: %TASKS%
echo  输出目录: out\
echo.
echo 提示: 也可以把 csv 文件直接拖到这个 bat 上运行。
echo.
node sider.mjs batch "%TASKS%" --concurrency 2 --out out
echo.
echo 全部结束。图片在 out\ 里，每个任务一个子文件夹。
pause
