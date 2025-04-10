
[void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
$amount = [int]$args[0]

Add-Type -AssemblyName System.Windows.Forms
if ($amount -gt 0) {
    for ($i=0; $i -lt [Math]::Abs($amount); $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
    }
} else {
    for ($i=0; $i -lt [Math]::Abs($amount); $i++) {
        [System.Windows.Forms.SendKeys]::SendWait("{UP}")
    }
}
