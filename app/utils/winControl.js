const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create PowerShell scripts directory if it doesn't exist
const scriptsDir = path.join(__dirname, 'ps-scripts');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
}

// Create PowerShell scripts for mouse and keyboard operations
const mouseMoveScript = path.join(scriptsDir, 'mouse-move.ps1');
fs.writeFileSync(mouseMoveScript, `
[void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($args[0], $args[1])
`);

const mouseClickScript = path.join(scriptsDir, 'mouse-click.ps1');
fs.writeFileSync(mouseClickScript, `
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
`);

const keyPressScript = path.join(scriptsDir, 'key-press.ps1');
fs.writeFileSync(keyPressScript, `
[void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait($args[0])
`);

const mouseScrollScript = path.join(scriptsDir, 'mouse-scroll.ps1');
fs.writeFileSync(mouseScrollScript, `
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
`);

// Windows mouse and keyboard automation
function moveMouse(x, y) {
  return new Promise((resolve, reject) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${mouseMoveScript}" ${x} ${y}`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function mouseClick(button = 'left', double = false) {
  return new Promise((resolve, reject) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${mouseClickScript}" ${button} ${double}`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function mouseScroll(deltaY) {
  return new Promise((resolve, reject) => {
    // Calculate scroll amount
    const scrollAmount = Math.min(Math.ceil(Math.abs(deltaY) / 100), 10) * Math.sign(deltaY);
    
    exec(`powershell -ExecutionPolicy Bypass -File "${mouseScrollScript}" ${scrollAmount}`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// Map special keys to SendKeys format
const specialKeyMap = {
  'Enter': '{ENTER}',
  'Backspace': '{BACKSPACE}',
  'Tab': '{TAB}',
  'Shift': '+',
  'Control': '^',
  'Alt': '%',
  'Delete': '{DELETE}',
  'Escape': '{ESC}',
  'ArrowUp': '{UP}',
  'ArrowDown': '{DOWN}',
  'ArrowLeft': '{LEFT}',
  'ArrowRight': '{RIGHT}',
  'Home': '{HOME}',
  'End': '{END}',
  'PageUp': '{PGUP}',
  'PageDown': '{PGDN}',
  'F1': '{F1}',
  'F2': '{F2}',
  'F3': '{F3}',
  'F4': '{F4}',
  'F5': '{F5}',
  'F6': '{F6}',
  'F7': '{F7}',
  'F8': '{F8}',
  'F9': '{F9}',
  'F10': '{F10}',
  'F11': '{F11}',
  'F12': '{F12}',
  ' ': ' '
};

function sendKey(key, isSpecial) {
  return new Promise((resolve, reject) => {
    let keyToSend;
    
    if (isSpecial && specialKeyMap[key]) {
      keyToSend = specialKeyMap[key];
    } else if (key.length === 1) {
      // Escape special characters for SendKeys
      if (['^', '%', '+', '~', '(', ')', '{', '}', '[', ']'].includes(key)) {
        keyToSend = `{${key}}`;
      } else {
        keyToSend = key;
      }
    } else {
      keyToSend = key;
    }
    
    exec(`powershell -ExecutionPolicy Bypass -File "${keyPressScript}" "${keyToSend}"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function sendKeyCombination(keys) {
  return new Promise((resolve, reject) => {
    const mappedKeys = keys.map(k => specialKeyMap[k] || k).join('');
    exec(`powershell -ExecutionPolicy Bypass -File "${keyPressScript}" "${mappedKeys}"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

module.exports = {
  moveMouse,
  mouseClick,
  mouseScroll,
  sendKey,
  sendKeyCombination
}; 