import { createState } from "ags";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

export interface ClipboardEntry {
    id: number;
    text: string;
    imagePath: string | null;
    time: number;
}

const HISTORY_PATH = `${GLib.get_home_dir()}/.cache/ags-yuu/clipboard-history.json`;
const MAX_ENTRIES = 30;

function ensureDir() {
    const cacheDir = `${GLib.get_home_dir()}/.cache/ags-yuu`;
    const imgsDir = `${cacheDir}/clip-images`;
    [cacheDir, imgsDir].forEach(p => {
        const dir = Gio.File.new_for_path(p);
        if (!dir.query_exists(null)) dir.make_directory_with_parents(null);
    });
}

function loadHistory(): ClipboardEntry[] {
    try {
        ensureDir();
        const file = Gio.File.new_for_path(HISTORY_PATH);
        if (!file.query_exists(null)) return [];
        const [, contents] = file.load_contents(null);
        if (!contents || contents.length === 0) return [];
        return JSON.parse(new TextDecoder().decode(contents));
    } catch (e) {
        console.error("[ClipHistory] Load failed:", e);
        return [];
    }
}

function saveHistory(entries: ClipboardEntry[]) {
    try {
        ensureDir();
        const file = Gio.File.new_for_path(HISTORY_PATH);
        const json = JSON.stringify(entries, null, 2);
        file.replace_contents(new TextEncoder().encode(json), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    } catch (e) {
        console.error("[ClipHistory] Save failed:", e);
    }
}

export const [clipHistory, setClipHistory] = createState<ClipboardEntry[]>(loadHistory());

export function addToClipboard(text: string, imagePath: string | null = null) {
    const prev = clipHistory.get();
    
    // Evitar duplicados
    if (imagePath) {
        // Para imagenes, comparamos por path (o simplemente no evitamos duplicados si el path es unico)
    } else {
        if (!text || text.trim() === "") return;
        const filtered = prev.filter(e => e.text.trim() !== text.trim());
        const entry: ClipboardEntry = {
            id: Date.now(),
            text: text.trim(),
            imagePath: null,
            time: Math.floor(Date.now() / 1000)
        };
        const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
        setClipHistory(next);
        saveHistory(next);
        return;
    }

    const entry: ClipboardEntry = {
        id: Date.now(),
        text: text || "Imagen",
        imagePath: imagePath,
        time: Math.floor(Date.now() / 1000)
    };
    
    const next = [entry, ...prev].slice(0, MAX_ENTRIES);
    setClipHistory(next);
    saveHistory(next);
}

export function removeFromClipboard(id: number) {
    const next = clipHistory.get().filter(e => e.id !== id);
    setClipHistory(next);
    saveHistory(next);
}

export function clearClipboard() {
    setClipHistory([]);
    saveHistory([]);
}

export function copyToClipboard(entry: ClipboardEntry) {
    if (entry.imagePath) {
         GLib.spawn_command_line_async(`bash -c "wl-copy < '${entry.imagePath}'"`);
    } else {
        const proc = Gio.Subprocess.new(['wl-copy', entry.text], Gio.SubprocessFlags.NONE);
        proc.wait_async(null, null);
    }
}

// ── Watcher (Asíncrono y no bloqueante) ───────────────────────────────────
let lastContent = "";
let isChecking = false;

GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
    if (isChecking) return true;
    try {
        isChecking = true;
        const proc = new Gio.Subprocess({
            argv: ["wl-paste", "-n"],
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        });
        proc.init(null);
        proc.communicate_utf8_async(null, null, (_obj, res) => {
            try {
                const [, stdout] = proc.communicate_utf8_finish(res);
                isChecking = false;
                const current = (stdout || "").trim();
                if (current !== "" && current !== lastContent && current !== "IMAGE_MARKER") {
                    lastContent = current;
                    addToClipboard(current);
                }
            } catch {
                isChecking = false;
            }
        });
    } catch {
        isChecking = false;
    }
    return true;
});
