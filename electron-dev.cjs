/**
 * electron-dev.cjs
 * Bulletproof cross-platform Electron launcher for Windows.
 * 1. Spawns `tsx server.ts` with output visible in terminal
 * 2. Polls TCP port 3000 every second (no HTTP needed — just TCP connect)
 * 3. Once port is open → launches Electron
 * 4. When Electron closes → kills server and exits
 */

const net    = require('net');
const { spawn } = require('child_process');

const ROOT = __dirname;

// ── 1. Start the backend server ───────────────────────────────────────────
console.log('\n🚀 [AuraScribe] Starting backend server...\n');

const serverProcess = spawn(
  'npx', ['tsx', 'server.ts'],
  {
    cwd: ROOT,
    stdio: 'inherit',  // Print server logs directly to this terminal
    shell: true,        // Required on Windows for npx to resolve
  }
);

serverProcess.on('error', (err) => {
  console.error('❌ [AuraScribe] Failed to start server:', err.message);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`\n[AuraScribe] Server exited (code ${code})`);
  }
});

// ── 2. Poll TCP port 3000 until server is ready ───────────────────────────
function isPortOpen(port, callback) {
  const socket = new net.Socket();
  socket.setTimeout(500);

  socket.on('connect', () => { socket.destroy(); callback(true);  });
  socket.on('error',   () => { socket.destroy(); callback(false); });
  socket.on('timeout', () => { socket.destroy(); callback(false); });

  socket.connect(port, '127.0.0.1');
}

function waitForServer(port, onReady) {
  process.stdout.write('⏳ [AuraScribe] Waiting for server');

  const timer = setInterval(() => {
    isPortOpen(port, (ready) => {
      if (ready) {
        clearInterval(timer);
        process.stdout.write(' ✅\n');
        onReady();
      } else {
        process.stdout.write('.');
      }
    });
  }, 1000);
}

// ── 3. Launch Electron once server is ready ───────────────────────────────
waitForServer(3000, () => {
  console.log('\n⚡ [AuraScribe] Launching Electron app...\n');

  // require('electron') returns the path to the actual Electron binary (.exe on Windows)
  // This is the officially recommended way — avoids all .cmd / shell issues
  const electronPath = require('electron');

  const electronProcess = spawn(electronPath, ['.'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  electronProcess.on('error', (err) => {
    console.error('❌ [AuraScribe] Failed to launch Electron:', err.message);
    serverProcess.kill();
    process.exit(1);
  });

  // When Electron window is closed → shut down server too
  electronProcess.on('close', (code) => {
    console.log('\n[AuraScribe] Electron closed. Shutting down server...');
    serverProcess.kill('SIGTERM');
    setTimeout(() => process.exit(code ?? 0), 500);
  });
});

// ── 4. Graceful shutdown on Ctrl+C ───────────────────────────────────────
process.on('SIGINT',  () => { serverProcess.kill(); process.exit(0); });
process.on('SIGTERM', () => { serverProcess.kill(); process.exit(0); });
