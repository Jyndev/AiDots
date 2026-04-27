import Gtk from "gi://Gtk?version=4.0";
import GLib from "gi://GLib";
import Pango from "gi://Pango";
import { createState, onCleanup } from "ags"; // Usamos lo que ya funciona en tu config

/** 
 * Lógica segura para obtener el estado de red vía CLI 
 */
const getStatus = () => {
  try {
    const [ok, stdout] = GLib.spawn_command_line_sync(
      `bash -c "nmcli -t -f TYPE,NAME connection show --active || true"`,
    );

    if (!ok || !stdout) return "";

    const r = new TextDecoder().decode(stdout);
    const lines = r.trim().split("\n");
    let wifiName = "";
    let hasVpn = false;

    for (const line of lines) {
      const parts = line.split(":");
      if (parts.length < 2) continue;

      const type = parts[0];
      const name = parts[1];

      if (type === "802-11-wireless") wifiName = name;
      if (
        type.includes("vpn") ||
        type.includes("wireguard") ||
        type.includes("tun")
      ) {
        hasVpn = true;
      }
    }

    if (hasVpn) return "Modo Ninja";
    return wifiName || "";
  } catch (err) {
    return "";
  }
};

export function Network() {
  // Usamos createState en lugar de Variable para mantener compatibilidad con tu sistema
  const [network, setNetwork] = createState(getStatus());

  // Configuramos el intervalo de actualización manual
  const intervalId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
    setNetwork(getStatus());
    return true; // Mantener el timeout activo
  });

  onCleanup(() => {
    GLib.source_remove(intervalId);
  });

  return (
    <box
      class="system-box network-inverted"
      visible={network((v) => v !== "")}
      valign={Gtk.Align.CENTER}
    >
      <image
        class="system-icon"
        iconName={network((v) =>
          v === "Modo Ninja"
            ? "custom-vpn-symbolic"
            : "network-wireless-symbolic",
        )}
      />
      <label
        label={network}
        class="system-label"
        maxWidthChars={25}
        ellipsize={Pango.EllipsizeMode.END}
      />
    </box>
  );
}
