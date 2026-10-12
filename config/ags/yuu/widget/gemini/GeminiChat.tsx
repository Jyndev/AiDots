import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { For, createState, createBinding } from "ags"
import {
  messages,
  isThinking,
  currentModel,
  setModel,
  AVAILABLE_MODELS,
  sendPrompt,
  ChatMessage,
} from "../../services/gemini"
import { getWidgetThemeClass } from "../../services/themeSettings"

const windows: Record<string, Gtk.Window> = {}

function copyToClipboard(text: string) {
  try {
    const display = Gdk.Display.get_default()
    if (display) {
      display.get_clipboard().set(text)
    }
  } catch {
    GLib.spawn_command_line_async(
      `bash -c "printf '%s' ${GLib.shell_quote(text)} | wl-copy"`
    )
  }
}

function toPangoMarkup(text: string): string {
  // 1. Escapar caracteres HTML/XML
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // 2. Líneas divisorias horizontales (*** o --- o ___)
  escaped = escaped.replace(
    /^[ \t]*(\*{3,}|-{3,}|_{3,})[ \t]*$/gm,
    '<span foreground="#f8bb71" alpha="40%">───────────────────────────────────</span>'
  )

  // 3. Encabezados (#, ##, ###)
  escaped = escaped.replace(/^###\s+(.*$)/gm, '<span font_weight="bold" foreground="#f8bb71">$1</span>')
  escaped = escaped.replace(/^##\s+(.*$)/gm, '<span font_weight="bold" foreground="#f8bb71" font_size="1.08em">$1</span>')
  escaped = escaped.replace(/^#\s+(.*$)/gm, '<span font_weight="bold" foreground="#f8bb71" font_size="1.15em">$1</span>')

  // 4. Listas numeradas: 1. Título
  escaped = escaped.replace(/^(\s*)(\\d+)\.\s+(.*)$/gm, '$1<span foreground="#f8bb71"><b>$2.</b></span> <b>$3</b>')

  // 5. Listas con viñetas: * o -
  escaped = escaped.replace(/^(\s*)[\*\-]\s+(.*)$/gm, '$1<span foreground="#f8bb71">•</span> $2')

  // 6. Citas / blockquotes: > texto
  escaped = escaped.replace(/^>\s*(.*$)/gm, '<span foreground="#d4c4b5"><i>│ $1</i></span>')

  // 7. Links Markdown [Texto](url) -> enlaces limpios coloreados sin corchetes
  escaped = escaped.replace(
    /\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/g,
    '<a href="$2"><span foreground="#f8bb71" underline="single">$1</span></a>'
  )

  // 8. Negrita **texto**
  escaped = escaped.replace(/\*\*([\s\S]*?)\*\*/g, "<b>$1</b>")

  // 9. Cursiva *texto*
  escaped = escaped.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, "$1<i>$2</i>$3")

  // 10. Código en línea fluido y redondeado
  escaped = escaped.replace(
    /`([^`]+)`/g,
    '<span font_family="monospace" foreground="#dfc1a2"><b>$1</b></span>'
  )

  return escaped
}

interface ContentChunk {
  type: "text" | "code"
  lang?: string
  code?: string
  text?: string
}

function parseMarkdownChunks(content: string): ContentChunk[] {
  const chunks: ContentChunk[] = []
  const codeRegex = /```([a-zA-Z0-9_\-#+]*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.substring(lastIndex, match.index).trim()
      if (textBefore) {
        chunks.push({ type: "text", text: textBefore })
      }
    }
    chunks.push({
      type: "code",
      lang: match[1] || "código",
      code: match[2].trim(),
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const textAfter = content.substring(lastIndex).trim()
    if (textAfter) {
      chunks.push({ type: "text", text: textAfter })
    }
  }

  return chunks.length > 0 ? chunks : [{ type: "text", text: content }]
}

function CodeBlockWidget({ code, lang }: { code: string; lang: string }) {
  let btnLabel: Gtk.Label | null = null
  const lines = code.split("\n")
  const lineNumbers = lines.map((_, i) => i + 1).join("\n")

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      class="ai-code-card"
      spacing={8}
    >
      <box class="ai-code-header" halign={Gtk.Align.FILL}>
        <label label={lang} class="ai-code-lang" halign={Gtk.Align.START} hexpand />
        <button
          class="ai-code-copy-btn"
          halign={Gtk.Align.END}
          onClicked={() => {
            copyToClipboard(code)
            if (btnLabel) btnLabel.label = "Copiado"
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
              if (btnLabel) btnLabel.label = "Copy"
              return false
            })
          }}
        >
          <box spacing={4} valign={Gtk.Align.CENTER}>
            <image iconName="custom-copy-symbolic" class="ai-copy-icon" />
            <label
              label="Copy"
              $={(self) => {
                btnLabel = self
              }}
              class="ai-copy-label"
            />
          </box>
        </button>
      </box>

      <box class="ai-code-content" spacing={12}>
        <label
          label={lineNumbers}
          xalign={1}
          valign={Gtk.Align.START}
          class="ai-code-lines"
        />
        <label
          label={code}
          wrap
          selectable
          xalign={0}
          valign={Gtk.Align.START}
          hexpand
          class="ai-code-text"
        />
      </box>
    </box>
  )
}

