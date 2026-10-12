import { createState } from "ags"
import GLib from "gi://GLib"

export interface AgsThemeConfig {
  widgetTransparency: boolean
  barStripesEffect: boolean
  mprisLyricsEnabled: boolean
}

const DEFAULT_CONFIG: AgsThemeConfig = {
  widgetTransparency: false,
  barStripesEffect: false,
  mprisLyricsEnabled: true,
}

const CONFIG_DIR = `${GLib.get_user_config_dir()}/ags/yuu`
const CONFIG_FILE = `${CONFIG_DIR}/theme_settings.json`

function loadConfig(): AgsThemeConfig {
  try {
    if (GLib.file_test(CONFIG_FILE, GLib.FileTest.EXISTS)) {
      const [ok, content] = GLib.file_get_contents(CONFIG_FILE)
      if (ok) {
        const text = new TextDecoder().decode(content)
        const parsed = JSON.parse(text)
        return {
          widgetTransparency:
            typeof parsed.widgetTransparency === "boolean"
              ? parsed.widgetTransparency
              : DEFAULT_CONFIG.widgetTransparency,
          barStripesEffect:
            typeof parsed.barStripesEffect === "boolean"
              ? parsed.barStripesEffect
              : DEFAULT_CONFIG.barStripesEffect,
          mprisLyricsEnabled:
            typeof parsed.mprisLyricsEnabled === "boolean"
              ? parsed.mprisLyricsEnabled
              : DEFAULT_CONFIG.mprisLyricsEnabled,
        }
      }
    }
  } catch (e) {
    print(`[themeSettings] Error loading config: ${e}`)
  }
  return { ...DEFAULT_CONFIG }
}

function saveConfig(cfg: AgsThemeConfig) {
  try {
    if (!GLib.file_test(CONFIG_DIR, GLib.FileTest.IS_DIR)) {
      GLib.mkdir_with_parents(CONFIG_DIR, 0o755)
    }
    const jsonStr = JSON.stringify(cfg, null, 2)
    GLib.file_set_contents(CONFIG_FILE, jsonStr)
  } catch (e) {
    print(`[themeSettings] Error saving config: ${e}`)
  }
}

const initial = loadConfig()

export const [widgetTransparency, setWidgetTransparencyState] = createState<boolean>(initial.widgetTransparency)
export const [barStripesEffect, setBarStripesEffectState] = createState<boolean>(initial.barStripesEffect)
export const [mprisLyricsEnabled, setMprisLyricsEnabledState] = createState<boolean>(initial.mprisLyricsEnabled)

// Estado unificado reactivo plano que emite la combinación de clases
export const [themeClasses, setThemeClasses] = createState<string>(
  `${initial.widgetTransparency ? "translucent" : "solid-widget"} ${initial.barStripesEffect ? "with-stripes" : "no-stripes"}`
)

function updateThemeClasses(trans: boolean, stripes: boolean) {
  const transClass = trans ? "translucent" : "solid-widget"
  const stripeClass = stripes ? "with-stripes" : "no-stripes"
  setThemeClasses(`${transClass} ${stripeClass}`)
}

export function setWidgetTransparency(enabled: boolean) {
  if (widgetTransparency.get() === enabled) return
  setWidgetTransparencyState(enabled)
  updateThemeClasses(enabled, barStripesEffect.get())
  saveConfig({
    widgetTransparency: enabled,
    barStripesEffect: barStripesEffect.get(),
    mprisLyricsEnabled: mprisLyricsEnabled.get(),
  })
}

export function setBarStripesEffect(enabled: boolean) {
  if (barStripesEffect.get() === enabled) return
  setBarStripesEffectState(enabled)
  updateThemeClasses(widgetTransparency.get(), enabled)
  saveConfig({
    widgetTransparency: widgetTransparency.get(),
    barStripesEffect: enabled,
    mprisLyricsEnabled: mprisLyricsEnabled.get(),
  })
}

export function setMprisLyricsEnabled(enabled: boolean) {
  if (mprisLyricsEnabled.get() === enabled) return
  setMprisLyricsEnabledState(enabled)
  saveConfig({
    widgetTransparency: widgetTransparency.get(),
    barStripesEffect: barStripesEffect.get(),
    mprisLyricsEnabled: enabled,
  })
}

/**
 * Generador reactivo de clases CSS para contenedores principales
 */
export function getWidgetThemeClass(baseClass: string) {
  return themeClasses((cls) => `${baseClass} ${cls}`)
}
