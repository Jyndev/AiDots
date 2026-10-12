import { createState } from "ags"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

export interface ChatMessage {
  id: string
  role: "user" | "model" | "system"
  text: string
  timestamp: number
}

const KEY_FILE = `${GLib.get_home_dir()}/.config/gemini_api_key`

export function getStoredApiKey(): string {
  try {
    const file = Gio.File.new_for_path(KEY_FILE)
    if (file.query_exists(null)) {
      const [, contents] = file.load_contents(null)
      return new TextDecoder().decode(contents).trim()
    }
  } catch (e) {
    // Silencioso
  }
  return ""
}

export function saveApiKey(key: string): boolean {
  try {
    const file = Gio.File.new_for_path(KEY_FILE)
    file.replace_contents(
      new TextEncoder().encode(key.trim()),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    )
    return true
  } catch (e) {
    return false
  }
}

// Estados reactivos
export const [messages, setMessages] = createState<ChatMessage[]>([
  {
    id: "welcome",
    role: "model",
    text: "¡Hola! Soy Gemini. ¿En qué puedo ayudarte hoy?\n\n*Consejo:* Si aún no has configurado tu API Key, puedes obtenerla gratis en [aistudio.google.com](https://aistudio.google.com/) y guardarla aquí escribiendo `/key TU_CLAVE`.",
    timestamp: Date.now(),
  },
])

export interface AvailableModel {
  id: string
  name: string
  desc: string
  color: string
  symbol: string
}

export const AVAILABLE_MODELS: AvailableModel[] = [
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    desc: "Rápido y eficiente",
    color: "#3b82f6",
    symbol: "●",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    desc: "Ligero y veloz",
    color: "#14b8a6",
    symbol: "■",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    desc: "Recomendado • Multimodal",
    color: "#ec4899",
    symbol: "◆",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    desc: "Alta capacidad de razonamiento",
    color: "#f97316",
    symbol: "▼",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    desc: "Versión de vanguardia",
    color: "#8b5cf6",
    symbol: "▲",
  },
]

export const [isThinking, setIsThinking] = createState<boolean>(false)
export const [currentModel, setCurrentModel] = createState<string>("gemini-3.5-flash")

export function setModel(modelId: string) {
  setCurrentModel(modelId)
  const found = AVAILABLE_MODELS.find((m) => m.id === modelId)
  const displayName = found ? found.name : modelId
  setMessages((prev) => [
    ...prev,
    {
      id: String(Date.now()),
      role: "system",
      text: `Modelo cambiado a **${displayName}** (\`${modelId}\`).`,
      timestamp: Date.now(),
    },
  ])
}

