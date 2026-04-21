/**
 * SHIN OPTIMIZER — NEXUS v4.0
 * index.js — Electron Main Process
 *
 * IPC Handles:
 *   get-system-info   → hardware/OS data
 *   run-boost         → power plan + latency + DNS + temp cleanup
 *   run-debloat       → removes common bloatware via PowerShell
 *   run-disk-cleanup  → disk cleanup + temp files
 *   run-backup        → exports registry keys + logs backup
 *   ping-test         → pings 8.8.8.8, returns avg/min/max ms
 *   open-taskmgr      → spawns taskmgr.exe
 *   open-startup      → opens msconfig startup tab
 */

const { app, BrowserWindow, ipcMain, shell, Menu } = require("electron");
const os   = require("os");
const path = require("path");
const { exec, execFile, spawn } = require("child_process");

/* ══════════════════════════════════════════
   WINDOW
══════════════════════════════════════════ */

let win;

function createWindow() {
    // Remove the default menu bar (File, Edit, View, Window)
    Menu.setApplicationMenu(null);

    win = new BrowserWindow({
        width:  1200,
        height: 820,
        minWidth:  960,
        minHeight: 640,
        title: "Shin Optimizer — NEXUS v4.0",
        backgroundColor: "#05070a",
        autoHideMenuBar: true,
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "#070b12",
            symbolColor: "#22d3ee",
            height: 36,
        },
        webPreferences: {
            nodeIntegration:  true,
            contextIsolation: false,
        },
    });

    win.loadFile("index.html");

    // Uncomment to open DevTools on start:
    // win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

/**
 * Run a shell command, resolve on finish (ignores non-zero exit).
 */
function runCmd(cmd) {
    return new Promise(resolve => {
        exec(cmd, { shell: "cmd.exe" }, (err, stdout, stderr) => {
            resolve({ err, stdout, stderr });
        });
    });
}

/**
 * Run a PowerShell command with elevated-friendly flags.
 */
function runPS(script) {
    return new Promise(resolve => {
        const ps = spawn("powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy", "Bypass",
            "-Command", script
        ]);
        let out = "";
        ps.stdout.on("data", d => (out += d));
        ps.on("close", code => resolve({ code, out }));
    });
}

/* ══════════════════════════════════════════
   IPC: get-system-info
══════════════════════════════════════════ */

ipcMain.handle("get-system-info", async () => {
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();

    const cpuModel = (os.cpus()[0]?.model || "Unknown CPU")
        .replace(/\(R\)|\(TM\)|CPU|Processor/gi, "")
        .trim();

    const ramTotal = Math.round(totalMem / (1024 ** 3));
    const ramUsed  = ((totalMem - freeMem) / (1024 ** 3)).toFixed(1);
    const ramPerc  = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const uptimeHours = os.uptime() / 3600;          // decimal hours

    /* Disk info via WMIC */
    let diskFree = "—", diskTotal = "—", diskPerc = 0;
    try {
        const { stdout } = await runCmd(
            `wmic logicaldisk where "DeviceID='C:'" get FreeSpace,Size /value`
        );
        const freeMatch  = stdout.match(/FreeSpace=(\d+)/);
        const sizeMatch  = stdout.match(/Size=(\d+)/);
        if (freeMatch && sizeMatch) {
            const free = parseInt(freeMatch[1]);
            const size = parseInt(sizeMatch[1]);
            diskFree  = (free / (1024 ** 3)).toFixed(1);
            diskTotal = (size / (1024 ** 3)).toFixed(0);
            diskPerc  = Math.round(((size - free) / size) * 100);
        }
    } catch (_) {}

    /* OS version via registry */
    let osName = "Windows";
    try {
        const { stdout } = await runCmd(
            `reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ProductName`
        );
        const m = stdout.match(/ProductName\s+REG_SZ\s+(.+)/);
        if (m) osName = m[1].trim();

        const { stdout: build } = await runCmd(
            `reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v DisplayVersion`
        );
        const bm = build.match(/DisplayVersion\s+REG_SZ\s+(.+)/);
        if (bm) osName += ` ${bm[1].trim()}`;
    } catch (_) {}

    /* Motherboard via WMIC */
    let board = "—";
    try {
        const { stdout } = await runCmd(
            `wmic baseboard get Manufacturer,Product /value`
        );
        const mfr = stdout.match(/Manufacturer=(.+)/);
        const prd = stdout.match(/Product=(.+)/);
        if (mfr && prd) board = `${mfr[1].trim()} ${prd[1].trim()}`;
    } catch (_) {}

    return {
        cpuName:   cpuModel,
        ramTotal,
        ramUsed,
        ramPerc,
        uptime:    parseFloat(uptimeHours.toFixed(2)),
        diskFree,
        diskTotal,
        diskPerc,
        os:        osName,
        board,
    };
});

