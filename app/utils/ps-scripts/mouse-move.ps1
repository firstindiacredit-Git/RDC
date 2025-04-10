
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int info);' -Name 'User32' -Namespace 'Win32'
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);' -Name 'User32SetCursor' -Namespace 'Win32'

# Set cursor position
[Win32.User32SetCursor]::SetCursorPos($args[0], $args[1])
