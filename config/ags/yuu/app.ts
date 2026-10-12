import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import Bar from "./widget/Bar"
import NotificationPopups from "./widget/notification/Notification"
import ControlCenter, { toggleControlCenter } from "./widget/control_center/ControlCenter"
import ClipboardWindow, { toggleClipboardWindow } from "./widget/control_center/ClipboardWindow"
import GeminiChat, { toggleGeminiWindow, toggleModelPicker } from "./widget/gemini/GeminiChat"
import SettingsWindow, { toggleSettingsWindow } from "./widget/settings/SettingsWindow"
import { sendPrompt } from "./services/gemini"

function getCompiledCss(): string {
  const scssFile = `${SRC}/style.scss`
  const cssFile = `/tmp/ags_yuu_style.css`
  try {
    GLib.spawn_command_line_sync(`sass --no-charset -I ${SRC} ${scssFile} ${cssFile}`)
    return cssFile
  } catch (e) {
    print(`[CSS Compilation Error]: ${e}`)
    return scssFile
  }
}

app.start({
  icons: `${SRC}/icons`,
  css: getCompiledCss(),
  requestHandler(request, res) {
    const reqStr = String(request)
    print(`[AGS Request] received: "${reqStr}"`)
    if (reqStr.includes("toggle-control-center")) {
      toggleControlCenter()
      res("ok")
    } else if (reqStr.includes("toggle-clipboard")) {
      toggleClipboardWindow()
      res("ok")
    } else if (reqStr.includes("toggle-settings")) {
      toggleSettingsWindow()
      res("ok")
    } else if (reqStr.includes("toggle-gemini")) {
      toggleGeminiWindow()
      res("ok")
    } else if (reqStr.includes("toggle-model-picker")) {
      toggleModelPicker()
      res("ok")
    } else if (reqStr.includes("gemini-prompt:")) {
      const p = reqStr.split("gemini-prompt:")[1]
      sendPrompt(p)
      res("ok")
    } else {
      res("unknown")
    }
  },
  main() {
    app.get_monitors().map((monitor) => {
      Bar(monitor)
      NotificationPopups(monitor)
      ControlCenter(monitor)
      ClipboardWindow(monitor)
      GeminiChat(monitor)
      SettingsWindow(monitor)
    })
  },
})