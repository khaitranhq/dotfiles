$CurrentDesktop = (.\VirtualDesktop11-24H2.exe /GetCurrentDesktop) -match 'desktop number (\d+)' | Out-Null
$CurrentDesktop = [int]$matches[1]

if ($CurrentDesktop -gt 0) {
    .\VirtualDesktop11-24H2.exe /GetDesktop:$CurrentDesktop /SwapDesktop:$($CurrentDesktop - 1) /Switch:$($CurrentDesktop - 1)
}
