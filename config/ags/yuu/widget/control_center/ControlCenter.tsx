import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import app from "ags/gtk4/app"
import { createState, For } from "ags"
import AstalNetwork from "gi://AstalNetwork?version=0.1"
import AstalWp from "gi://AstalWp?version=0.1"
import AstalNotifd from "gi://AstalNotifd?version=0.1"
import Pango from "gi://Pango"

import { toggleClipboardWindow } from "./ClipboardWindow"
import { reloadHyprland } from "../../services/hyprlandSettings"
import {
  notifHistory,
  removeFromHistory,
  clearHistory,
  type HistoryEntry,
} from "../notification/NotificationHistory"
import { getWidgetThemeClass } from "../../services/themeSettings"

const windows: Record<string, Gtk.Window> = {}

export function toggleControlCenter(gdkmonitor?: Gdk.Monitor) {
  const mon = gdkmonitor || app.get_monitors()[0]
  const id = mon ? String(mon.description || mon.connector || "default") : "default"
  const win = windows[id]
  if (win) {
    win.visible = !win.visible
    if (win.visible) win.present()
  }
}

// Helper para escapar markup de Pango
const stripHtml = (text: string) => text.replace(/<[^>]*>/g, "")

const formatTime = (time: number) => {
  if (!time) return "Ahora"
  const now = Math.floor(Date.now() / 1000)
  const diff = now - time
  if (diff < 60) return "Ahora"
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  const date = new Date(time * 1000)
  return date.toLocaleDateString([], { day: "2-digit", month: "short" })
}

