import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { Workspaces } from "./Workspaces"
import { TodayStats } from "./TodayStats"
import { CenterIsland } from "./CenterIsland"
import { Audio } from "./audio"
import { Tray } from "./tray"
import { System } from "./system"
import { createBinding } from "gnim"
import { LeftIsland } from "./islands/LeftIsland"
import { RightIsland } from "./islands/RightIsland"
import { ControlCenterToggle } from "./control_center/ControlCenter"
import { toggleGeminiWindow } from "./gemini/GeminiChat"
import { toggleSettingsWindow } from "./settings/SettingsWindow"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <>
      <window
        visible
        name="bar"
        class="Bar"
        gdkmonitor={gdkmonitor}
        exclusivity={Astal.Exclusivity.EXCLUSIVE}
        anchor={TOP | LEFT | RIGHT}
        application={app}
      >
        <centerbox cssName="bar">
          {/* LADO IZQUIERDO */}
          <box $type="start" valign={Gtk.Align.START}>
            <LeftIsland />
            <box
              class="side"
              heightRequest={20}
              valign={Gtk.Align.CENTER}
              spacing={5}
            >
              <button
                valign={Gtk.Align.CENTER}
                tooltipText="Abrir Google Gemini"
                onClicked={() => {
                  toggleGeminiWindow(gdkmonitor)
                }}
              >
                <image iconName="custom-gemini-symbolic" />
              </button>
              <button
                valign={Gtk.Align.CENTER}
                tooltipText="Configuración de Hyprland"
                onClicked={() => {
                  toggleSettingsWindow(gdkmonitor)
                }}
              >
                <image iconName="custom-hex-symbolic" />
              </button>
              <Workspaces orientation={Gtk.Orientation.HORIZONTAL} />
              <System />
            </box>
          </box>

          {/* CENTRO */}
          <box $type="center" class="center" valign={Gtk.Align.START}>
            <CenterIsland />
          </box>

          {/* LADO DERECHO: RightIsland pegado al tope y botón de centro de control a la derecha */}
          <box $type="end" valign={Gtk.Align.START}>
            <box
              class="side"
              heightRequest={20}
              valign={Gtk.Align.CENTER}
              spacing={6}
            >
              {/* <Tray /> */}
              <Audio />
              <ControlCenterToggle gdkmonitor={gdkmonitor} />
            </box>

            <RightIsland />
          </box>
        </centerbox>
      </window>
    </>
  )
}
