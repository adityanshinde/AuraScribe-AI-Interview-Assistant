const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

// Invisible in Dock (macOS)
if (process.platform === 'darwin') {
  app.dock.hide();
}

app.name = 'AuraScribe';

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 750,
    minWidth: 350,
    minHeight: 500,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,       // Invisible in Taskbar / Alt+Tab
    transparent: true,
    frame: false,
    hasShadow: true,
    type: 'toolbar',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setContentProtection(true); // Invisible on screen share (Zoom, Teams, OBS)

  // ============================================================
  // STEALTH CURSOR: Click-through ON by default.
  // The overlay is always transparent to mouse clicks — the cursor
  // never visibly moves to AuraScribe. Interaction is keyboard-only.
  // ============================================================
  let isClickThrough = true;
  win.setIgnoreMouseEvents(true, { forward: true });

  // ============================================================
  // IPC: Renderer tells us when chat input is focused / blurred.
  // We temporarily disable click-through so keyboard works.
  // ============================================================
  ipcMain.on('chat-input-focused', () => {
    // Allow keyboard input — disable click-through (but mouse still shows on app behind)
    win.setIgnoreMouseEvents(false);
    // Bring window to front so keystrokes reach it, but don't steal cursor
    win.showInactive(); // show without moving focus away from other app's mouse position
    win.focus();
  });

  ipcMain.on('chat-input-blurred', () => {
    // Re-enter click-through — cursor returns fully to app behind
    if (isClickThrough) {
      win.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  // ============================================================
  // Handle Screen/Audio Capture in Electron
  // Auto-selects the screen + system audio (loopback) without a popup.
  // ============================================================
  win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    }).catch(err => {
      console.error('Error getting sources:', err);
      callback();
    });
  });

  // Auto-grant all permissions (Microphone, Screen Share, etc.)
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  win.loadURL('http://localhost:3000');

  // ============================================================
  // IPC: UI controls
  // ============================================================
  ipcMain.on('set-always-on-top', (event, flag) => {
    win.setAlwaysOnTop(flag, 'screen-saver');
  });

  ipcMain.on('update-hotkeys', (event, hotkeys) => {
    // Unregister only the user-configurable ones, keep built-ins
    try { globalShortcut.unregister(hotkeys.toggleClickThrough); } catch (e) { }
    try { globalShortcut.unregister(hotkeys.toggleHide); } catch (e) { }

    globalShortcut.register(hotkeys.toggleClickThrough, () => {
      isClickThrough = !isClickThrough;
      win.setIgnoreMouseEvents(isClickThrough, { forward: true });
    });

    globalShortcut.register(hotkeys.toggleHide, () => {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.setAlwaysOnTop(true, 'screen-saver');
      }
    });
  });

  // ============================================================
  // GLOBAL KEYBOARD SHORTCUTS
  // ============================================================

  // Ctrl+Shift+Space ── Focus Chat Input (STEALTH)
  // Temporarily disables click-through so keyboard goes to AuraScribe.
  // After typing + Enter, the renderer sends 'chat-input-blurred' and
  // click-through re-enables automatically. Cursor never visibly moves.
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.setIgnoreMouseEvents(false); // Allow keyboard focus
    win.showInactive();
    win.focus();
    win.webContents.send('focus-chat-input'); // Tell renderer to open chat + focus textarea
  });

  // Ctrl+Shift+X ── Toggle Click-Through manually
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    isClickThrough = !isClickThrough;
    win.setIgnoreMouseEvents(isClickThrough, { forward: true });
    console.log('Click-through:', isClickThrough ? 'ON' : 'OFF');
  });

  // Ctrl+Shift+H ── Hide / Show overlay
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
