const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create PowerShell scripts directory if it doesn't exist
const scriptsDir = path.join(__dirname, 'ps-scripts');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
}

// Create improved PowerShell scripts
const mouseMoveScript = path.join(scriptsDir, 'mouse-move.ps1');
fs.writeFileSync(mouseMoveScript, `
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int info);' -Name 'User32' -Namespace 'Win32'
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);' -Name 'User32SetCursor' -Namespace 'Win32'

# Set cursor position
[Win32.User32SetCursor]::SetCursorPos($args[0], $args[1])
`);

const mouseClickScript = path.join(scriptsDir, 'mouse-click.ps1');
fs.writeFileSync(mouseClickScript, `
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
`);

const mouseScrollScript = path.join(scriptsDir, 'mouse-scroll.ps1');
fs.writeFileSync(mouseScrollScript, `
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int info);' -Name 'User32' -Namespace 'Win32'

$amount = [int]$args[0]

# Define constants
$MOUSEEVENTF_WHEEL = 0x0800

[Win32.User32]::mouse_event($MOUSEEVENTF_WHEEL, 0, 0, $amount, 0)
`);

const keyPressScript = path.join(scriptsDir, 'key-press.ps1');
fs.writeFileSync(keyPressScript, `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait($args[0])
`);

// Windows mouse and keyboard automation functions
function moveMouse(x, y) {
  return new Promise((resolve, reject) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${mouseMoveScript}" ${x} ${y}`, (error) => {
      if (error) {
        console.error('PowerShell error:', error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function mouseClick(button = 'left', double = false) {
  return new Promise((resolve, reject) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${mouseClickScript}" ${button} ${double}`, (error) => {
      if (error) {
        console.error('PowerShell error:', error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function mouseScroll(deltaY) {
  return new Promise((resolve, reject) => {
    // Scale the deltaY to a reasonable value for mouse_event
    const scrollAmount = Math.min(Math.ceil(Math.abs(deltaY) / 5), 20) * Math.sign(deltaY);
    
    exec(`powershell -ExecutionPolicy Bypass -File "${mouseScrollScript}" ${scrollAmount}`, (error) => {
      if (error) {
        console.error('PowerShell error:', error);
        reject(error);
      } else {
        resolve();
      }
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
      if (error) {
        console.error('PowerShell error:', error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function sendKeyCombination(keys) {
  return new Promise((resolve, reject) => {
    const mappedKeys = keys.map(k => specialKeyMap[k] || k).join('');
    exec(`powershell -ExecutionPolicy Bypass -File "${keyPressScript}" "${mappedKeys}"`, (error) => {
      if (error) {
        console.error('PowerShell error:', error);
        reject(error);
      } else {
        resolve();
      }
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