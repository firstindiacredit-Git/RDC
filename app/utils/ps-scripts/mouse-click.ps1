
[void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
$button = $args[0]
$double = $args[1]

Add-Type -AssemblyName System.Windows.Forms
if ($button -eq "left") {
    if ($double -eq "true") {
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}{ENTER}')
    } else {
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    }
} elseif ($button -eq "right") {
    [System.Windows.Forms.SendKeys]::SendWait('+{F10}')
}