/* ══════════════════════════════════════════
   IPC: run-boost  (Full Optimization)
══════════════════════════════════════════ */

ipcMain.handle("run-boost", async () => {
    const commands = [
        /* Power plan — Ultimate Performance */
        "powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>nul",
        "powercfg -setactive e9a42b02-d5df-448d-aa00-03f14749eb61",

        /* DPC Latency tweaks */
        "bcdedit /set disabledynamictick yes",
        "bcdedit /deletevalue useplatformclock",

        /* Disable HPET for better FPS */
        "bcdedit /set useplatformtick yes",

        /* Network stack flush */
        "ipconfig /flushdns",
        "netsh int tcp set global autotuninglevel=normal",
        "netsh int tcp set global ecncapability=enabled",
        "netsh int tcp set heuristics disabled",

        /* Temp cleanup */
        "del /q /f /s %temp%\\* 2>nul",
        "del /q /f /s C:\\Windows\\Temp\\* 2>nul",

        /* Prefetch clear */
        "del /q /f /s C:\\Windows\\Prefetch\\*.pf 2>nul",
    ];

    for (const cmd of commands) {
        await runCmd(cmd);
    }

    return true;
});

/* ══════════════════════════════════════════
   IPC: run-debloat
══════════════════════════════════════════ */

ipcMain.handle("run-debloat", async () => {
    const bloatApps = [
        "Microsoft.BingWeather",
        "Microsoft.GetHelp",
        "Microsoft.Getstarted",
        "Microsoft.MicrosoftOfficeHub",
        "Microsoft.MicrosoftSolitaireCollection",
        "Microsoft.People",
        "Microsoft.WindowsFeedbackHub",
        "Microsoft.WindowsMaps",
        "Microsoft.Xbox.TCUI",
        "Microsoft.XboxApp",
        "Microsoft.XboxGameOverlay",
        "Microsoft.XboxGamingOverlay",
        "Microsoft.XboxIdentityProvider",
        "Microsoft.XboxSpeechToTextOverlay",
        "Microsoft.YourPhone",
        "Microsoft.ZuneMusic",
        "Microsoft.ZuneVideo",
    ];

    const script = bloatApps
        .map(app => `Get-AppxPackage -Name '${app}' | Remove-AppxPackage -ErrorAction SilentlyContinue`)
        .join("; ");

    await runPS(script);

    /* Disable telemetry services */
    const telServices = ["DiagTrack", "dmwappushservice", "WerSvc"];
    for (const svc of telServices) {
        await runCmd(`sc stop "${svc}" 2>nul`);
        await runCmd(`sc config "${svc}" start= disabled 2>nul`);
    }

    return true;
});

/* ══════════════════════════════════════════
   IPC: run-disk-cleanup
══════════════════════════════════════════ */

ipcMain.handle("run-disk-cleanup", async () => {
    await runCmd("del /q /f /s %temp%\\* 2>nul");
    await runCmd("del /q /f /s C:\\Windows\\Temp\\* 2>nul");
    await runCmd("del /q /f /s C:\\Windows\\Prefetch\\*.pf 2>nul");

    /* Run built-in disk cleanup silently */
    await runCmd("cleanmgr /sagerun:1");

    return true;
});

/* ══════════════════════════════════════════
   IPC: run-backup
══════════════════════════════════════════ */

