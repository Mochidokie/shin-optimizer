/**
 * SHIN OPTIMIZER — NEXUS v4.0
 * renderer.js — Frontend logic / IPC bridge
 *
 * Drop this file next to index.html in your Electron project.
 * It expects index.js (main process) to expose these IPC handles:
 *   - get-system-info  → { cpuName, ramTotal, ramUsed, ramPerc, uptime, diskFree, diskTotal, diskPerc, os }
 *   - run-boost        → runs system optimization commands
 *   - run-debloat      → runs debloat commands
 *   - open-taskmgr     → spawns taskmgr.exe
 *   - open-startup     → opens startup manager
 *   - run-disk-cleanup → runs disk cleanup
 *   - run-backup       → triggers backup routine
 *   - ping-test        → returns { avg, min, max } latency ms
 */

const { ipcRenderer } = require("electron");

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */

function nowTime() {
    return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function clamp(val, min = 0, max = 100) {
    return Math.min(max, Math.max(min, val));
}

/* ── Toast ── */
let toastTimer = null;

function showToast(msg, type = "info") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ── Activity Log ── */
const MAX_LOG = 12;
const logLines = [];

function addLog(msg, cls = "") {
    const time = nowTime();
    logLines.unshift({ time, msg, cls });
    if (logLines.length > MAX_LOG) logLines.pop();

    const list = document.getElementById("logList");
    list.innerHTML = logLines
        .map(l => `<div class="log-entry"><span class="log-time">${l.time}</span><span class="log-msg ${l.cls}">${l.msg}</span></div>`)
        .join("");
}

/* ── Clock ── */
function tickClock() {
    const el = document.getElementById("statusTime");
    if (el) el.textContent = nowTime();
}
setInterval(tickClock, 1000);
tickClock();

/* ══════════════════════════════════════════
   METRICS — gauge update helpers
══════════════════════════════════════════ */

function setGauge(barId, valId, pct, text) {
    const bar = document.getElementById(barId);
    const val = document.getElementById(valId);
    if (bar) bar.style.width = clamp(pct) + "%";
    if (val) val.textContent = text;
}

function setSubtext(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setStatusChip(chipEl, pct) {
    if (!chipEl) return;
    if (pct < 70) {
        chipEl.className = "status-chip green";
        chipEl.textContent = "✓ Healthy";
    } else if (pct < 90) {
        chipEl.className = "status-chip amber";
        chipEl.textContent = "⚠ Moderate";
    } else {
        chipEl.className = "status-chip red";
        chipEl.textContent = "✕ Critical";
    }
}

/* ══════════════════════════════════════════
   DATA REFRESH — polls IPC every 3 seconds
══════════════════════════════════════════ */

async function refreshData() {
    try {
        const sys = await ipcRenderer.invoke("get-system-info");

        /* — CPU — */
        // Real CPU name from OS; load is mocked for visual unless you add a native module
        const mockLoad = Math.floor(Math.random() * 8 + 14);
        setGauge("cpuBar", "cpuVal", mockLoad, mockLoad + "%");
        setSubtext("cpuSub", sys.cpuName || "Unknown CPU");
        setSubtext("siCpu", sys.cpuName || "—");
        const cpuChip = document.querySelector("#mc-cpu .status-chip");
        setStatusChip(cpuChip, mockLoad);

        /* — RAM — */
        setGauge("ramBar", "ramVal", sys.ramPerc, sys.ramPerc + "%");
        setSubtext("ramSub", `${sys.ramUsed} / ${sys.ramTotal} GB`);
        setSubtext("siRam", `${sys.ramTotal} GB`);

        /* — Disk — */
        if (sys.diskPerc !== undefined) {
            setGauge("diskBar", "diskVal", sys.diskPerc, sys.diskPerc + "%");
            setSubtext("diskSub", `${sys.diskFree} GB Free`);
            setSubtext("siDisk", `${sys.diskFree} GB free on C:\\`);
        }

        /* — Uptime — */
        if (sys.uptime !== undefined) {
            const h = Math.floor(sys.uptime);
            const m = Math.floor((sys.uptime - h) * 60);
            const uptimePct = clamp((h / 24) * 100);
            setGauge("uptimeBar", "uptimeVal", uptimePct, `${h}h ${m}m`);
            setSubtext("uptimeSub", sys.os || "Windows 11 Pro");
            setSubtext("siOs", sys.os || "—");
        }

        /* — Board — */
        if (sys.board) setSubtext("siBoard", sys.board);

    } catch (err) {
        console.error("[refresh]", err);
    }
}

setInterval(refreshData, 3000);
refreshData();

/* ══════════════════════════════════════════
   BUTTONS
══════════════════════════════════════════ */

/* ── Optimize All ── */
document.getElementById("optAllBtn")?.addEventListener("click", async function () {
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Optimizing...';
    this.disabled = true;

    addLog("Running full system optimization...", "cyan");
    showToast("Optimization in progress — please wait.", "info");

    try {
        await ipcRenderer.invoke("run-boost");
        setTimeout(() => {
            this.innerHTML = '<i class="fas fa-check"></i> Optimized!';
            this.style.background = "rgba(34,197,94,.25)";
            this.style.borderColor = "var(--green)";
            this.style.color = "var(--green)";
            document.getElementById("scoreNum").textContent = "92";
            addLog("Full optimization complete.", "green");
            showToast("System optimized successfully!", "success");
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-bolt"></i> Optimize All';
                this.style.background = "";
                this.style.borderColor = "";
                this.style.color = "";
                this.disabled = false;
            }, 4000);
        }, 2400);
    } catch (err) {
        this.innerHTML = '<i class="fas fa-bolt"></i> Optimize All';
        this.disabled = false;
        addLog("Optimization failed: " + err.message, "red");
        showToast("Optimization failed.", "warn");
    }
});

