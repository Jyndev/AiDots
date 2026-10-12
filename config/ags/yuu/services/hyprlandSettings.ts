import { createState } from "ags"
import Gio from "gi://Gio"

// Helper para ejecutar comandos asíncronos sin bloquear GTK
function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const proc = new Gio.Subprocess({
        argv: ["bash", "-c", cmd],
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      })
      proc.init(null)
      proc.communicate_utf8_async(null, null, (_proc, res) => {
        try {
          const [, stdout] = proc.communicate_utf8_finish(res)
          resolve(stdout ? stdout.trim() : "")
        } catch {
          resolve("")
        }
      })
    } catch {
      resolve("")
    }
  })
}

// Helper para enviar comandos a Hyprland vía REPL Lua
export function hyprLua(luaCode: string) {
  const safeCode = luaCode.replace(/"/g, '\\"')
  execAsync(`hyprctl repl "${safeCode}"`)
}

// ─── ESTADOS REACTIVOS HYPRLAND ───

// 1. Desenfoque y Vidrio
export const [blurEnabled, setBlurEnabled] = createState<boolean>(true)
export const [blurSize, setBlurSize] = createState<number>(4) // 1 - 16
export const [blurPasses, setBlurPasses] = createState<number>(4) // 1 - 6
export const [blurVibrancy, setBlurVibrancy] = createState<number>(0.08) // 0.0 - 1.0

// 2. Ventanas y Espaciado (Gaps & Borders)
export const [gapsIn, setGapsIn] = createState<number>(1) // 0 - 20
export const [gapsOut, setGapsOut] = createState<number>(1) // 0 - 30
export const [borderSize, setBorderSize] = createState<number>(0) // 0 - 6
export const [rounding, setRounding] = createState<number>(10) // 0 - 24
export const [resizeOnBorder, setResizeOnBorder] = createState<boolean>(true)
export const [layoutMode, setLayoutMode] = createState<string>("dwindle") // 'dwindle' | 'master'

// 3. Opacidad, Enfoque y Atenuación (Dimming)
export const [activeOpacity, setActiveOpacity] = createState<number>(0.78) // 0.4 - 1.0
export const [inactiveOpacity, setInactiveOpacity] = createState<number>(0.60) // 0.3 - 1.0
export const [dimInactive, setDimInactive] = createState<boolean>(false)
export const [dimStrength, setDimStrength] = createState<number>(0.3) // 0.1 - 0.8

// 4. Sombras
export const [shadowsEnabled, setShadowsEnabled] = createState<boolean>(false)
export const [shadowRange, setShadowRange] = createState<number>(6) // 2 - 30
export const [shadowRenderPower, setShadowRenderPower] = createState<number>(2) // 1 - 4

// 5. Animaciones & Misceláneo
export const [animationsEnabled, setAnimationsEnabled] = createState<boolean>(true)
export const [animationProfile, setAnimationProfile] = createState<string>("smooth") // 'smooth' | 'snappy' | 'instant'
export const [disableHyprlandLogo, setDisableHyprlandLogo] = createState<boolean>(false)

// 6. Input & Ratón / Cursor
export const [mouseSensitivity, setMouseSensitivity] = createState<number>(0.0) // -1.0 a 1.0
export const [naturalScroll, setNaturalScroll] = createState<boolean>(false)
export const [cursorInactiveTimeout, setCursorInactiveTimeout] = createState<number>(0) // 0 - 30s

// 7. Modo Rendimiento (Batería / Gaming)
export const [performanceMode, setPerformanceMode] = createState<boolean>(false)

// ─── INICIALIZAR VALORES DESDE HYPRLAND ───
export async function loadInitialSettings() {
  try {
    // Aplicar desenfoque de capa (blur & ignorezero) en Hyprland para todas las ventanas de AGS
    hyprLua(`
      local ags_layers = { "hyprland-settings", "settings-window", "control-center", "clipboard-window", "gemini-chat", "bar", "notifications", "notification-popups", "rofi" }
      for _, layer in ipairs(ags_layers) do
        hl.layer_rule({ match = { namespace = layer }, blur = true })
        hl.layer_rule({ match = { namespace = layer }, ignorezero = true })
      end
    `)

    const [
      blurRes, blurSzRes, blurPsRes,
      gapsInRes, gapsOutRes, borderRes, roundRes, resizeRes, layoutRes,
      opacActiveRes, opacInactiveRes, dimInactRes, dimStrRes,
      shadowRes, shadowRgRes, shadowPwRes,
      animRes, logoRes,
      sensRes, natScrollRes, cursorInactRes
    ] = await Promise.all([
      execAsync("hyprctl getoption decoration:blur:enabled"),
      execAsync("hyprctl getoption decoration:blur:size"),
      execAsync("hyprctl getoption decoration:blur:passes"),
      execAsync("hyprctl getoption general:gaps_in"),
      execAsync("hyprctl getoption general:gaps_out"),
      execAsync("hyprctl getoption general:border_size"),
      execAsync("hyprctl getoption decoration:rounding"),
      execAsync("hyprctl getoption general:resize_on_border"),
      execAsync("hyprctl getoption general:layout"),
      execAsync("hyprctl getoption decoration:active_opacity"),
      execAsync("hyprctl getoption decoration:inactive_opacity"),
      execAsync("hyprctl getoption decoration:dim_inactive"),
      execAsync("hyprctl getoption decoration:dim_strength"),
      execAsync("hyprctl getoption decoration:shadow:enabled"),
      execAsync("hyprctl getoption decoration:shadow:range"),
      execAsync("hyprctl getoption decoration:shadow:render_power"),
      execAsync("hyprctl getoption animations:enabled"),
      execAsync("hyprctl getoption misc:disable_hyprland_logo"),
      execAsync("hyprctl getoption input:sensitivity"),
      execAsync("hyprctl getoption input:touchpad:natural_scroll"),
      execAsync("hyprctl getoption cursor:inactive_timeout"),
    ])

    if (blurRes) setBlurEnabled(blurRes.includes("int: 1") || blurRes.includes("bool: true"))
    if (blurSzRes) {
      const m = blurSzRes.match(/int:\s+([0-9]+)/)
      if (m) setBlurSize(parseInt(m[1]))
    }
    if (blurPsRes) {
      const m = blurPsRes.match(/int:\s+([0-9]+)/)
      if (m) setBlurPasses(parseInt(m[1]))
    }

    if (gapsInRes) {
      const m = gapsInRes.match(/custom:\s+([0-9]+)/) || gapsInRes.match(/int:\s+([0-9]+)/)
      if (m) setGapsIn(parseInt(m[1]))
    }
    if (gapsOutRes) {
      const m = gapsOutRes.match(/custom:\s+([0-9]+)/) || gapsOutRes.match(/int:\s+([0-9]+)/)
      if (m) setGapsOut(parseInt(m[1]))
    }
    if (borderRes) {
      const m = borderRes.match(/int:\s+([0-9]+)/)
      if (m) setBorderSize(parseInt(m[1]))
    }
    if (roundRes) {
      const m = roundRes.match(/int:\s+([0-9]+)/)
      if (m) setRounding(parseInt(m[1]))
    }
    if (resizeRes) setResizeOnBorder(resizeRes.includes("int: 1") || resizeRes.includes("bool: true"))
    if (layoutRes) {
      const m = layoutRes.match(/str:\s+([a-zA-Z0-9_-]+)/)
      if (m) setLayoutMode(m[1].trim())
    }

    if (opacActiveRes) {
      const m = opacActiveRes.match(/float:\s+([0-9.]+)/)
      if (m) setActiveOpacity(parseFloat(m[1]))
    }
    if (opacInactiveRes) {
      const m = opacInactiveRes.match(/float:\s+([0-9.]+)/)
      if (m) setInactiveOpacity(parseFloat(m[1]))
    }
    if (dimInactRes) setDimInactive(dimInactRes.includes("int: 1") || dimInactRes.includes("bool: true"))
    if (dimStrRes) {
      const m = dimStrRes.match(/float:\s+([0-9.]+)/)
      if (m) setDimStrength(parseFloat(m[1]))
    }

    if (shadowRes) setShadowsEnabled(shadowRes.includes("int: 1") || shadowRes.includes("bool: true"))
    if (shadowRgRes) {
      const m = shadowRgRes.match(/int:\s+([0-9]+)/)
      if (m) setShadowRange(parseInt(m[1]))
    }
    if (shadowPwRes) {
      const m = shadowPwRes.match(/int:\s+([0-9]+)/)
      if (m) setShadowRenderPower(parseInt(m[1]))
    }

    if (animRes) setAnimationsEnabled(animRes.includes("int: 1") || animRes.includes("bool: true"))
    if (logoRes) setDisableHyprlandLogo(logoRes.includes("int: 1") || logoRes.includes("bool: true"))

    if (sensRes) {
      const m = sensRes.match(/float:\s+([0-9.-]+)/)
      if (m) setMouseSensitivity(parseFloat(m[1]))
    }
    if (natScrollRes) setNaturalScroll(natScrollRes.includes("int: 1") || natScrollRes.includes("bool: true"))
    if (cursorInactRes) {
      const m = cursorInactRes.match(/float:\s+([0-9.]+)/) || cursorInactRes.match(/int:\s+([0-9]+)/)
      if (m) setCursorInactiveTimeout(Math.round(parseFloat(m[1])))
    }

  } catch (e) {
    print(`[HyprSettings] Error loading initial options: ${e}`)
  }
}

// ─── ACCIONES DE ACTUALIZACIÓN EN VIVO ───

// Blur
export function setBlur(active: boolean) {
  if (blurEnabled.get() === active) return
  setBlurEnabled(active)
  hyprLua(`hl.config({ decoration = { blur = { enabled = ${active} } } })`)
}

export function updateBlurSize(val: number) {
  const rounded = Math.round(val)
  if (blurSize.get() === rounded) return
  setBlurSize(rounded)
  hyprLua(`hl.config({ decoration = { blur = { size = ${rounded} } } })`)
}

export function updateBlurPasses(val: number) {
  const rounded = Math.round(val)
  if (blurPasses.get() === rounded) return
  setBlurPasses(rounded)
  hyprLua(`hl.config({ decoration = { blur = { passes = ${rounded} } } })`)
}

export function updateBlurVibrancy(val: number) {
  const rounded = parseFloat(val.toFixed(2))
  if (blurVibrancy.get() === rounded) return
  setBlurVibrancy(rounded)
  hyprLua(`hl.config({ decoration = { blur = { vibrancy = ${rounded} } } })`)
}

// Gaps & Bordes
export function updateGapsIn(val: number) {
  const rounded = Math.round(val)
  if (gapsIn.get() === rounded) return
  setGapsIn(rounded)
  hyprLua(`hl.config({ general = { gaps_in = ${rounded} } })`)
}

export function updateGapsOut(val: number) {
  const rounded = Math.round(val)
  if (gapsOut.get() === rounded) return
  setGapsOut(rounded)
  hyprLua(`hl.config({ general = { gaps_out = ${rounded} } })`)
}

export function updateBorderSize(val: number) {
  const rounded = Math.round(val)
  if (borderSize.get() === rounded) return
  setBorderSize(rounded)
  hyprLua(`hl.config({ general = { border_size = ${rounded} } })`)
}

export function updateRounding(val: number) {
  const rounded = Math.round(val)
  if (rounding.get() === rounded) return
  setRounding(rounded)
  hyprLua(`hl.config({ decoration = { rounding = ${rounded} } })`)
}

export function setResizeBorder(active: boolean) {
  if (resizeOnBorder.get() === active) return
  setResizeOnBorder(active)
  hyprLua(`hl.config({ general = { resize_on_border = ${active} } })`)
}

export function setLayout(mode: string) {
  if (layoutMode.get() === mode) return
  setLayoutMode(mode)
  hyprLua(`hl.config({ general = { layout = "${mode}" } })`)
}

// Opacidad y Atenuación (Dimming)
export function updateActiveOpacity(val: number) {
  const rounded = parseFloat(val.toFixed(2))
  if (activeOpacity.get() === rounded) return
  setActiveOpacity(rounded)
  hyprLua(`hl.config({ decoration = { active_opacity = ${rounded} } })`)
}

export function updateInactiveOpacity(val: number) {
  const rounded = parseFloat(val.toFixed(2))
  if (inactiveOpacity.get() === rounded) return
  setInactiveOpacity(rounded)
  hyprLua(`hl.config({ decoration = { inactive_opacity = ${rounded} } })`)
}

export function setDim(active: boolean) {
  if (dimInactive.get() === active) return
  setDimInactive(active)
  hyprLua(`hl.config({ decoration = { dim_inactive = ${active} } })`)
}

export function updateDimStrength(val: number) {
  const rounded = parseFloat(val.toFixed(2))
  if (dimStrength.get() === rounded) return
  setDimStrength(rounded)
  hyprLua(`hl.config({ decoration = { dim_strength = ${rounded} } })`)
}

// Sombras
export function setShadows(active: boolean) {
  if (shadowsEnabled.get() === active) return
  setShadowsEnabled(active)
  hyprLua(`hl.config({ decoration = { shadow = { enabled = ${active} } } })`)
}

export function updateShadowRange(val: number) {
  const rounded = Math.round(val)
  if (shadowRange.get() === rounded) return
  setShadowRange(rounded)
  hyprLua(`hl.config({ decoration = { shadow = { range = ${rounded} } } })`)
}

export function updateShadowRenderPower(val: number) {
  const rounded = Math.round(val)
  if (shadowRenderPower.get() === rounded) return
  setShadowRenderPower(rounded)
  hyprLua(`hl.config({ decoration = { shadow = { render_power = ${rounded} } } })`)
}

// Animaciones & Misceláneo
export function setAnimations(active: boolean) {
  if (animationsEnabled.get() === active) return
  setAnimationsEnabled(active)
  hyprLua(`hl.config({ animations = { enabled = ${active} } })`)
}

export function setLogoDisabled(active: boolean) {
  if (disableHyprlandLogo.get() === active) return
  setDisableHyprlandLogo(active)
  hyprLua(`hl.config({ misc = { disable_hyprland_logo = ${active} } })`)
}

export function setAnimProfile(profile: string) {
  setAnimationProfile(profile)
  if (profile === "instant") {
    hyprLua(`hl.config({ animations = { enabled = false } })`)
    setAnimationsEnabled(false)
  } else if (profile === "snappy") {
    hyprLua(`hl.config({ animations = { enabled = true, bezier = "snappy, 0.05, 0.9, 0.1, 1.05", animation = { "windows, 1, 3, snappy", "workspaces, 1, 3, snappy" } } })`)
    setAnimationsEnabled(true)
  } else {
    // smooth
    hyprLua(`hl.config({ animations = { enabled = true, bezier = "smooth, 0.25, 1, 0.5, 1", animation = { "windows, 1, 5, smooth", "workspaces, 1, 5, smooth" } } })`)
    setAnimationsEnabled(true)
  }
}

// Input & Ratón
export function updateMouseSensitivity(val: number) {
  const rounded = parseFloat(val.toFixed(2))
  if (mouseSensitivity.get() === rounded) return
  setMouseSensitivity(rounded)
  hyprLua(`hl.config({ input = { sensitivity = ${rounded} } })`)
}

export function setNatScroll(active: boolean) {
  if (naturalScroll.get() === active) return
  setNaturalScroll(active)
  hyprLua(`hl.config({ input = { touchpad = { natural_scroll = ${active} } } })`)
}

export function updateCursorTimeout(val: number) {
  const rounded = Math.round(val)
  if (cursorInactiveTimeout.get() === rounded) return
  setCursorInactiveTimeout(rounded)
  hyprLua(`hl.config({ cursor = { inactive_timeout = ${rounded} } })`)
}

// ─── ACCIONES DE SISTEMA ───
export function reloadHyprland() {
  execAsync("hyprctl reload")
}

export function killActiveClient() {
  execAsync("hyprctl kill")
}

export function togglePerformanceMode() {
  const next = !performanceMode.get()
  setPerformanceMode(next)
  if (next) {
    // Activar modo ultra-rendimiento: quitar blur, sombras y animaciones
    setBlur(false)
    setShadows(false)
    setAnimations(false)
  } else {
    // Restaurar modo visual rico
    applyPresetBlurBalanced()
    applyPresetShadowSoft()
    setAnimations(true)
  }
}

export function resetToDefaults() {
  applyPresetBlurBalanced()
  applyPresetGapsStandard()
  applyPresetOpacityGlass()
  applyPresetShadowSoft()
  setAnimations(true)
  setLayout("dwindle")
  updateRounding(10)
  updateBorderSize(0)
  setDim(false)
  updateMouseSensitivity(0.0)
  setNatScroll(false)
  updateCursorTimeout(0)
}

// ─── PRESETS DE UN TOQUE ───

// Blur
export function applyPresetBlurNone() {
  setBlur(false)
}

export function applyPresetBlurBalanced() {
  setBlur(true)
  updateBlurSize(4)
  updateBlurPasses(4)
}

export function applyPresetBlurGlass() {
  setBlur(true)
  updateBlurSize(8)
  updateBlurPasses(5)
  updateBlurVibrancy(0.18)
}

// Gaps
export function applyPresetGapsNone() {
  updateGapsIn(0)
  updateGapsOut(0)
}

export function applyPresetGapsStandard() {
  updateGapsIn(1)
  updateGapsOut(1)
}

export function applyPresetGapsFloat() {
  updateGapsIn(6)
  updateGapsOut(12)
}

// Opacity
export function applyPresetOpacityGlass() {
  updateActiveOpacity(0.78)
  updateInactiveOpacity(0.60)
}

export function applyPresetOpacitySolid() {
  updateActiveOpacity(1.0)
  updateInactiveOpacity(0.92)
}

// Shadows
export function applyPresetShadowSoft() {
  setShadows(true)
  updateShadowRange(8)
  updateShadowRenderPower(2)
}

export function applyPresetShadowDeep() {
  setShadows(true)
  updateShadowRange(18)
  updateShadowRenderPower(3)
}

export function applyPresetShadowNone() {
  setShadows(false)
}

// Cargar ajustes al inicio
loadInitialSettings()
