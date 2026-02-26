import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { Workspaces } from "./Workspaces"
import { TodayStats } from "./TodayStats"
import { CenterIsland } from "./CenterIsland"
import { Audio } from "./audio"
import { Tray } from "./tray"
import { System } from "./system"
import { Network } from "./network/Network"
import { createBinding } from "gnim"
import { LeftIsland } from "./islands/LeftIsland"
import { RightIsland } from "./islands/RightIsland"
import { ControlCenterToggle } from "./control_center/ControlCenter"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor

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
          <box $type="start">
            <LeftIsland />
            <box
              class="side"
              heightRequest={20}
              valign={Gtk.Align.CENTER}
              spacing={5}
            >
              {/* <Workspaces /> */}
              <ControlCenterToggle gdkmonitor={gdkmonitor} />
              <Workspaces orientation={Gtk.Orientation.HORIZONTAL} />
              <System />
            </box>
          </box>
          <box $type="center" class="center">
            <CenterIsland />
          </box>
          <box
            $type="end"
            class="side"
            heightRequest={20}
            valign={Gtk.Align.CENTER}
          >
            <box
              class="side"
              heightRequest={20}
              valign={Gtk.Align.CENTER}
              spacing={5}
            >
              {/* <Tray /> */}
              <Audio />
              <Network />

            </box>

            <RightIsland />
          </box>
        </centerbox>
      </window>
      
    </>
  )
}