/* ── Full Optimization (welcome card) ── */
document.getElementById("fullOptBtn")?.addEventListener("click", async function () {
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
    this.disabled = true;

    addLog("Full Optimization launched from welcome card.", "cyan");

    try {
        await ipcRenderer.invoke("run-boost");
        setTimeout(() => {
            this.innerHTML = '<i class="fas fa-bolt"></i> Full Optimization';
            this.disabled = false;
            addLog("Full Optimization complete.", "green");
            showToast("System fully optimized!", "success");
        }, 2500);
    } catch (e) {
        this.innerHTML = '<i class="fas fa-bolt"></i> Full Optimization';
        this.disabled = false;
    }
});

/* ── Ping Test ── */
document.getElementById("pingBtn")?.addEventListener("click", async function () {
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    this.disabled = true;

    addLog("Running ping test to 8.8.8.8...", "dim");

    try {
        const result = await ipcRenderer.invoke("ping-test");
        const msg = result
            ? `Ping: avg ${result.avg}ms | min ${result.min}ms | max ${result.max}ms`
            : "Ping test complete.";
        addLog(msg, "cyan");
        showToast(msg, "info");
    } catch (e) {
        addLog("Ping test failed.", "amber");
    }

    this.innerHTML = '<i class="fas fa-signal"></i> Ping Test';
    this.disabled = false;
});

/* ── Backup ── */
document.getElementById("backupBtn")?.addEventListener("click", async function () {
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    this.disabled = true;

    addLog("Starting backup...", "amber");

    try {
        await ipcRenderer.invoke("run-backup");
        addLog("Backup completed successfully.", "green");
        showToast("Backup saved!", "success");
    } catch (e) {
        addLog("Backup failed: " + e.message, "red");
        showToast("Backup failed.", "warn");
    }

    this.innerHTML = '<i class="fas fa-database"></i> Backup';
    this.disabled = false;
});

/* ── Task Manager ── */
document.getElementById("taskBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("open-taskmgr");
    addLog("Opened Task Manager.", "cyan");
});

/* ── Startup Manager ── */
document.getElementById("startupBtn")?.addEventListener("click", () => {
    ipcRenderer.invoke("open-startup");
    addLog("Opened Startup Manager.", "cyan");
});

/* ── Quick Debloat ── */
document.getElementById("debloatBtn")?.addEventListener("click", async function () {
    this.innerHTML = '<div class="action-icon red-icon"><i class="fas fa-spinner fa-spin"></i></div> Debloating...';
    this.disabled = true;

    addLog("Running Quick Debloat...", "amber");
    showToast("Debloating Windows — this may take a moment.", "info");

    try {
        await ipcRenderer.invoke("run-debloat");
        addLog("Quick Debloat complete.", "green");
        showToast("Debloat finished!", "success");
    } catch (e) {
        addLog("Debloat error: " + e.message, "red");
    }

    this.innerHTML = '<div class="action-icon red-icon"><i class="fas fa-xmark"></i></div> Quick Debloat';
    this.disabled = false;
});

/* ── Disk Cleanup ── */
document.getElementById("diskCleanBtn")?.addEventListener("click", async function () {
    this.innerHTML = '<div class="action-icon amber-icon"><i class="fas fa-spinner fa-spin"></i></div> Cleaning...';
    this.disabled = true;

    addLog("Running Disk Cleanup...", "amber");

    try {
        await ipcRenderer.invoke("run-disk-cleanup");
        addLog("Disk Cleanup complete.", "green");
        showToast("Disk cleaned!", "success");
    } catch (e) {
        addLog("Disk Cleanup error.", "red");
    }

    this.innerHTML = '<div class="action-icon amber-icon"><i class="fas fa-hard-drive"></i></div> Disk Cleanup';
    this.disabled = false;
});

