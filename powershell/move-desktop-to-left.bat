@echo off
setlocal enabledelayedexpansion
REM Download VirtualDesktop11-24H2 from https://github.com/MScholtes/VirtualDesktop

set "VirtualDesktop11_24H2=%LOCALAPPDATA%\VirtualDesktop\VirtualDesktop11-24H2.exe"

REM Get current desktop number
"%VirtualDesktop11_24H2%" /GetCurrentDesktop > "%TEMP%\desktop_output.txt"
for /f "tokens=7 delims= " %%a in ('findstr /C:"desktop number" "%TEMP%\desktop_output.txt"') do set "CurrentDesktop=%%a"
set "CurrentDesktop=%CurrentDesktop:)=%"

REM Move to left if not already at leftmost desktop
if %CurrentDesktop% GTR 0 (
    set /a "TargetDesktop=%CurrentDesktop%-1"
    "%VirtualDesktop11_24H2%" /GetDesktop:%CurrentDesktop% /SwapDesktop:!TargetDesktop! /Switch:!TargetDesktop!
)
