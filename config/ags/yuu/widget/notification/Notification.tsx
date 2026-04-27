import Astal from "gi://Astal?version=4.0";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import Notifd from "gi://AstalNotifd";
import Pango from "gi://Pango";
import { onCleanup, createState, For, createBinding } from "ags";
import app from "ags/gtk4/app";
import GLib from "gi://GLib";
import { addToHistory } from "./NotificationHistory";

export const [notificationTimeout] = createState(5000);

// --- Funciones de Utilidad ---

/**
 * Escapa caracteres especiales para que Pango/GTK no lance errores de marcado.
 */
const escapeMarkup = (str: string) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Formats time from UNIX timestamp to readable format like '2 hours ago', or just HH:MM
 */
const formatTime = (time: number) => {
  if (!time) return "Now";
  const date = new Date(time * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Componente de Notificación Individual ---

function Notification({
  notification,
  depth
}: {
  notification: Notifd.Notification;
  depth: number;
}) {
  const iconToShow = notification.appIcon || "preferences-system-notifications-symbolic";

  // Lógica de auto-ocultado individual
  const setup = () => {
    const time = notification.expireTimeout > 0 ? notification.expireTimeout : notificationTimeout.get();
    if (time > 0) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, time, () => {
        notification.dismiss();
        return false;
      });
    }
  };

  // Custom Parsing for Headline
  const stripHtml = (text: string) => text.replace(/<[^>]*>/g, "");
  const cleanSummary = stripHtml(notification.summary || "");
  const cleanBody = stripHtml(notification.body || "");

  let actionHeadline = "";
  if (cleanBody.toLowerCase().includes(" in ")) {
      const parts = cleanBody.split(/ in /i);
      // Escape before injecting into bold tags to avoid pango mark-up errors
      actionHeadline = `<b>${escapeMarkup(cleanSummary)}</b> ${escapeMarkup(parts[0])} in <b>${escapeMarkup(parts.slice(1).join(" in "))}</b>`;
  } else {
      actionHeadline = `<b>${escapeMarkup(cleanSummary)}</b> ${escapeMarkup(cleanBody)}`;
  }

  return (
    <box 
      cssClasses={["pill-card", `stack-pos-${depth}`]} 
      orientation={Gtk.Orientation.HORIZONTAL} 
      spacing={15} 
      valign={Gtk.Align.START}
      onRealize={setup}
    >
      <box 
        cssClasses={["avatar"]} 
        widthRequest={45} 
        heightRequest={45}
        valign={Gtk.Align.CENTER}
        css={notification.image 
            ? `background-image: url("file://${notification.image}"); background-size: cover; background-position: center;` 
            : ``}
      >
        {!notification.image && <image iconName={iconToShow} pixelSize={24} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand />}
      </box>

      <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER} spacing={2}>
        <label
          label={actionHeadline}
          useMarkup
          maxWidthChars={28}
          halign={Gtk.Align.START}
          xalign={0}
          cssClasses={["action-text"]}
          wrap
          lines={3}
          ellipsize={Pango.EllipsizeMode.END}
          wrapMode={Pango.WrapMode.CHAR}
        />
        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8} valign={Gtk.Align.CENTER}>
            <label 
                label={formatTime(notification.time)} 
                cssClasses={["timestamp"]} 
                halign={Gtk.Align.START} 
            />
            <box cssClasses={["category-badge"]}>
                <label label={notification.appName || "System"} />
            </box>
        </box>
      </box>
      
      <button 
          cssClasses={["notification-close-invisible"]} // Invisible over top area or right side
          valign={Gtk.Align.START}
          onClicked={() => notification.dismiss()}
      >
          <image iconName="window-close-symbolic" pixelSize={12} opacity={0.3} />
      </button>
    </box>
  );
}

// --- State and Signal Handling (Global to avoid per-monitor duplication) ---

const notifd = Notifd.get_default();
const [notifications, setNotifications] = createState<Notifd.Notification[]>([]);

notifd.connect("notified", (_, id) => {
    const n = notifd.get_notification(id);
    if (!n) return;
    
    console.log(`[Notif] New: ${id} - Capturing for history`);
    addToHistory(n); // Guardamos inmediatamente para no perder datos
    
    // Reproducir sonido
    GLib.spawn_command_line_async(`bash -c "paplay $HOME/.config/ags/yuu/sounds/notify.wav"`);
    setNotifications((ns) => [n, ...ns.filter((i) => i.id !== id)]);
});

notifd.connect("resolved", (_, id) => {
    console.log(`[Notif] Resolved: ${id}`);
    setNotifications((ns) => ns.filter((n) => n.id !== id));
});

// --- Contenedor de Ventana Principal ---

export default function NotificationPopups() {
  const monitors = createBinding(app, "monitors");

  return (
    <For each={monitors}>
      {(monitor) => (
        <window
          name={`notifications-${monitor.connector}`}
          gdkmonitor={monitor}
          visible={notifications((ns) => ns.length > 0)}
          anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
          application={app}
          layer={Astal.Layer.OVERLAY}
        >
          <box 
            orientation={Gtk.Orientation.VERTICAL} 
            spacing={0}
            cssClasses={["popups-wrapper"]}
          >
              <For each={notifications((ns) => {
                 // Rendering up to 8 elements acts as an animation buffer. 
                 // Even during rapid-fire notifications, pushed elements have plenty of physical DOM time to fade out before being unmounted.
                 return ns.slice(0, 8).map((n, i) => ({ n, depth: i })).reverse();
              })}>
                {({n, depth}) => (
                  <Notification key={n.id} notification={n} depth={depth} />
                )}
              </For>
          </box>
        </window>
      )}
    </For>
  );
}