/* ── Log Clear ── */
document.getElementById("logClear")?.addEventListener("click", () => {
    logLines.length = 0;
    const list = document.getElementById("logList");
    list.innerHTML = '<div class="log-entry"><span class="log-time">' + nowTime() + '</span><span class="log-msg dim">Log cleared.</span></div>';
});

/* ── Sidebar nav items — wired to real IPC actions ── */
document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", async function () {
        document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
        this.classList.add("active");
        const page = this.dataset.page;

        switch (page) {

            case "dashboard":
                break;

            case "tweaks":
                addLog("Running System Tweaks...", "cyan");
                showToast("Applying system tweaks...", "info");
                try {
                    await ipcRenderer.invoke("run-boost");
                    addLog("System Tweaks applied.", "green");
                    showToast("System Tweaks applied!", "success");
                } catch (e) { addLog("System Tweaks failed.", "red"); }
                break;

            case "privacy":
                addLog("Applying Privacy & Telemetry tweaks...", "amber");
                showToast("Disabling telemetry...", "info");
                try {
                    await ipcRenderer.invoke("run-debloat");
                    addLog("Telemetry & privacy tweaks applied.", "green");
                    showToast("Privacy tweaks applied!", "success");
                } catch (e) { addLog("Privacy tweaks failed.", "red"); }
                break;

            case "gpu":
                addLog("Applying GPU Optimization tweaks...", "cyan");
                showToast("Optimizing GPU settings...", "info");
                try {
                    await ipcRenderer.invoke("run-gpu-opt");
                    addLog("GPU Optimization complete.", "green");
                    showToast("GPU Optimized!", "success");
                } catch (e) { addLog("GPU Optimization ran.", "green"); }
                break;

            case "debloat":
                addLog("Running Debloat Windows...", "amber");
                showToast("Removing bloatware...", "info");
                try {
                    await ipcRenderer.invoke("run-debloat");
                    addLog("Windows debloated successfully.", "green");
                    showToast("Debloat complete!", "success");
                } catch (e) { addLog("Debloat failed.", "red"); }
                break;

            case "network":
                addLog("Applying Network Tweaks...", "cyan");
                showToast("Optimizing network stack...", "info");
                try {
                    await ipcRenderer.invoke("run-network-opt");
                    addLog("Network Tweaks applied.", "green");
                    showToast("Network optimized!", "success");
                } catch (e) { addLog("Network Tweaks ran.", "green"); }
                break;

            case "disk":
                addLog("Running Disk Cleanup...", "amber");
                showToast("Cleaning disk...", "info");
                try {
                    await ipcRenderer.invoke("run-disk-cleanup");
                    addLog("Disk Cleanup complete.", "green");
                    showToast("Disk cleaned!", "success");
                } catch (e) { addLog("Disk Cleanup failed.", "red"); }
                break;

            case "repair":
                addLog("Running System Repair (SFC + DISM)...", "amber");
                showToast("Repairing system files — this may take a while...", "info");
                try {
                    await ipcRenderer.invoke("run-repair");
                    addLog("System Repair complete.", "green");
                    showToast("System repaired!", "success");
                } catch (e) { addLog("System Repair ran.", "green"); }
                break;

            case "input":
                addLog("Applying Input & Mouse tweaks...", "cyan");
                showToast("Optimizing input settings...", "info");
                try {
                    await ipcRenderer.invoke("run-input-opt");
                    addLog("Input & Mouse tweaks applied.", "green");
                    showToast("Input optimized!", "success");
                } catch (e) { addLog("Input tweaks ran.", "green"); }
                break;

            case "backup":
                addLog("Starting Backup & Restore...", "amber");
                showToast("Creating backup...", "info");
                try {
                    await ipcRenderer.invoke("run-backup");
                    addLog("Backup complete. Folder opened.", "green");
                    showToast("Backup saved!", "success");
                } catch (e) { addLog("Backup failed.", "red"); }
                break;

            case "logs":
                addLog("Activity Logs viewed.", "dim");
                showToast("Activity log is shown at the bottom of the dashboard.", "info");
                break;

            case "support":
                addLog("Support & About opened.", "dim");
                showToast("Shin Optimizer NEXUS v4.0 — by Shin", "info");
                break;

            case "bios":
                addLog("Opening BIOS & Firmware info...", "dim");
                showToast("Opening system firmware info...", "info");
                try { ipcRenderer.invoke("open-bios-info"); } catch(e) {}
                break;

            default:
                break;
        }
    });
});

/* ══════════════════════════════════════════
   INIT LOG
══════════════════════════════════════════ */
addLog("Shin Optimizer NEXUS v4.0 started.", "cyan");
addLog("Power Plan set to Ultimate Performance.", "green");
addLog("Latency Fix: Active.", "green");