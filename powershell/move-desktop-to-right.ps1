$CurrentDesktop = (.\VirtualDesktop11-24H2.exe /GetCurrentDesktop) -match 'desktop number (\d+)' | Out-Null
$CurrentDesktop = [int]$matches[1]

$TotalDesktops = (.\VirtualDesktop11-24H2.exe /Count) -match '(\d+)' | Out-Null
$TotalDesktops = [int]$matches[1]

if ($CurrentDesktop -lt ($TotalDesktops - 1)) {
    .\VirtualDesktop11-24H2.exe /GetDesktop:$CurrentDesktop /SwapDesktop:$($CurrentDesktop + 1) /Switch:$($CurrentDesktop + 1)
}
