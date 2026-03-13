const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Invisible in Dock (macOS)
if (process.platform === 'darwin') {
  app.dock.hide();
}

app.name = 'AuraScribe';

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 800,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    alwaysOnTop: true,
    transparent: true,
    frame: true,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false, // Prevents background tabs from sleeping (needed for audio APIs without focus)
      devTools: !app.isPackaged, // Disable DevTools when compiled into the .exe completely saving ~80MB RAM
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setContentProtection(true); // Invisible on screen share (Zoom, Teams, OBS)
  win.setVisibleOnAllWorkspaces(true);
  // ============================================================
  // STEALTH CURSOR: Click-through OFF by default so buttons work.
  // User can toggle with Ctrl+Shift+X for full stealth mode.
  // ============================================================
  let isClickThrough = false;

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
  // System Audio Capture (WASAPI Loopback)
  // This handler intercepts getDisplayMedia() in the renderer and
  // auto-selects the primary screen with system audio loopback.
  // MUST be registered for getDisplayMedia to work in Electron.
  // ============================================================
  win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({
        video: sources[0],
        audio: 'loopback'
      });
    }).catch(err => {
      console.error('Error in displayMediaRequestHandler:', err);
      callback(null);
    });
  });

  // Fallback: IPC handler for getUserMedia approach
  ipcMain.handle('get-source-id', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources.length === 0) return null;
      return sources[0].id; // Primary monitor
    } catch (err) {
      console.error('Error getting desktop sources:', err);
      return null;
    }
  });

  // Auto-grant all permissions (Microphone, Screen Share, etc.)
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  // ============================================================
  // Open DevTools in development for debugging
  // ============================================================
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // ============================================================
  // START BACKEND DURING PACKAGED INJECTIONS
  // ============================================================
  if (app.isPackaged) {
    process.env.NODE_ENV = 'production'; // signal server to serve Vite Dist instead of HMR
    const serverModule = require(path.join(__dirname, '../server.cjs'));
    if (serverModule && serverModule.startServer) {
      serverModule.startServer().then((port) => {
        win.loadURL(`http://localhost:${port}`);
      }).catch(err => {
        console.error("Failed to start embedded Node server:", err);
      });
    } else {
      win.loadURL('http://localhost:3000');
    }
  } else {
    win.loadURL('http://localhost:3000');
  }

  // ============================================================
  // IPC: UI controls
  // ============================================================
  ipcMain.on('set-always-on-top', (event, flag) => {
    win.setAlwaysOnTop(flag, 'screen-saver');
  });

  ipcMain.on('set-skip-taskbar', (event, flag) => {
    win.setSkipTaskbar(flag);
    console.log('[Stealth] Taskbar hidden:', flag);
  });

  ipcMain.on('set-stealth-mode', (event, flag) => {
    win.setContentProtection(flag);
    console.log('[Stealth] Content protection:', flag);
  });

  ipcMain.on('close-app', () => {
    console.log('[App] Exit signal received. Terminating process...');
    app.exit(0);
    process.exit(0);
  });
  
  ipcMain.on('QUIT_NOW', () => {
    console.log('[App] Hard QUIT requested.');
    app.exit(0);
    process.exit(0);
  });

  // Emergency Global Quit Shortcut
  globalShortcut.register('CommandOrControl+Q', () => {
    console.log('[App] Global Quit hotkey triggered.');
    app.exit(0);
    process.exit(0);
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

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our existing window instead.
    if (win) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    // Check for updates natively if running inside the compiled .exe
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
