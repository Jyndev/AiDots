import Gtk from "gi://Gtk?version=4.0";
import { For } from "ags";
import {
    clipHistory,
    removeFromClipboard,
    clearClipboard,
    copyToClipboard,
    type ClipboardEntry
} from "./ClipboardHistory";

function ClipboardPill({ entry }: { entry: ClipboardEntry }) {
    // Truncar texto largo para el resumen de la píldora
    const displaySafe = entry.text.length > 80 ? entry.text.slice(0, 77) + "..." : entry.text;

    return (
        <box cssClasses={["history-pill", "clip-pill"]} orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
            {/* Si es imagen, mostramos preview. Si no, icono de archivo/pegado */}
            <box 
                cssClasses={["avatar", "clip-icon"]} 
                widthRequest={40} heightRequest={40} 
                valign={Gtk.Align.CENTER}
                halign={Gtk.Align.CENTER}
                css={entry.imagePath ? `background-image: url("file://${entry.imagePath}"); background-size: cover; background-position: center; border-radius: 8px;` : ""}
            >
                {!entry.imagePath && <image iconName="edit-paste-symbolic" pixelSize={18} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand />}
            </box>

            <button 
                hexpand 
                valign={Gtk.Align.CENTER} 
                cssClasses={["clip-text-btn"]}
                onClicked={() => {
                    console.log(`[Clip] Re-copying: ${entry.id}`);
                    copyToClipboard(entry);
                }}
            >
                <label 
                    label={entry.imagePath ? "Imagen copiada" : displaySafe} 
                    halign={Gtk.Align.START} 
                    xalign={0} 
                    cssClasses={["action-text"]} 
                    wrap
                    max_width_chars={30}
                    lines={2}
                />
            </button>

            <button 
                cssClasses={["history-delete-btn"]} 
                valign={Gtk.Align.CENTER}
                onClicked={() => removeFromClipboard(entry.id)}
            >
                <image iconName="window-close-symbolic" pixelSize={14} />
            </button>
        </box>
    );
}

export function ClipboardView() {
    return (
        <box orientation={Gtk.Orientation.VERTICAL} spacing={0}>
            <box orientation={Gtk.Orientation.HORIZONTAL} cssClasses={["history-topbar"]}>
                <label label="Portapapeles" cssClasses={["history-title"]} halign={Gtk.Align.START} hexpand />
                <button 
                    cssClasses={["history-clear-btn"]} 
                    onClicked={() => clearClipboard()}
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
                    <For each={clipHistory}>
                        {(entry) => <ClipboardPill entry={entry} />}
                    </For>
                    {/* Estado vacío - Usamos visibilidad para evitar errores de renderizado de Accessor */}
                    <box 
                        visible={clipHistory((entries) => entries.length === 0)}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                        vexpand
                    >
                        <label 
                            label="Tu portapapeles está vacío" 
                            cssClasses={["history-empty"]} 
                        />
                    </box>
                </box>
            </scrolledwindow>
        </box>
    );
}
