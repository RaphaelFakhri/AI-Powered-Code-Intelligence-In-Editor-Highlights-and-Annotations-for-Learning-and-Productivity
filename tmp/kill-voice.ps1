Get-WmiObject Win32_Process | Where-Object {
    $_.Name -eq 'node.exe' -and $_.CommandLine -like '*transcribe*'
} | ForEach-Object {
    $nodePid = $_.ProcessId
    Write-Host "Killing node.exe PID $nodePid (CommandLine: $($_.CommandLine))"
    & cmd.exe /c "taskkill /T /F /PID $nodePid" 2>&1 | Out-Null
}
