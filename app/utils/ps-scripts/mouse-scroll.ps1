
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int info);' -Name 'User32' -Namespace 'Win32'

$amount = [int]$args[0]

# Define constants
$MOUSEEVENTF_WHEEL = 0x0800

[Win32.User32]::mouse_event($MOUSEEVENTF_WHEEL, 0, 0, $amount, 0)
