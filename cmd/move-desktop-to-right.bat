@echo off
setlocal enabledelayedexpansion
REM Download VirtualDesktop11-24H2 from https://github.com/MScholtes/VirtualDesktop

set "VirtualDesktop11_24H2=%LOCALAPPDATA%\VirtualDesktop\VirtualDesktop11-24H2.exe"

REM Get current desktop number
"%VirtualDesktop11_24H2%" /GetCurrentDesktop > "%TEMP%\desktop_output.txt"
for /f "tokens=7 delims= " %%a in ('findstr /C:"desktop number" "%TEMP%\desktop_output.txt"') do set "CurrentDesktop=%%a"
set "CurrentDesktop=%CurrentDesktop:)=%"

REM Get total number of desktops
"%VirtualDesktop11_24H2%" /Count > "%TEMP%\desktops_count.txt"
for /f "tokens=4 delims= " %%a in ('type "%TEMP%\desktops_count.txt"') do set "TotalDesktops=%%a"

REM Calculate max desktop index (total - 1)
set /a "MaxDesktop=%TotalDesktops%-1"

REM Move to right if not already at rightmost desktop
if %CurrentDesktop% LSS %MaxDesktop% (
    set /a "TargetDesktop=%CurrentDesktop%+1"
    "%VirtualDesktop11_24H2%" /GetDesktop:%CurrentDesktop% /SwapDesktop:!TargetDesktop! /Switch:!TargetDesktop!
)
