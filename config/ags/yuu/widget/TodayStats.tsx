import { Clock } from "./Clock"
import { Temperature } from "./temperature/temperature"

export function TodayStats() {
  return (
    <box class="today-stats">
      <Clock />
      <Temperature />
    </box>
  )
}
