import { createPoll } from "ags/time"
import Gtk from "gi://Gtk"
import { Separator } from "../../components/Separator"

export function System() {
  let prevTotal = 0
  let prevIdle = 0

  const cpu = createPoll(
    "",
    5000,
    `bash -c "grep '^cpu ' /proc/stat"`,
  )((r) => {
    if (!r.startsWith("cpu")) return "0%"

    const parts = r.trim().split(/\s+/)

    const idle = Number(parts[4])
    const total = parts.slice(1).reduce((a, b) => a + Number(b), 0)

    const deltaTotal = total - prevTotal
    const deltaIdle = idle - prevIdle

    prevTotal = total
    prevIdle = idle

    if (deltaTotal <= 0) return "0%"

    const usage = Math.round((1 - deltaIdle / deltaTotal) * 100)
    return `${usage}%`
  })




  const ram = createPoll(
    "",
    10000,
    `bash -c "free -m | awk '/Mem:/ {print $3,$2}'"`,
  )((r) => {
    if (!r) return "0%"

    const [used, total] = r.trim().split(" ").map(Number)
    if (!total) return "0%"

    return `${Math.round((used / total) * 100)}%`
  })



  return (
    <box class="side" spacing={6} valign={Gtk.Align.CENTER}>
      <box class="system-box cpu">
        <label label={cpu} class="system-label" />
        <image iconName="custom-cpu-symbolic" class="system-icon" />
      </box>
      <box class="system-box ram">
        <label label={ram} class="system-label" />
        <image iconName="custom-ram-symbolic" class="system-icon" />
      </box>
    </box>
  )
}
