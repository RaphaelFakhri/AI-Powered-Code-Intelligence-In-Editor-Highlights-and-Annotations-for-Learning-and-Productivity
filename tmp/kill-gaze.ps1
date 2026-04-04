Get-WmiObject Win32_Process | Where-Object {
    $_.Name -eq 'dotnet.exe' -and $_.CommandLine -like '*GazeTobii*'
} | ForEach-Object {
    $procId = $_.ProcessId
    Write-Host "Killing GazeTobii PID $procId"
    & cmd.exe /c "taskkill /T /F /PID $procId" 2>&1 | Out-Null
}