function MessageWidget({ msg }: { msg: ChatMessage }) {
  const userName = GLib.get_user_name() || "user"

  if (msg.role === "user") {
    return (
      <box
        orientation={Gtk.Orientation.VERTICAL}
        class="ai-msg-group user-group"
        halign={Gtk.Align.END}
        spacing={3}
      >
        <box class="ai-badge-row" halign={Gtk.Align.END}>
          <label label={userName} class="ai-author-badge user-badge" />
        </box>
        <box class="ai-bubble user-bubble" halign={Gtk.Align.END}>
          <label
            label={msg.text}
            wrap
            xalign={1}
            selectable
            class="ai-msg-body user-body"
          />
        </box>
      </box>
    )
  }

  if (msg.role === "system") {
    return (
      <box class="ai-system-row" halign={Gtk.Align.CENTER}>
        <box class="ai-bubble system-bubble">
          <label
            label={toPangoMarkup(msg.text)}
            useMarkup
            wrap
            xalign={0.5}
            selectable
            class="ai-system-text"
            onActivateLink={(_self, uri) => {
              GLib.spawn_command_line_async(`xdg-open ${GLib.shell_quote(uri)}`)
              return true
            }}
          />
        </box>
      </box>
    )
  }

  // Respuesta de Gemini (Model) a la IZQUIERDA
  const chunks = parseMarkdownChunks(msg.text)

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      class="ai-msg-group model-group"
      halign={Gtk.Align.START}
      spacing={3}
    >
      <box class="ai-badge-row" halign={Gtk.Align.START}>
        <label
          label="Google Gemini"
          class="ai-author-badge model-badge"
        />
      </box>

      <box
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
        class="ai-bubble model-bubble"
        halign={Gtk.Align.START}
      >
        {chunks.map((chunk) => {
          if (chunk.type === "code" && chunk.code) {
            return <CodeBlockWidget code={chunk.code} lang={chunk.lang || "código"} />
          }
          return (
            <label
              label={toPangoMarkup(chunk.text || "")}
              useMarkup
              wrap
              xalign={0}
              selectable
              class="ai-markdown-text"
              onActivateLink={(_self, uri) => {
                GLib.spawn_command_line_async(`xdg-open ${GLib.shell_quote(uri)}`)
                return true
              }}
            />
          )
        })}
      </box>
    </box>
  )
}

let togglePickerFn: (() => void) | null = null
export function toggleModelPicker() {
  if (togglePickerFn) togglePickerFn()
}

