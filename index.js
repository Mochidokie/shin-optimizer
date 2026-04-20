const { app, BrowserWindow, ipcMain } = require('electron');
const os = require('os');
const { exec } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 750,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

//
// 📊 SYSTEM INFO
//
ipcMain.handle("system-info", () => {
  return {
    cpu: os.cpus()[0].model,
    cores: os.cpus().length,
    ramTotal: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
    ramFree: (os.freemem() / 1024 / 1024 / 1024).toFixed(2),
    platform: os.platform(),
    uptime: (os.uptime() / 60).toFixed(1)
  };
});

//
// ⚡ PERFORMANCE MODE
//
ipcMain.handle("power-mode", () => {
  exec("powercfg -setactive SCHEME_MIN");
  return "⚡ High Performance Mode Enabled";
});

//
// 🧹 CLEAN TEMP
//
ipcMain.handle("clean-temp", () => {
  exec("del /s /q %temp%\\*", () => {});
  return "🧹 Temp files cleaned";
});

//
// 🌐 DNS FLUSH
//
ipcMain.handle("flush-dns", () => {
  exec("ipconfig /flushdns");
  return "🌐 DNS flushed";
});

//
// ⚙️ TASKS
//
ipcMain.handle("tasks", () => {
  return new Promise((resolve) => {
    exec("tasklist", (err, out) => {
      resolve(out.split("\n").slice(0, 30).join("\n"));
    });
  });
});

//
// 💾 DISK INFO
//
ipcMain.handle("disk-info", () => {
  return new Promise((resolve) => {
    exec("wmic logicaldisk get size,freespace,caption", (err, out) => {
      resolve(out);
    });
  });
});

//
// 🧠 PERFORMANCE SUMMARY
//
ipcMain.handle("summary", () => {
  const load = os.loadavg()[0];
  return {
    cpuLoad: load.toFixed(2),
    memoryUsage: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(1)
  };
});

//
// 🚀 FULL BOOST MODE
//
ipcMain.handle("system-cleanup", () => {
  exec("powercfg -setactive SCHEME_MIN");
  exec("ipconfig /flushdns");
  exec("del /s /q %temp%\\*", () => {});
  return "🚀 Full Boost Applied";
});

//
// 🔥 DEEP CLEANUP
//
ipcMain.handle("deep-cleanup", () => {
  exec("ipconfig /flushdns");
  exec("del /s /q %temp%\\*", () => {});
  return "🔥 Deep Cleanup Completed (Restart recommended)";
});