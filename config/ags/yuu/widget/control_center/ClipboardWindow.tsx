import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import { ClipboardView } from "./ClipboardView"
import { getWidgetThemeClass } from "../../services/themeSettings"

const windows: Record<string, Gtk.Window> = {}

export function toggleClipboardWindow(gdkmonitor?: Gdk.Monitor) {
  const mon = gdkmonitor || app.get_monitors()[0]
  const id = mon ? String(mon.description || mon.connector || "default") : "default"
  const win = windows[id]
  if (win) {
    win.visible = !win.visible
    if (win.visible) win.present()
  }
}

export default function ClipboardWindow(gdkmonitor: Gdk.Monitor) {
  const { BOTTOM, RIGHT } = Astal.WindowAnchor

  const win = (
    <window
      name={`clipboard-window-${gdkmonitor.connector}`}
      namespace="clipboard-window"
      gdkmonitor={gdkmonitor}
      anchor={BOTTOM | RIGHT}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      keymode={Astal.Keymode.ON_DEMAND}
      visible={false}
      margin_bottom={12}
      margin_right={445}
      application={app}
      $={(self) => {
        const id = String(gdkmonitor.description || gdkmonitor.connector || "default")
        windows[id] = self

        // Cerrar con la tecla ESC
        const keyCtrl = new Gtk.EventControllerKey()
        keyCtrl.connect("key-pressed", (_ctrl, keyval) => {
          if (keyval === Gdk.KEY_Escape) {
            self.visible = false
            return true
          }
          return false
        })
        self.add_controller(keyCtrl)
      }}
    >
      <box
        orientation={Gtk.Orientation.VERTICAL}
        class={getWidgetThemeClass("clipboard-window-drawer")}
        spacing={12}
        heightRequest={440}
      >
        {/* Cabecera del modal de Portapapeles (solo título, sin subtítulo) */}
        <box class="cc-header-row" halign={Gtk.Align.FILL} valign={Gtk.Align.CENTER}>
          <label
            label="📋 Portapapeles"
            class="cc-title"
            halign={Gtk.Align.START}
            hexpand
          />

          <button
            class="cc-close-btn"
            halign={Gtk.Align.END}
            valign={Gtk.Align.CENTER}
            tooltipText="Cerrar portapapeles"
            onClicked={() => {
              ;(win as any).visible = false
            }}
          >
            <label label="✕" />
          </button>
        </box>

        {/* Vista del portapapeles */}
        <box orientation={Gtk.Orientation.VERTICAL} vexpand>
          {ClipboardView()}
        </box>
      </box>
    </window>
  ) as any

  const id = String(gdkmonitor.description || gdkmonitor.connector || "default")
  windows[id] = win
  return win
}