ipcMain.handle("run-backup", async () => {
    const backupDir = path.join(os.homedir(), "ShinOptimizer_Backup");
    await runCmd(`mkdir "${backupDir}" 2>nul`);

    /* Export common registry hives */
    const hives = [
        ["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "startup_run.reg"],
        ["HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters", "tcpip_params.reg"],
    ];

    for (const [hive, file] of hives) {
        await runCmd(`reg export "${hive}" "${path.join(backupDir, file)}" /y 2>nul`);
    }

    /* Write a simple backup log */
    const log = `Shin Optimizer Backup\nDate: ${new Date().toISOString()}\nPC: ${os.hostname()}\nOS: ${os.platform()} ${os.release()}\n`;
    require("fs").writeFileSync(path.join(backupDir, "backup_log.txt"), log);

    shell.openPath(backupDir);
    return true;
});

/* ══════════════════════════════════════════
   IPC: ping-test
══════════════════════════════════════════ */

ipcMain.handle("ping-test", async () => {
    const { stdout } = await runCmd("ping -n 10 8.8.8.8");

    const times = [];
    const re = /time[=<](\d+)ms/gi;
    let m;
    while ((m = re.exec(stdout)) !== null) {
        times.push(parseInt(m[1]));
    }

    if (times.length === 0) return null;

    return {
        avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        min: Math.min(...times),
        max: Math.max(...times),
    };
});

/* ══════════════════════════════════════════
   IPC: open-taskmgr
══════════════════════════════════════════ */

ipcMain.handle("open-taskmgr", () => {
    spawn("taskmgr.exe", [], { detached: true, stdio: "ignore" }).unref();
});

/* ══════════════════════════════════════════
   IPC: open-startup
══════════════════════════════════════════ */

ipcMain.handle("open-startup", () => {
    // Opens Windows Task Manager on the Startup tab (Win10/11)
    exec(`shell:startup`, { shell: "explorer.exe" });
    // Alternatively: spawn msconfig (older method)
    spawn("msconfig.exe", [], { detached: true, stdio: "ignore" }).unref();
});

/* ══════════════════════════════════════════
   IPC: run-gpu-opt
══════════════════════════════════════════ */

ipcMain.handle("run-gpu-opt", async () => {
    const cmds = [
        `reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f`,
        `reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f`,
        `reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 1 /f`,
        `reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f`,
        `reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f`,
    ];
    for (const cmd of cmds) await runCmd(cmd);
    return true;
});

/* ══════════════════════════════════════════
   IPC: run-network-opt
══════════════════════════════════════════ */

ipcMain.handle("run-network-opt", async () => {
    const cmds = [
        "ipconfig /flushdns",
        "netsh int tcp set global autotuninglevel=normal",
        "netsh int tcp set global ecncapability=enabled",
        "netsh int tcp set heuristics disabled",
        "netsh int tcp set global timestamps=disabled",
        "netsh int tcp set global rss=enabled",
        `reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" /v TCPNoDelay /t REG_DWORD /d 1 /f`,
    ];
    for (const cmd of cmds) await runCmd(cmd);
    return true;
});

/* ══════════════════════════════════════════
   IPC: run-repair  (SFC + DISM)
══════════════════════════════════════════ */

ipcMain.handle("run-repair", async () => {
    await runCmd("DISM /Online /Cleanup-Image /RestoreHealth");
    await runCmd("sfc /scannow");
    return true;
});

/* ══════════════════════════════════════════
   IPC: run-input-opt
══════════════════════════════════════════ */

ipcMain.handle("run-input-opt", async () => {
    const cmds = [
        `reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 0 /f`,
        `reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 0 /f`,
        `reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 0 /f`,
        `reg add "HKCU\\Control Panel\\Keyboard" /v KeyboardSpeed /t REG_SZ /d 31 /f`,
        `reg add "HKCU\\Control Panel\\Keyboard" /v KeyboardDelay /t REG_SZ /d 0 /f`,
    ];
    for (const cmd of cmds) await runCmd(cmd);
    return true;
});

/* ══════════════════════════════════════════
   IPC: open-bios-info
══════════════════════════════════════════ */

ipcMain.handle("open-bios-info", () => {
    spawn("msinfo32.exe", [], { detached: true, stdio: "ignore" }).unref();
});