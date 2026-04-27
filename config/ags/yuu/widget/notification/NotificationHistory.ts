import { createState } from "ags";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Notifd from "gi://AstalNotifd";

// ── Types ──────────────────────────────────────────────────────────────
export interface HistoryEntry {
    id: number;
    summary: string;
    body: string;
    appName: string;
    appIcon: string;
    image: string | null;
    time: number; // UNIX timestamp
}

// ── Persistence ────────────────────────────────────────────────────────
const HISTORY_PATH = `${GLib.get_home_dir()}/.cache/ags-yuu/notification-history.json`;
const MAX_HISTORY = 50;

function ensureDir() {
    const cacheDir = `${GLib.get_home_dir()}/.cache/ags-yuu`;
    const imgsDir = `${cacheDir}/notif-images`;
    [cacheDir, imgsDir].forEach(p => {
        const dir = Gio.File.new_for_path(p);
        if (!dir.query_exists(null)) dir.make_directory_with_parents(null);
    });
}

function loadHistory(): HistoryEntry[] {
    try {
        ensureDir();
        const file = Gio.File.new_for_path(HISTORY_PATH);
        if (!file.query_exists(null)) return [];
        const [, contents] = file.load_contents(null);
        if (!contents || contents.length === 0) return [];
        const text = new TextDecoder().decode(contents);
        const data = JSON.parse(text);
        if (Array.isArray(data)) return data;
        return [];
    } catch (e) {
        console.error("[NotifHistory] Error loading history:", e);
        return [];
    }
}

function saveHistory(entries: HistoryEntry[]) {
    try {
        ensureDir();
        const file = Gio.File.new_for_path(HISTORY_PATH);
        const json = JSON.stringify(entries, null, 2);
        const bytes = new TextEncoder().encode(json);
        file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    } catch (e) {
        console.error("[NotifHistory] Failed to save:", e);
    }
}

// ── State ──────────────────────────────────────────────────────────────
export const [notifHistory, setNotifHistory] = createState<HistoryEntry[]>(loadHistory());

// ── Public API ─────────────────────────────────────────────────────────

/** Called when a notification is resolved/dismissed — persists it to history. */
export function addToHistory(n: Notifd.Notification) {
    if (!n) return;
    
    let savedImagePath: string | null = null;
    if (n.image) {
        try {
            ensureDir();
            const timestamp = Date.now();
            const extension = n.image.split('.').pop() || 'png';
            savedImagePath = `${GLib.get_home_dir()}/.cache/ags-yuu/notif-images/notif_${timestamp}.${extension}`;
            
            const source = Gio.File.new_for_path(n.image);
            const destination = Gio.File.new_for_path(savedImagePath);
            source.copy(destination, Gio.FileCopyFlags.OVERWRITE, null, null);
        } catch (e) {
            console.error("[NotifHistory] Error saving image:", e);
            savedImagePath = n.image; // Fallback to original if copy fails
        }
    }

    const entry: HistoryEntry = {
        id: n.id + Date.now(), // Garantizar unicidad total incluso si el sistema recicla IDs
        summary: n.summary || "",
        body: n.body || "",
        appName: n.appName || "Sistema",
        appIcon: n.appIcon || "preferences-system-notifications-symbolic",
        image: savedImagePath,
        time: Math.floor(Date.now() / 1000),
    };

    console.log(`[NotifHistory] Saving: ${entry.summary} (UID: ${entry.id})`);
    
    const prev = notifHistory.get();
    const next = [entry, ...prev].slice(0, MAX_HISTORY);
    
    setNotifHistory(next);
    saveHistory(next);
}

/** Remove a single entry from history. */
export function removeFromHistory(id: number) {
    console.log(`[NotifHistory] Removing entry: ${id}`);
    const prev = notifHistory.get();
    const entry = prev.find(e => e.id === id);
    
    // Limpiar imagen del cache si existe
    if (entry?.image && entry.image.includes("notif-images")) {
        try {
            Gio.File.new_for_path(entry.image).delete(null);
        } catch (e) {}
    }

    const next = prev.filter(e => e.id !== id);
    setNotifHistory(next);
    saveHistory(next);
}

/** Clear ALL notification history. */
export function clearHistory() {
    const prev = notifHistory.get();
    
    // Limpiar todas las imagenes del cache
    prev.forEach(entry => {
        if (entry.image && entry.image.includes("notif-images")) {
            try {
                Gio.File.new_for_path(entry.image).delete(null);
            } catch (e) {}
        }
    });

    setNotifHistory([]);
    saveHistory([]);
}
