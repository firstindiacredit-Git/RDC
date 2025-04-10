
[void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($args[0], $args[1])
