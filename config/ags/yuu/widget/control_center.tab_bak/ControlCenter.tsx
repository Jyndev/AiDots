import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { NotificationHistoryView } from "../notification/NotificationHistoryView"
import { ClipboardView } from "./ClipboardView"

const windows: Record<string, Gtk.Window> = {}
const airplaneIcons: Record<string, Gtk.Image> = {}
const airplaneButtons: Record<string, Gtk.Button> = {}
export default function ControlCenter(gdkmonitor: Gdk.Monitor) {
    const home = GLib.get_home_dir()
    
    // Header Data
    const realName = GLib.get_real_name()
    const loginName = GLib.get_user_name()
    const displayName = (realName && realName !== "Unknown" && realName !== "") 
        ? realName 
        : loginName

    const userImagePath = `${home}/.config/ags/yuu/assets/user.png`
    const imageExists = Gio.File.new_for_path(userImagePath).query_exists(null)

    const getUptimeStr = () => {
        try {
            const [res, out] = GLib.spawn_command_line_sync("uptime -p");
            let up = new TextDecoder().decode(out).trim().replace("up ", "");
            up = up.replace(/days?/g, "días")
                   .replace("day", "día")
                   .replace(/hours?/g, "horas")
                   .replace("hour", "hora")
                   .replace(/minutes?/g, "minutos")
                   .replace("minute", "minuto");
            up = up.replace(/,([^,]*)$/, " y$1");
            up = up.replace(/,/g, "");
            return `Encendido ${up}`;
        } catch (e) { return "Encendido 0 minutos" }
    }

    const uptimeLabel = new Gtk.Label({ 
        css_classes: ["uptime-title"], 
        label: getUptimeStr(),
        halign: Gtk.Align.CENTER 
    })

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60000, () => {
        uptimeLabel.label = getUptimeStr()
        return true
    })

    // Header Widget
    const header = (
        <box cssClasses={["control-header"]} orientation={Gtk.Orientation.VERTICAL} spacing={12} halign={Gtk.Align.FILL}>
            <box 
                cssClasses={["user-photo"]} 
                widthRequest={85} heightRequest={85}
                halign={Gtk.Align.CENTER}
                css={imageExists 
                    ? `background-image: url("file://${userImagePath}"); background-size: cover; background-position: center;` 
                    : ``}
            >
                {!imageExists && <image iconName="avatar-default-symbolic" pixelSize={40} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand />}
            </box>
            <box cssClasses={["user-info-pill"]} orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER}>
                <label label={displayName} cssClasses={["user-name"]} halign={Gtk.Align.CENTER} />
                {uptimeLabel}
            </box>
        </box>
    )

    // Stack and Navigation
    const stack = new Gtk.Stack({ 
        transition_type: Gtk.StackTransitionType.CROSSFADE,
        vhomogeneous: false,
        interpolate_size: true,
        css_classes: ["content-area-stack"]
    })
    
    // StackWrapper acts as the island container
    const stackWrapper = new Gtk.Box({
        css_classes: ["cc-block"],
        orientation: Gtk.Orientation.VERTICAL
    })
    stackWrapper.append(stack)
    
    // StackSwitcher is a native GTK widget to switch tabs
    const navTabs = new Gtk.StackSwitcher({ 
        stack: stack,
        halign: Gtk.Align.CENTER,
        css_classes: ["nav-tabs"]
    })

    // ACTUALIZACIÓN MANUAL DE ICONO DE AVIÓN
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

    // Actions Page (Split Row Layout)
    const actionsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10, css_classes: ["split-action-row"], homogeneous: true })

    const createSplitBtn = (id: string, icon: string, text: string, click: () => void) => {
        const btn = new Gtk.Button({ css_classes: ["split-action-btn"], hexpand: true })
        const content = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, halign: Gtk.Align.FILL, css_classes: ["split-box"] })
        const lbl = new Gtk.Label({ label: text, css_classes: ["split-lbl"], halign: Gtk.Align.START, hexpand: true })
        const img = new Gtk.Image({ icon_name: icon, pixel_size: 18, css_classes: ["split-img"], halign: Gtk.Align.END })
        
        content.append(lbl)
        content.append(img)
        btn.set_child(content)
        btn.connect("clicked", click)
        
        if (id === "airplane") {
            airplaneIcons[gdkmonitor.connector] = img
            airplaneButtons[gdkmonitor.connector] = btn
        }
        return btn
    }

    const runClick = (cmd: string, closePanel: boolean = false) => {
        if (closePanel) {
            const w = windows[gdkmonitor.connector];
            if (w) (w as any).visible = false;
        }
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, closePanel ? 200 : 0, () => {
            GLib.spawn_command_line_async(cmd);
            return false;
        });
    }

    actionsBox.append(createSplitBtn("airplane", "network-wireless-symbolic", "Avión", () => {
        runClick(`bash ${home}/.config/ags/yuu/scripts/airplane.sh`)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { updateAirplaneUI(); return false })
    }))

    actionsBox.append(createSplitBtn("shot", "camera-photo-symbolic", "Foto", () => runClick("hyprshot -m region", true)))
    actionsBox.append(createSplitBtn("wallpaper", "preferences-desktop-wallpaper-symbolic", "Fondo", () => runClick(`${home}/.config/FondosApp/FondosApp`, true)))

    const actionsPage = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
    actionsPage.append(actionsBox)
    
    stack.add_titled(actionsPage, "actions_page", "Acciones")

    // Notifications Page — Real persistent history
    const notifPage = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0, css_classes: ["list-page-box"] })
    notifPage.append(NotificationHistoryView())
    stack.add_titled(notifPage, "notifications_page", "Notificaciones")

    // Clipboard Page — Real history
    const clipPage = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0, css_classes: ["list-page-box"] })
    clipPage.append(ClipboardView())
    stack.add_titled(clipPage, "clipboard_page", "Portapapeles")

    // Footer
    const footer = new Gtk.Box({ css_classes: ["footer-row", "cc-block"], spacing: 10, homogeneous: true })
    const footerActions = [
        { label: "Logout", icon: "system-log-out-symbolic", cmd: `loginctl terminate-user ${loginName}` },
        { label: "Reboot", icon: "system-reboot-symbolic", cmd: "reboot" },
        { label: "PowerOff", icon: "system-shutdown-symbolic", cmd: "poweroff" }
    ]
    
    footerActions.forEach(action => {
        const btn = new Gtk.Button({ tooltip_text: action.label })
        const icon = new Gtk.Image({ icon_name: action.icon, pixel_size: 20 })
        btn.set_child(icon)
        btn.connect("clicked", () => {
            GLib.spawn_command_line_async(action.cmd)
        })
        footer.append(btn)
    })

    // Window Assembling
    const win = (
        <window
            name={`control-center-${gdkmonitor.connector}`}
            gdkmonitor={gdkmonitor}
            anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT}
            layer={Astal.Layer.OVERLAY}
            visible={false}
            margin_top={12}
            margin_left={12}
        >
            <box orientation={Gtk.Orientation.VERTICAL} cssClasses={["control-card"]} spacing={12} valign={Gtk.Align.START}>
                {header}
                {navTabs}
                {stackWrapper}
                {footer}
                
                <button 
                    onClicked={() => { (win as any).visible = false }} 
                    cssClasses={["close-panel-btn"]} 
                    halign={Gtk.Align.CENTER}
                >
                    <label label="Cerrar Panel" />
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
