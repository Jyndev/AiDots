import { createPoll } from "ags/time"

export function Temperature() {
  // TODO: fuck it we ball
  const cpuTemp = createPoll(
    "",
    5000,
    `bash -c "sensors 2>/dev/null | awk '/Package id 0/ {print int(\\$4); exit} /Tctl/ {print int(\\$2); exit}' || awk '{print int(\\$1/1000)}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null"`,
)((r) => {
    const temp = parseInt(r)
    return isNaN(temp) || temp === 0 ? "0°C" : `${temp}°C`
})

  return (
    <box class="system-box temperature">
      <label label={cpuTemp} class="system-label" />
      <image iconName="custom-flame-symbolic" class="system-icon" />
    </box>
  )
}
