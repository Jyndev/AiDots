import Astal from "gi://Astal?version=4.0";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import Notifd from "gi://AstalNotifd";
import Pango from "gi://Pango";
import { onCleanup, createState, For, createBinding } from "ags";
import app from "ags/gtk4/app";
import GLib from "gi://GLib";

export const [notificationTimeout] = createState(5000);

// --- Funciones de Utilidad ---

/**
 * Escapa caracteres especiales para que Pango/GTK no lance errores de marcado.
 */
const escapeMarkup = (str: string) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Limpia etiquetas HTML de otras apps, limita a 50 chars por línea y escapa el resultado.
 */
const processNotificationBody = (text: string, limit: number = 50) => {
  if (!text) return "";

  // 1. Eliminamos cualquier etiqueta HTML que venga de la App (ej: <b>, <span>)
  // Esto evita que el conteo de caracteres rompa etiquetas a la mitad.
  const plainText = text.replace(/<[^>]*>/g, "");

  // 2. Insertamos un salto de línea cada 'limit' caracteres
  const wrapped = plainText.replace(new RegExp(`(.{${limit}})`, "g"), "$1\n");

  // 3. Escapamos el texto final para que GTK lo trate como texto plano seguro
  return escapeMarkup(wrapped);
};

// --- Componente de Notificación Individual ---

function Notification({
  notification,
}: {
  notification: Notifd.Notification;
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

  return (
    <box 
      cssClasses={["notification-popup"]} 
      orientation={Gtk.Orientation.VERTICAL} 
      spacing={4} 
      widthRequest={320}
      onRealize={setup}
    >
      <box spacing={6} cssClasses={["notification-header"]}>
        <image 
            iconName={iconToShow} 
            pixelSize={14} 
            cssClasses={["app-icon"]}
        />
        <label 
            label={notification.appName || "Sistema"} 
            hexpand 
            halign={Gtk.Align.START} 
            cssClasses={["app-name"]}
            ellipsize={Pango.EllipsizeMode.END}
        />
        <button 
            cssClasses={["notification-close"]} 
            onClicked={() => notification.dismiss()}
        >
            <image iconName="window-close-symbolic" pixelSize={12} />
        </button>
      </box>

      <box spacing={10} cssClasses={["notification-content"]}>
        {notification.image && (
          <box
              valign={Gtk.Align.START}
              cssClasses={["notification-image"]}
              css={`
                  background-image: url("file://${notification.image}");
                  background-size: cover;
                  min-width: 50px;
                  min-height: 50px;
                  border-radius: 6px;
              `}
          />
        )}
        
        <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
          <label
            label={notification.summary || ""}
            hexpand
            halign={Gtk.Align.START}
            cssClasses={["notification-summary"]}
            ellipsize={Pango.EllipsizeMode.END}
          />
          {notification.body && (
            <label
              label={processNotificationBody(notification.body, 50)}
              wrap
              useMarkup
              halign={Gtk.Align.START}
              xalign={0}
              cssClasses={["notification-body"]}
              lines={4} 
              ellipsize={Pango.EllipsizeMode.END}
              wrapMode={Pango.WrapMode.WORD_CHAR}
            />
          )}
        </box>
      </box>
    </box>
  );
}

// --- Contenedor de Ventana Principal ---

export default function NotificationPopups() {
  const notifd = Notifd.get_default();
  const monitors = createBinding(app, "monitors");
  const [notifications, setNotifications] = createState<Notifd.Notification[]>([]);

  const id1 = notifd.connect("notified", (_, id) => {
    const n = notifd.get_notification(id);
    if (!n) return;
    
    // Reproducir sonido de notificación
    GLib.spawn_command_line_async(`bash -c "paplay $HOME/.config/ags/yuu/sounds/notify.wav"`);

    setNotifications((ns) => [n, ...ns.filter((i) => i.id !== id)]);
  });

  const id2 = notifd.connect("resolved", (_, id) => {
    setNotifications((ns) => ns.filter((n) => n.id !== id));
  });

  onCleanup(() => {
    notifd.disconnect(id1);
    notifd.disconnect(id2);
  });

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
            spacing={8} 
            cssClasses={["popups-container"]}
          >
            <For each={notifications}>
              {(n) => (
                <Notification
                  key={n.id}
                  notification={n}
                />
              )}
            </For>
          </box>
        </window>
      )}
    </For>
  );
}