export default function GeminiChat(gdkmonitor: Gdk.Monitor) {
  const { TOP, BOTTOM, LEFT } = Astal.WindowAnchor
  let entryWidget: Gtk.Entry | null = null
  let scrolledWin: Gtk.ScrolledWindow | null = null
  const [showModelPicker, setShowModelPicker] = createState<boolean>(false)
  togglePickerFn = () => setShowModelPicker(!showModelPicker())

  const scrollToBottom = () => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60, () => {
      if (scrolledWin) {
        const vadj = scrolledWin.get_vadjustment()
        vadj.set_value(vadj.get_upper() - vadj.get_page_size())
      }
      return false
    })
  }

  const handleSend = () => {
    if (!entryWidget) return
    const text = entryWidget.text
    if (!text || text.trim().length === 0) return
    entryWidget.text = ""
    sendPrompt(text)
    scrollToBottom()
  }

  const win = (
    <window
      name={`gemini-chat-${gdkmonitor.connector}`}
      class="GeminiChatWindow"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      anchor={TOP | BOTTOM | LEFT}
      visible={false}
      margin_top={0}
      margin_left={0}
      margin_bottom={0}
      $={(self) => {
        const keyController = new Gtk.EventControllerKey()
        keyController.connect("key-pressed", (_controller, keyval) => {
          if (keyval === Gdk.KEY_Escape) {
            self.visible = false
          }
        })
        self.add_controller(keyController)
      }}
    >
      <box
        orientation={Gtk.Orientation.VERTICAL}
        class={getWidgetThemeClass("ai-window-card")}
        spacing={12}
        widthRequest={420}
        vexpand
      >
        {/* 1. TABS SUPERIORES (Google Gemini / Close) */}
        <box class="ai-top-tabs" halign={Gtk.Align.FILL} valign={Gtk.Align.CENTER}>
          <box halign={Gtk.Align.START} hexpand valign={Gtk.Align.CENTER}>
            <box class="ai-tab active" spacing={2} valign={Gtk.Align.CENTER}>
              <image iconName="custom-gemini-symbolic" class="ai-tab-icon" />
              <label label="Google Gemini" class="ai-tab-label" />
            </box>
          </box>

          <button
            class="ai-close-btn"
            halign={Gtk.Align.END}
            valign={Gtk.Align.CENTER}
            onClicked={() => {
              ;(win as any).visible = false
            }}
          >
            <label label="✕" />
          </button>
        </box>

        {/* 2. SELECTOR INTERACTIVO DE MODELOS DISPONIBLES */}
        <box orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER} spacing={3}>
          <button
            class="ai-model-capsule-btn"
            valign={Gtk.Align.CENTER}
            halign={Gtk.Align.CENTER}
            tooltipText="Cambiar modelo de Gemini"
            onClicked={() => {
              setShowModelPicker(!showModelPicker())
            }}
          >
            <box spacing={3} valign={Gtk.Align.CENTER}>
              <label
                label={currentModel((m) => {
                  const found = AVAILABLE_MODELS.find((x) => x.id === m)
                  if (!found) return `<span foreground="#f8bb71">✦</span>`
                  return `<span foreground="${found.color}">${found.symbol}</span>`
                })}
                useMarkup
                class="capsule-symbol"
              />
              <label
                label={currentModel((m) => {
                  const found = AVAILABLE_MODELS.find((x) => x.id === m)
                  return found ? found.name : m
                })}
                class="capsule-label"
              />
              <label
                label={showModelPicker((open) => (open ? "▲" : "▼"))}
                class="capsule-chevron"
              />
            </box>
          </button>

          {/* Menú desplegable con los 5 modelos de Google AI Studio */}
          <box
            orientation={Gtk.Orientation.VERTICAL}
            class="ai-model-dropdown"
            visible={showModelPicker}
            spacing={4}
          >
            {AVAILABLE_MODELS.map((m) => {
              const isSelected = currentModel((cm) => cm === m.id)
              return (
                <button
                  class={isSelected((s) => (s ? "ai-model-option selected" : "ai-model-option"))}
                  onClicked={() => {
                    setModel(m.id)
                    setShowModelPicker(false)
                  }}
                >
                  <box spacing={6} valign={Gtk.Align.CENTER}>
                    <label
                      label={`<span foreground="${m.color}">${m.symbol}</span>`}
                      useMarkup
                      class="option-symbol"
                      valign={Gtk.Align.CENTER}
                    />
                    <box orientation={Gtk.Orientation.VERTICAL} hexpand halign={Gtk.Align.START}>
                      <label label={m.name} class="option-title" halign={Gtk.Align.START} />
                      <label label={m.desc} class="option-desc" halign={Gtk.Align.START} />
                    </box>
                    <label
                      label="✓"
                      class="option-check"
                      visible={isSelected}
                      halign={Gtk.Align.END}
                    />
                  </box>
                </button>
              )
            })}
          </box>
        </box>

        {/* 3. HISTORIAL DE MENSAJES EXPANDIBLE: CUBRE TODO EL ALTO DEL PANEL */}
        <scrolledwindow
          class="ai-scroll-view"
          hscrollbarPolicy={Gtk.PolicyType.NEVER}
          vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
          vexpand
          $={(self) => {
            scrolledWin = self
          }}
        >
          <box
            orientation={Gtk.Orientation.VERTICAL}
            class="ai-messages-flow"
            spacing={10}
            valign={Gtk.Align.START}
          >
            {/* Header / Avatar integrado en el flujo scrolleable sin vexpand */}
            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="ai-hero-header"
              halign={Gtk.Align.CENTER}
              valign={Gtk.Align.START}
              spacing={2}
            >
              <box
                class="ai-hero-avatar-ring"
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
              >
                <image
                  iconName="custom-gemini-symbolic"
                  class="ai-hero-avatar-icon"
                  halign={Gtk.Align.CENTER}
                  valign={Gtk.Align.CENTER}
                  pixelSize={24}
                />
              </box>
              <label label="Assistant (Gemini)" class="ai-hero-title" halign={Gtk.Align.CENTER} />
              <label label="Google AI Studio" class="ai-hero-subtitle" halign={Gtk.Align.CENTER} />
            </box>

            <For each={messages}>{(msg) => <MessageWidget msg={msg} />}</For>

            {/* Pensando... */}
            <box
              class="ai-thinking-box"
              visible={isThinking}
              spacing={6}
              halign={Gtk.Align.START}
            >
              <image iconName="custom-gemini-symbolic" class="thinking-spinner" />
              <label label="Gemini is thinking..." class="thinking-label" />
            </box>
          </box>
        </scrolledwindow>

        {/* 5. CHIPS DE ACCIONES RÁPIDAS (/key y /clear) */}
        <box class="ai-quick-chips" halign={Gtk.Align.END} spacing={8}>
          <button
            class="ai-chip"
            onClicked={() => {
              if (entryWidget) {
                entryWidget.text = "/key "
                entryWidget.grab_focus()
              }
            }}
          >
            <label label="/key" />
          </button>
          <button
            class="ai-chip"
            onClicked={() => {
              sendPrompt("/clear")
            }}
          >
            <label label="/clear" />
          </button>
        </box>

        {/* 6. UNIFIED INPUT PILL */}
        <box class="ai-input-pill" halign={Gtk.Align.FILL} valign={Gtk.Align.CENTER}>
          <entry
            class="ai-text-input"
            placeholderText="Message Gemini..."
            hexpand
            valign={Gtk.Align.CENTER}
            $={(self) => {
              entryWidget = self
            }}
            onActivate={handleSend}
          />
          <button
            class="ai-send-arrow-btn"
            valign={Gtk.Align.CENTER}
            halign={Gtk.Align.CENTER}
            widthRequest={32}
            heightRequest={32}
            tooltipText="Enviar mensaje"
            onClicked={handleSend}
          >
            <image
              iconName="custom-send-symbolic"
              class="ai-send-icon"
              halign={Gtk.Align.CENTER}
              valign={Gtk.Align.CENTER}
              pixelSize={16}
            />
          </button>
        </box>
      </box>
    </window>
  ) as any

  windows[gdkmonitor.connector] = win
  return win
}

export function toggleGeminiWindow(gdkmonitor?: Gdk.Monitor) {
  const conn = gdkmonitor?.connector || Object.keys(windows)[0]
  const win = windows[conn]
  if (win) {
    win.visible = !win.visible
    if (win.visible) {
      win.present()
    }
  }
}
