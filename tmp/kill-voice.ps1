Get-WmiObject Win32_Process | Where-Object {
    $_.Name -eq 'node.exe' -and $_.CommandLine -like '*transcribe*'
} | ForEach-Object {
    $procId = $_.ProcessId
    Write-Host "Killing node.exe PID $procId"
    & cmd.exe /c "taskkill /T /F /PID $procId" 2>&1 | Out-Null
}