export async function sendPrompt(rawPrompt: string) {
  const prompt = rawPrompt.trim()
  if (!prompt) return

  // Manejo de comandos rápidos
  if (prompt.startsWith("/key")) {
    const parts = prompt.split(/\s+/)
    if (parts.length > 1 && parts[1].length > 5) {
      const key = parts[1].trim()
      const ok = saveApiKey(key)
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "user", text: prompt, timestamp: Date.now() },
        {
          id: String(Date.now() + 1),
          role: "system",
          text: ok
            ? "API Key guardada correctamente en `~/.config/gemini_api_key`. ¡Ya puedes empezar a chatear!"
            : "Error al guardar la API Key en el disco.",
          timestamp: Date.now(),
        },
      ])
    } else {
      const current = getStoredApiKey()
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "user", text: prompt, timestamp: Date.now() },
        {
          id: String(Date.now() + 1),
          role: "system",
          text: current
            ? `Tu API Key actual está configurada (termina en ...${current.slice(-4)}).\nPara cambiarla, escribe: \`/key TU_NUEVA_CLAVE\``
            : "No tienes una API Key configurada.\nConsíguela gratis en https://aistudio.google.com/ y escríbela aquí: `/key TU_CLAVE`",
          timestamp: Date.now(),
        },
      ])
    }
    return
  }

  if (prompt === "/clear") {
    setMessages([])
    return
  }

  if (prompt.startsWith("/model")) {
    const parts = prompt.split(/\s+/)
    if (parts.length > 1) {
      const m = parts[1].trim()
      if (m.includes("flash")) setCurrentModel("gemini-3.5-flash")
      else if (m.includes("pro")) setCurrentModel("gemini-2.5-pro")
      else setCurrentModel(m)
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "user", text: prompt, timestamp: Date.now() },
        {
          id: String(Date.now() + 1),
          role: "system",
          text: `Modelo cambiado a **${currentModel()}**.`,
          timestamp: Date.now(),
        },
      ])
    } else {
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "user", text: prompt, timestamp: Date.now() },
        {
          id: String(Date.now() + 1),
          role: "system",
          text: `Modelo activo: **${currentModel()}**.\nPuedes cambiarlo con \`/model gemini-3.5-flash\` o \`/model gemini-3-flash-preview\`.`,
          timestamp: Date.now(),
        },
      ])
    }
    return
  }

  // Validar API Key
  const apiKey = getStoredApiKey()
  if (!apiKey) {
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), role: "user", text: prompt, timestamp: Date.now() },
      {
        id: String(Date.now() + 1),
        role: "system",
        text: "⚠️ **Falta la API Key**\n\nPor favor, obtén una clave gratuita en [Google AI Studio](https://aistudio.google.com/) y regístrala aquí escribiendo:\n`/key TU_API_KEY`",
        timestamp: Date.now(),
      },
    ])
    return
  }

  // 1. Agregar mensaje del usuario a la lista
  const userMsgId = String(Date.now())
  setMessages((prev) => [
    ...prev,
    { id: userMsgId, role: "user", text: prompt, timestamp: Date.now() },
  ])

  setIsThinking(true)

  // 2. Construir historial de conversación (últimos 6 mensajes para máxima velocidad)
  const historyContents = messages()
    .filter((m) => m.role === "user" || m.role === "model")
    .slice(-6)
    .map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }))

  // Añadir el nuevo mensaje si aún no estaba en historyContents
  if (!historyContents.some((c) => c.parts[0].text === prompt)) {
    historyContents.push({
      role: "user",
      parts: [{ text: prompt }],
    })
  }

  const payload = JSON.stringify({
    contents: historyContents,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  })

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel()}:generateContent?key=${apiKey}`

  try {
    const proc = new Gio.Subprocess({
      argv: [
        "curl",
        "-s",
        "-X",
        "POST",
        endpoint,
        "-H",
        "Content-Type: application/json",
        "-d",
        "@-",
      ],
      flags:
        Gio.SubprocessFlags.STDIN_PIPE |
        Gio.SubprocessFlags.STDOUT_PIPE |
        Gio.SubprocessFlags.STDERR_PIPE,
    })

    proc.init(null)

    proc.communicate_utf8_async(payload, null, (_obj, res) => {
      try {
        const [, stdout, stderr] = proc.communicate_utf8_finish(res)
        setIsThinking(false)

        if (stderr && stderr.trim().length > 0 && (!stdout || stdout.trim().length === 0)) {
          setMessages((prev) => [
            ...prev,
            {
              id: String(Date.now()),
              role: "system",
              text: `Error de red al conectar con Gemini: ${stderr}`,
              timestamp: Date.now(),
            },
          ])
          return
        }

        const data = JSON.parse(stdout)

        if (data.error) {
          setMessages((prev) => [
            ...prev,
            {
              id: String(Date.now()),
              role: "system",
              text: `⚠️ **Error de Gemini:** ${data.error.message || JSON.stringify(data.error)}`,
              timestamp: Date.now(),
            },
          ])
          return
        }

        const replyText =
          data.candidates?.[0]?.content?.parts?.[0]?.text ||
          "Gemini no devolvió ninguna respuesta de texto."

        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            role: "model",
            text: replyText,
            timestamp: Date.now(),
          },
        ])
      } catch (err: any) {
        setIsThinking(false)
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            role: "system",
            text: `Error al procesar la respuesta: ${err.message || err}`,
            timestamp: Date.now(),
          },
        ])
      }
    })
  } catch (e: any) {
    setIsThinking(false)
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        role: "system",
        text: `Error al invocar curl: ${e.message || e}`,
        timestamp: Date.now(),
      },
    ])
  }
}
