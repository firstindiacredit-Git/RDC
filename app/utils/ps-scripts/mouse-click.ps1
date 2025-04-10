
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int info);' -Name 'User32' -Namespace 'Win32'

$button = $args[0]
$double = $args[1]

# Define constants
$MOUSEEVENTF_LEFTDOWN = 0x0002
$MOUSEEVENTF_LEFTUP = 0x0004
$MOUSEEVENTF_RIGHTDOWN = 0x0008
$MOUSEEVENTF_RIGHTUP = 0x0010

if ($button -eq "left") {
    [Win32.User32]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 10
    [Win32.User32]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    
    if ($double -eq "true") {
        Start-Sleep -Milliseconds 10
        [Win32.User32]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 10
        [Win32.User32]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
    }
} elseif ($button -eq "right") {
    [Win32.User32]::mouse_event($MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 10
    [Win32.User32]::mouse_event($MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
}
