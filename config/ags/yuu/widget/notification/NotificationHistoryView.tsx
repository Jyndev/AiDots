import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";
import { For, createBinding } from "ags";
import {
    notifHistory,
    removeFromHistory,
    clearHistory,
    type HistoryEntry,
} from "./NotificationHistory";

const escapeMarkup = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const stripHtml = (text: string) => text.replace(/<[^>]*>/g, "");

const formatTime = (time: number) => {
    if (!time) return "Ahora";
    const now = Math.floor(Date.now() / 1000);
    const diff = now - time;
    if (diff < 60) return "Ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    const date = new Date(time * 1000);
    return date.toLocaleDateString([], { day: "2-digit", month: "short" });
};

function HistoryPill({ entry }: { entry: HistoryEntry }) {
    const cleanSummary = stripHtml(entry.summary);
    const cleanBody = stripHtml(entry.body);

    let headline = `<b>${escapeMarkup(cleanSummary)}</b>`;
    if (cleanBody) {
        headline += ` ${escapeMarkup(cleanBody.slice(0, 40))}${cleanBody.length > 40 ? "..." : ""}`;
    }

    return (
        <box cssClasses={["history-pill"]} orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
            <box 
                cssClasses={["avatar"]} 
                widthRequest={40} heightRequest={40} 
                valign={Gtk.Align.CENTER}
                css={entry.image ? `background-image: url("file://${entry.image}"); background-size: cover; background-position: center;` : ""}
            >
                {!entry.image && <image iconName={entry.appIcon || "preferences-system-notifications-symbolic"} pixelSize={20} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand />}
            </box>

            <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER} spacing={2}>
                <label 
                    label={headline} 
                    useMarkup 
                    halign={Gtk.Align.START} 
                    xalign={0} 
                    cssClasses={["action-text"]} 
                    ellipsize={Pango.EllipsizeMode.END}
                />
                <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                    <label label={formatTime(entry.time)} cssClasses={["timestamp"]} />
                    <box cssClasses={["category-badge"]}>
                        <label label={entry.appName || "Sistema"} />
                    </box>
                </box>
            </box>

            <button 
                cssClasses={["history-delete-btn"]} 
                valign={Gtk.Align.CENTER}
                onClicked={() => removeFromHistory(entry.id)}
            >
                <image iconName="window-close-symbolic" pixelSize={14} />
            </button>
        </box>
    );
}

export function NotificationHistoryView() {
    return (
        <box orientation={Gtk.Orientation.VERTICAL} spacing={0}>
            <box orientation={Gtk.Orientation.HORIZONTAL} cssClasses={["history-topbar"]}>
                <label label="Notificaciones" cssClasses={["history-title"]} halign={Gtk.Align.START} hexpand />
                <button 
                    cssClasses={["history-clear-btn"]} 
                    onClicked={() => clearHistory()}
                >
                    <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                        <image iconName="user-trash-symbolic" pixelSize={14} />
                        <label label="Limpiar" />
                    </box>
                </button>
            </box>

            <scrolledwindow 
                hscrollbarPolicy={Gtk.PolicyType.NEVER} 
                vexpand 
                minContentHeight={150}
            >
                <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    {/* Lista principal */}
                    <For each={notifHistory}>
                        {(entry) => <HistoryPill entry={entry} />}
                    </For>
                    
                    {/* Estado vacío - Usamos visibilidad para evitar errores de renderizado de Accessor */}
                    <box 
                        visible={notifHistory((entries) => entries.length === 0)}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                        vexpand
                    >
                        <label 
                            label="Sin notificaciones recientes" 
                            cssClasses={["history-empty"]} 
                        />
                    </box>
                </box>
            </scrolledwindow>
        </box>
    );
}
