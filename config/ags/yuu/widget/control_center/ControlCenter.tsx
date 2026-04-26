import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

const windows: Record<string, Gtk.Window> = {}
const airplaneIcons: Record<string, Gtk.Image> = {}
const airplaneButtons: Record<string, Gtk.Button> = {}

export default function ControlCenter(gdkmonitor: Gdk.Monitor) {
    const home = GLib.get_home_dir()
    
    // 1. LÓGICA DE USUARIO ROBUSTA (Evita el "Unknown")
    const realName = GLib.get_real_name()
    const loginName = GLib.get_user_name()
    const displayName = (realName && realName !== "Unknown" && realName !== "") 
        ? realName 
        : loginName

    const userImagePath = `${home}/.config/ags/yuu/assets/user.png`
    const imageExists = Gio.File.new_for_path(userImagePath).query_exists(null)

    // 2. UPTIME MANUAL (Evita errores de Promise/Poll)
    const getUptimeStr = () => {
        try {
            const [res, out] = GLib.spawn_command_line_sync(`bash -c "uptime -p | sed 's/up //; s/ hours\\?, /h:/; s/ minutes\\?/m/; s/ hour\\?, /h:/; s/ minute\\?/m/'"`)
            return new TextDecoder().decode(out).trim() || "0h:0m"
        } catch (e) { return "0h:0m" }
    }

    const uptimeLabel = new Gtk.Label({ 
        css_classes: ["uptime-value"], 
        label: getUptimeStr(),
        halign: Gtk.Align.END 
    })

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60000, () => {
        uptimeLabel.label = getUptimeStr()
        return true
    })

    // 3. ACTUALIZACIÓN MANUAL DE ICONO DE AVIÓN
    const updateAirplaneUI = () => {
        try {
            const [res, out] = GLib.spawn_command_line_sync("nmcli radio wifi")
            const status = new TextDecoder().decode(out).trim()
            const isOff = status === "disabled"
            
            const img = airplaneIcons[gdkmonitor.connector]
            const btn = airplaneButtons[gdkmonitor.connector]

            if (img) img.set_from_icon_name(isOff ? "airplane-mode-symbolic" : "network-wireless-symbolic")
            if (btn) {
                if (isOff) btn.add_css_class("active")
                else btn.remove_css_class("active")
            }
        } catch (e) { console.error(e) }
    }

    // 4. GRID DE BOTONES
    const grid = new Gtk.Grid({ column_spacing: 15, row_spacing: 15, halign: Gtk.Align.CENTER })

    const actions = [
        { id: "power", icon: "system-shutdown-symbolic", click: () => GLib.spawn_command_line_async("poweroff") },
        { id: "reboot", icon: "system-reboot-symbolic", click: () => GLib.spawn_command_line_async("reboot") },
        { id: "airplane", icon: "network-wireless-symbolic", click: () => {
            GLib.spawn_command_line_async(`bash ${home}/.config/ags/yuu/scripts/airplane.sh`)
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { updateAirplaneUI(); return false })
        }},
        { id: "shot", icon: "camera-photo-symbolic", click: () => {
            // 1. Buscamos la ventana del monitor actual
            const win = windows[gdkmonitor.connector];
            if (win) (win as any).visible = false; // 2. Ocultamos el panel inmediatamente

            // 3. Ejecutamos hyprshot con un pequeño delay para que el panel desaparezca visualmente
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                GLib.spawn_command_line_async("hyprshot -m region");
                return false;
            });
        }},
        { id: "wallpaper", icon: "preferences-desktop-wallpaper-symbolic", click: () => {
            const win = windows[gdkmonitor.connector];
            if (win) (win as any).visible = false;
            
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                GLib.spawn_command_line_async(`${home}/.config/FondosApp/FondosApp`);
                return false;
            });
        }},
    ]

    actions.forEach((btnData, i) => {
        const button = new Gtk.Button({ css_classes: ["square-btn"], width_request: 80, height_request: 80 })
        const img = new Gtk.Image({ icon_name: btnData.icon, pixel_size: 28 })
        
        if (btnData.id === "airplane") {
            airplaneIcons[gdkmonitor.connector] = img
            airplaneButtons[gdkmonitor.connector] = button
        }

        button.set_child(img)
        button.connect("clicked", btnData.click)
        grid.attach(button, i % 3, Math.floor(i / 3), 1, 1)
    })

    // 5. VENTANA PRINCIPAL
    const win = (
        <window
            name={`control-center-${gdkmonitor.connector}`}
            gdkmonitor={gdkmonitor}
            anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT}
            layer={Astal.Layer.OVERLAY}
            visible={false}
            margin_top={12}
            margin_right={12}
        >
            <box orientation={Gtk.Orientation.VERTICAL} cssClasses={["control-card"]} spacing={24}>
                {/* HEADER */}
                <box spacing={12} cssClasses={["control-header"]}>
                    <box 
                        cssClasses={["user-photo"]} 
                        widthRequest={54} heightRequest={54}
                        css={imageExists 
                            ? `background-image: url("file://${userImagePath}"); background-size: contain; background-repeat: no-repeat; background-position: center;` 
                            : `background-color: #2D2340;`}
                    >
                        {!imageExists && <image iconName="avatar-default-symbolic" pixelSize={26} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand />}
                    </box>
                    
                    <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
                        <label label="SESIÓN DE" cssClasses={["user-welcome"]} halign={Gtk.Align.START} />
                        <label label={displayName} cssClasses={["user-name"]} halign={Gtk.Align.START} />
                    </box>

                    <box orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
                        <label label="ACTIVO" cssClasses={["uptime-title"]} halign={Gtk.Align.END} />
                        {uptimeLabel}
                    </box>
                </box>

                {grid}

                <button 
                    onClicked={() => { (win as any).visible = false }} 
                    cssClasses={["close-panel-btn"]} 
                    halign={Gtk.Align.CENTER}
                >
                    <label label="Ocultar Panel" />
                </button>
            </box>
        </window>
    ) as any

    windows[gdkmonitor.connector] = win
    
    // Actualización inicial del estado de avión al cargar
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => { updateAirplaneUI(); return false })
    
    return win
}

export function ControlCenterToggle({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
    return (
        <button 
            onClicked={() => {
                const win = windows[gdkmonitor.connector]
                if (win) {
                    win.visible = !win.visible
                    if (win.visible) win.present()
                }
            }}
            cssClasses={["bar-control-btn"]}
        >
            <image iconName="custom-menu-symbolic" />
        </button>
    )
}
