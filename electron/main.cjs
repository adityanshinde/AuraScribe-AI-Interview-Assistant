const { app, BrowserWindow, globalShortcut, desktopCapturer } = require('electron');
const path = require('path');

// 1. Invisible in Dock (macOS)
if (process.platform === 'darwin') {
  app.dock.hide();
}

// 2. Disguise in Task Manager
app.name = 'Windows Defender Helper';

function createWindow() {
  const win = new BrowserWindow({
    width: 480,               // Increased default width
    height: 750,              // Increased default height
    minWidth: 350,            // Minimum width so UI doesn't break
    minHeight: 500,           // Minimum height
    resizable: true,          // Allow user to resize the window!
    alwaysOnTop: true,        // Keeps it from minimizing
    skipTaskbar: true,        // Invisible in Taskbar and Alt+Tab
    transparent: true,        // Transparent background for rounded corners
    frame: false,             // No borders or close buttons
    hasShadow: true,          // Add shadow for depth
    type: 'toolbar',          // Helps hide from system window switchers
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Needed for some media capture APIs
    },
  });

  // Force it to stay on top of EVERYTHING
  win.setAlwaysOnTop(true, 'screen-saver');

  // 4. Invisible on Screen Share (Zoom, Teams, OBS)
  win.setContentProtection(true);

  // ==========================================================
  // FIX: Handle Screen/Audio Capture in Electron
  // Electron doesn't have a built-in screen picker UI like Chrome.
  // This intercepts the request and automatically selects the entire screen
  // and system audio (loopback) so it works instantly without a popup!
  // ==========================================================
  win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Automatically select the first screen and capture system audio
      callback({ video: sources[0], audio: 'loopback' });
    }).catch(err => {
      console.error('Error getting sources:', err);
      callback(); // Cancel if error
    });
  });

  // Auto-grant all permissions (Microphone, Screen Share, etc.)
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  // Load the local server
  win.loadURL('http://localhost:3000');

  // ==========================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // ==========================================================

  // Toggle Click-Through (Default is OFF so you can drag the window)
  let isClickThrough = false;
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    isClickThrough = !isClickThrough;
    win.setIgnoreMouseEvents(isClickThrough, { forward: true });
    console.log('Click-through is now:', isClickThrough ? 'ON' : 'OFF');
  });

  // Press Ctrl+Shift+H to Hide/Show the overlay completely
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.setAlwaysOnTop(true, 'screen-saver');
    }
  });
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