export default function ControlCenter(gdkmonitor: Gdk.Monitor) {
  const home = GLib.get_home_dir()
  const { TOP, BOTTOM, RIGHT } = Astal.WindowAnchor

  // ── 1. TIEMPO ENCENDIDO (UPTIME) ──
  const getUptimeStr = () => {
    try {
      const [, out] = GLib.spawn_command_line_sync("uptime -p")
      let up = new TextDecoder().decode(out).trim().replace("up ", "")
      up = up.replace(/days?/g, "d")
             .replace(/hours?/g, "h")
             .replace(/minutes?/g, "m")
             .replace(/,/g, "")
             .trim()
      return `Up ${up}`
    } catch {
      return "Up 0m"
    }
  }

  const [uptime, setUptime] = createState<string>(getUptimeStr())
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, () => {
    setUptime(getUptimeStr())
    return true
  })

  // ── 2. WI-FI: SSID Y POTENCIA DE SEÑAL ──
  let net: any = null
  try {
    net = AstalNetwork.get_default()
  } catch (e) {
    print(`[ControlCenter] AstalNetwork error: ${e}`)
  }

  const [wifiSsid, setWifiSsid] = createState<string>("Desconectado")
  const [wifiEnabled, setWifiEnabled] = createState<boolean>(true)
  const [wifiStrength, setWifiStrength] = createState<number>(0)
  const [wifiStatusText, setWifiStatusText] = createState<string>("Conectado")

  const updateWifiStatus = (en: boolean, st: number) => {
    if (!en) {
      setWifiStatusText("Desactivado")
    } else if (st > 0) {
      setWifiStatusText(`${st}% de señal`)
    } else {
      setWifiStatusText("Conectado")
    }
  }

  const syncWifiInfo = () => {
    try {
      if (net && net.wifi) {
        const en = Boolean(net.wifi.enabled)
        const st = net.wifi.strength || 0
        setWifiEnabled(en)
        setWifiStrength(st)
        updateWifiStatus(en, st)
        const activeSsid = net.wifi.ssid || ""
        if (activeSsid) {
          setWifiSsid(activeSsid)
          return
        }
      }
      // Fallback con nmcli
      const [, out] = GLib.spawn_command_line_sync("nmcli -t -f NAME,TYPE connection show --active")
      const lines = new TextDecoder().decode(out).trim().split("\n")
      const wifiLine = lines.find((l) => l.includes(":802-11-wireless"))
      if (wifiLine) {
        setWifiSsid(wifiLine.split(":")[0])
        setWifiEnabled(true)
        if (wifiStrength.get() === 0) setWifiStrength(80)
        updateWifiStatus(true, wifiStrength.get() || 80)
      } else {
        const [, rOut] = GLib.spawn_command_line_sync("nmcli radio wifi")
        const rState = new TextDecoder().decode(rOut).trim()
        const en = rState === "enabled"
        setWifiEnabled(en)
        setWifiSsid(en ? "Sin conexión" : "Wi-Fi Desactivado")
        setWifiStrength(0)
        updateWifiStatus(en, 0)
      }
    } catch {
      setWifiSsid("Wi-Fi")
    }
  }

  syncWifiInfo()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 4000, () => {
    syncWifiInfo()
    return true
  })

  if (net && net.wifi) {
    try {
      net.wifi.connect("notify::ssid", syncWifiInfo)
      net.wifi.connect("notify::enabled", syncWifiInfo)
      net.wifi.connect("notify::strength", () => {
        const st = net.wifi.strength || 0
        setWifiStrength(st)
        updateWifiStatus(wifiEnabled.get(), st)
      })
    } catch (_) {}
  }

  const toggleWifi = () => {
    try {
      if (net && net.wifi) {
        net.wifi.enabled = !net.wifi.enabled
      } else {
        GLib.spawn_command_line_async("nmcli radio wifi " + (wifiEnabled.get() ? "off" : "on"))
      }
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
        syncWifiInfo()
        return false
      })
    } catch (e) {
      print(`[toggleWifi] error: ${e}`)
    }
  }

  // ── 3. SLIDER DE VOLUMEN ÚNICO (ANCHO COMPLETO) ──
  const wp = AstalWp.get_default()
  const [volumePct, setVolumePct] = createState<number>(65)

  const syncVol = () => {
    if (wp?.defaultSpeaker) {
      setVolumePct(Math.round(wp.defaultSpeaker.volume * 100))
    }
  }
  syncVol()
  if (wp) {
    try {
      wp.connect("notify::default-speaker", syncVol)
      wp.defaultSpeaker?.connect("notify::volume", syncVol)
    } catch (_) {}
  }

  const changeVol = (delta: number) => {
    const next = Math.max(0, Math.min(100, volumePct.get() + delta))
    setVolumePct(next)
    if (wp?.defaultSpeaker) {
      wp.defaultSpeaker.volume = next / 100
    } else {
      GLib.spawn_command_line_async(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${(next / 100).toFixed(2)}`)
    }
  }

  // ── 4. CALENDARIO EN ESPAÑOL Y NAVEGACIÓN DINÁMICA ──
  const today = new Date()
  const [calYear, setCalYear] = createState<number>(today.getFullYear())
  const [calMonth, setCalMonth] = createState<number>(today.getMonth()) // 0 - 11

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ]

  const [monthTitle, setMonthTitle] = createState<string>(
    `${monthNames[today.getMonth()]} ${today.getFullYear()}`
  )

  const getMonthMatrix = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1)
    let startDayOfWeek = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const cells: Array<{
      day: number
      isCurrent: boolean
      isToday: boolean
    }> = []

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        isCurrent: false,
        isToday: false,
      })
    }

    const isThisCurrentMonth =
      today.getFullYear() === year && today.getMonth() === month

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        isCurrent: true,
        isToday: isThisCurrentMonth && today.getDate() === d,
      })
    }

    const remaining = (7 - (cells.length % 7)) % 7
    for (let n = 1; n <= remaining; n++) {
      cells.push({
        day: n,
        isCurrent: false,
        isToday: false,
      })
    }

    return cells
  }

  let gridContainer: Gtk.Box | null = null

  const renderGrid = (year: number, month: number) => {
    if (!gridContainer) return
    let child = gridContainer.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      gridContainer.remove(child)
      child = next
    }

    const cells = getMonthMatrix(year, month)
    const totalRows = Math.ceil(cells.length / 7)

    for (let r = 0; r < totalRows; r++) {
      const rowBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        homogeneous: true,
        spacing: 4,
      })

      for (let c = 0; c < 7; c++) {
        const idx = r * 7 + c
        const cell = cells[idx]
        if (!cell) break

        const dayBtn = new Gtk.Button({
          label: String(cell.day),
          hasFrame: false,
        })

        const cssClasses = ["cc-cal-day-cell"]
        if (!cell.isCurrent) {
          cssClasses.push("muted-day")
        } else if (cell.isToday) {
          cssClasses.push("today-cell")
        }
        dayBtn.set_css_classes(cssClasses)

        rowBox.append(dayBtn)
      }
      gridContainer.append(rowBox)
    }
  }

  const prevMonth = () => {
    let m = calMonth.get() - 1
    let y = calYear.get()
    if (m < 0) {
      m = 11
      y -= 1
    }
    setCalMonth(m)
    setCalYear(y)
    setMonthTitle(`${monthNames[m]} ${y}`)
    renderGrid(y, m)
  }

  const nextMonth = () => {
    let m = calMonth.get() + 1
    let y = calYear.get()
    if (m > 11) {
      m = 0
      y += 1
    }
    setCalMonth(m)
    setCalYear(y)
    setMonthTitle(`${monthNames[m]} ${y}`)
    renderGrid(y, m)
  }

  // Helper para cerrar y ejecutar comando
  const runAndClose = (cmd: string) => {
    const id = String(gdkmonitor.description || gdkmonitor.connector || "default")
    const w = windows[id]
    if (w) (w as any).visible = false
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
      GLib.spawn_command_line_async(cmd)
      return false
    })
  }

  const win = (
    <window
      name={`control-center-${gdkmonitor.connector}`}
      namespace="control-center"
      gdkmonitor={gdkmonitor}
      anchor={TOP | BOTTOM | RIGHT}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      keymode={Astal.Keymode.ON_DEMAND}
      visible={false}
      margin_top={8}
      margin_right={10}
      margin_bottom={8}
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
        class={getWidgetThemeClass("control-center-drawer")}
        spacing={9}
        vexpand
      >
        {/* ── 1. CABECERA SUPERIOR MODERNA ── */}
        <box class="cc-topbar-row" halign={Gtk.Align.FILL} valign={Gtk.Align.CENTER}>
          {/* Uptime Pill izquierda */}
          <box class="cc-uptime-chip" spacing={5} valign={Gtk.Align.CENTER}>
            <image iconName="custom-mountain-symbolic" pixelSize={13} class="uptime-icon" />
            <label label={uptime} class="uptime-text" />
          </box>

          <box hexpand />

          {/* Iconos de acción a la derecha */}
          <box spacing={5} valign={Gtk.Align.CENTER}>
            {/* Botón Portapapeles (abre el modal independiente al lado) */}
            <button
              class="cc-topbar-btn"
              tooltipText="Historial del Portapapeles"
              onClicked={() => {
                toggleClipboardWindow(gdkmonitor)
              }}
            >
              <image iconName="edit-paste-symbolic" pixelSize={14} />
            </button>

            {/* Botón FondosApp */}
            <button
              class="cc-topbar-btn"
              tooltipText="Fondos de pantalla"
              onClicked={() => runAndClose(`${home}/.config/FondosApp/FondosApp`)}
            >
              <image iconName="document-edit-symbolic" pixelSize={14} />
            </button>

            {/* Botón Recargar Hyprland */}
            <button
              class="cc-topbar-btn"
              tooltipText="Recargar Hyprland"
              onClicked={() => {
                reloadHyprland()
                GLib.spawn_command_line_async("notify-send 'Hyprland' 'Configuración recargada' -i view-refresh-symbolic")
              }}
            >
              <image iconName="view-refresh-symbolic" pixelSize={14} />
            </button>

            {/* Botón Apagado / Menú de energía */}
            <button
              class="cc-topbar-btn power-off-btn"
              tooltipText="Apagar equipo (Clic derecho: Reiniciar)"
              onClicked={() => runAndClose("systemctl poweroff")}
              $={(self) => {
                const click = new Gtk.GestureClick({ button: 3 })
                click.connect("pressed", () => {
                  runAndClose("systemctl reboot")
                })
                self.add_controller(click)
              }}
            >
              <image iconName="system-shutdown-symbolic" pixelSize={14} />
            </button>
          </box>
        </box>

        {/* ── 2. SLIDER DE VOLUMEN (ANCHO COMPLETO COMPACTO) ── */}
        <box
          class="cc-volume-pill"
          hexpand
          valign={Gtk.Align.CENTER}
          spacing={10}
          $={(self) => {
            const scroll = new Gtk.EventControllerScroll({
              flags: Gtk.EventControllerScrollFlags.VERTICAL | Gtk.EventControllerScrollFlags.SMOOTH,
            })
            scroll.connect("scroll", (_ctrl, _dx, dy) => {
              changeVol(dy < 0 ? 3 : -3)
              return true
            })
            self.add_controller(scroll)
          }}
        >
          <button
            class="cc-slider-icon-btn"
            tooltipText="Silenciar / Activar sonido"
            onClicked={() => {
              if (wp?.defaultSpeaker) {
                wp.defaultSpeaker.mute = !wp.defaultSpeaker.mute
              }
            }}
          >
            <image iconName="audio-volume-high-symbolic" pixelSize={16} />
          </button>
          <box class="cc-slider-bar-track" hexpand valign={Gtk.Align.CENTER}>
            <box
              class="cc-slider-bar-fill"
              css={volumePct((v) => `min-width: ${Math.round((Math.min(100, v) / 100) * 220)}px;`)}
            />
          </box>
          <label label={volumePct((v) => `${v}%`)} class="cc-slider-pct" />
        </box>

        {/* ── 3. ACCIONES RÁPIDAS: WI-FI Y CAPTURA COMPACTAS ── */}
        <box spacing={8} class="cc-quick-row" halign={Gtk.Align.FILL}>
          {/* Botón Wi-Fi */}
          <button
            class={wifiEnabled((on) => (on ? "cc-quick-pill wifi-pill active" : "cc-quick-pill wifi-pill"))}
            hexpand
            tooltipText={wifiSsid((s) => `Red: ${s} (${wifiStrength.get()}% señal) - Clic para conmutar`)}
            onClicked={toggleWifi}
          >
            <box spacing={8} valign={Gtk.Align.CENTER}>
              <image
                iconName={wifiEnabled((on) => (on ? "network-wireless-signal-excellent-symbolic" : "network-wireless-offline-symbolic"))}
                pixelSize={18}
                class="pill-main-icon"
              />
              <box orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.START} hexpand spacing={1}>
                <label label={wifiSsid} class="pill-title" ellipsize={Pango.EllipsizeMode.END} max_width_chars={12} />
                <label label={wifiStatusText} class="pill-sub" />
              </box>
            </box>
          </button>

          {/* Botón Captura de pantalla */}
          <button
            class="cc-quick-pill screenshot-pill"
            hexpand
            tooltipText="Captura de pantalla (hyprshot -m region)"
            onClicked={() => runAndClose("hyprshot -m region")}
          >
            <box spacing={8} valign={Gtk.Align.CENTER}>
              <image iconName="camera-photo-symbolic" pixelSize={18} class="pill-main-icon" />
              <box orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.START} hexpand>
                <label label="Captura" class="pill-title" />
              </box>
            </box>
          </button>
        </box>

        {/* ── 4. SECCIÓN CENTRAL: NOTIFICACIONES (EN EL MEDIO) ── */}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={5} class="cc-notifs-section" vexpand>
          {/* Lista de notificaciones scrollable */}
          <scrolledwindow
            hscrollbarPolicy={Gtk.PolicyType.NEVER}
            vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
            minContentHeight={110}
            maxContentHeight={160}
            vexpand
            class="cc-notifs-scroll"
          >
            <box orientation={Gtk.Orientation.VERTICAL} spacing={6} class="cc-notifs-flow">
              <For each={notifHistory}>
                {(entry: HistoryEntry) => {
                  const cleanSummary = stripHtml(entry.summary)
                  const cleanBody = stripHtml(entry.body)
                  return (
                    <box class="cc-notif-card" spacing={10} valign={Gtk.Align.CENTER}>
                      {/* Avatar o Icono */}
                      <box
                        class="cc-notif-avatar"
                        widthRequest={38}
                        heightRequest={38}
                        valign={Gtk.Align.CENTER}
                        css={entry.image ? `background-image: url("file://${entry.image}"); background-size: cover; background-position: center; border-radius: 9999px;` : "border-radius: 9999px;"}
                      >
                        {!entry.image && (
                          <image
                            iconName={entry.appIcon || "preferences-system-notifications-symbolic"}
                            pixelSize={18}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            hexpand
                          />
                        )}
                      </box>

                      {/* Contenido */}
                      <box orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER} spacing={2}>
                        <box spacing={6} valign={Gtk.Align.CENTER}>
                          <label
                            label={cleanSummary || entry.appName}
                            class="cc-notif-title"
                            halign={Gtk.Align.START}
                            hexpand
                            ellipsize={Pango.EllipsizeMode.END}
                          />
                          <label label={formatTime(entry.time)} class="cc-notif-time" />
                        </box>
                        {cleanBody !== "" && (
                          <label
                            label={cleanBody}
                            class="cc-notif-body"
                            halign={Gtk.Align.START}
                            ellipsize={Pango.EllipsizeMode.END}
                            lines={2}
                          />
                        )}
                      </box>

                      {/* Botón Descartar individual */}
                      <button
                        class="cc-notif-dismiss-btn"
                        valign={Gtk.Align.CENTER}
                        tooltipText="Descartar"
                        onClicked={() => removeFromHistory(entry.id)}
                      >
                        <image iconName="window-close-symbolic" pixelSize={13} />
                      </button>
                    </box>
                  )
                }}
              </For>

              {/* Estado vacío si no hay notificaciones */}
              <box
                visible={notifHistory((entries) => entries.length === 0)}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                vexpand
                class="cc-notifs-empty"
              >
                <label label="Sin notificaciones pendientes" />
              </box>
            </box>
          </scrolledwindow>

          {/* Barra inferior de notificaciones (Píldora con campana, contador y papelera) */}
          <box class="cc-notifs-footer-bar" valign={Gtk.Align.CENTER} halign={Gtk.Align.FILL}>
            <image iconName="preferences-system-notifications-symbolic" pixelSize={15} class="notifs-bell-icon" />
            <label
              label={notifHistory((entries) =>
                entries.length === 1
                  ? "1 notificación"
                  : `${entries.length} notificaciones`
              )}
              class="notifs-count-label"
              hexpand
              halign={Gtk.Align.CENTER}
            />
            <button
              class="notifs-clear-trash-btn"
              tooltipText="Borrar todas las notificaciones"
              onClicked={() => {
                clearHistory()
                try {
                  const notifd = AstalNotifd.get_default()
                  notifd.get_notifications().forEach((n: any) => n.dismiss())
                } catch (_) {}
              }}
            >
              <image iconName="user-trash-symbolic" pixelSize={14} />
            </button>
          </box>
        </box>

        {/* ── 5. SECCIÓN INFERIOR: CALENDARIO EN ESPAÑOL ── */}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={10} class="cc-calendar-section">
          {/* Cabecera del mes con navegación funcional */}
          <box class="cc-cal-header" valign={Gtk.Align.CENTER} halign={Gtk.Align.FILL}>
            <label
              label={monthTitle}
              class="cc-cal-title"
              hexpand
              halign={Gtk.Align.START}
            />

            <box spacing={8} valign={Gtk.Align.CENTER}>
              <button class="cc-cal-nav-btn" tooltipText="Mes anterior" onClicked={prevMonth}>
                <label label="‹" class="cal-nav-arrow" />
              </button>
              <button class="cc-cal-nav-btn" tooltipText="Mes siguiente" onClicked={nextMonth}>
                <label label="›" class="cal-nav-arrow" />
              </button>
            </box>
          </box>

          {/* Días de la semana en Español: Lu Ma Mi Ju Vi Sá Do */}
          <box class="cc-cal-weekdays" homogeneous halign={Gtk.Align.FILL}>
            <label label="Lu" class="weekday-label" />
            <label label="Ma" class="weekday-label" />
            <label label="Mi" class="weekday-label" />
            <label label="Ju" class="weekday-label" />
            <label label="Vi" class="weekday-label" />
            <label label="Sá" class="weekday-label" />
            <label label="Do" class="weekday-label" />
          </box>

          {/* Cuadrícula de días generada dinámicamente */}
          <box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={4}
            class="cc-cal-matrix"
            $={(self) => {
              gridContainer = self
              renderGrid(calYear.get(), calMonth.get())
            }}
          />
        </box>
      </box>
    </window>
  ) as any

  const id = String(gdkmonitor.description || gdkmonitor.connector || "default")
  windows[id] = win
  return win
}

export function ControlCenterToggle({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  return (
    <button
      onClicked={() => {
        toggleControlCenter(gdkmonitor)
      }}
      cssClasses={["bar-pill-btn", "control-btn"]}
      valign={Gtk.Align.CENTER}
      tooltipText="Centro de Control"
    >
      <image iconName="custom-sliders-symbolic" />
    </button>
  )
}
