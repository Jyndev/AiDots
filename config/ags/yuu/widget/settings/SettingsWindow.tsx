import { Astal, Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"
import { createState } from "ags"
import GLib from "gi://GLib"
import {
  // Blur
  blurEnabled,
  setBlur,
  blurSize,
  updateBlurSize,
  blurPasses,
  updateBlurPasses,
  blurVibrancy,
  updateBlurVibrancy,
  applyPresetBlurNone,
  applyPresetBlurBalanced,
  applyPresetBlurGlass,

  // Gaps, Bordes & Layout
  gapsIn,
  updateGapsIn,
  gapsOut,
  updateGapsOut,
  borderSize,
  updateBorderSize,
  rounding,
  updateRounding,
  resizeOnBorder,
  setResizeBorder,
  layoutMode,
  setLayout,
  applyPresetGapsNone,
  applyPresetGapsStandard,
  applyPresetGapsFloat,

  // Opacidad & Dimming
  activeOpacity,
  updateActiveOpacity,
  inactiveOpacity,
  updateInactiveOpacity,
  dimInactive,
  setDim,
  dimStrength,
  updateDimStrength,
  applyPresetOpacityGlass,
  applyPresetOpacitySolid,

  // Sombras
  shadowsEnabled,
  setShadows,
  shadowRange,
  updateShadowRange,
  shadowRenderPower,
  updateShadowRenderPower,
  applyPresetShadowNone,
  applyPresetShadowSoft,
  applyPresetShadowDeep,

  // Animaciones & Rendimiento
  animationsEnabled,
  setAnimations,
  animationProfile,
  setAnimProfile,
  disableHyprlandLogo,
  setLogoDisabled,

  // Input & Ratón
  mouseSensitivity,
  updateMouseSensitivity,
  naturalScroll,
  setNatScroll,
  cursorInactiveTimeout,
  updateCursorTimeout,

  // Acciones de Sistema
  performanceMode,
  togglePerformanceMode,
  reloadHyprland,
  killActiveClient,
  resetToDefaults,
} from "../../services/hyprlandSettings"
import {
  mprisLyricsEnabled,
  setMprisLyricsEnabled,
  getWidgetThemeClass,
} from "../../services/themeSettings"

const windows: Record<string, Gtk.Window> = {}

export function toggleSettingsWindow(gdkmonitor?: Gdk.Monitor) {
  const mon = gdkmonitor || app.get_monitors()[0]
  const id = mon ? String(mon.description || mon.connector || "default") : "default"
  const win = windows[id]
  if (win) {
    win.visible = !win.visible
    if (win.visible) win.present()
  }
}

// ─── HELPER: EVITAR QUE EL SCROLL DE LA RUEDA ALTERE EL SLIDER ───
// En GTK4, Astal.Slider incluye por defecto un Gtk.EventControllerScroll.
// Al eliminarlo, el scroll se propaga naturalmente al contenedor ScrolledWindow
// sin alterar el valor del slider al pasar el cursor por encima.
function preventSliderScroll(slider: any) {
  try {
    const list = slider.observe_controllers()
    for (let i = 0; i < list.get_n_items(); i++) {
      const c = list.get_item(i)
      if (c instanceof Gtk.EventControllerScroll) {
        slider.remove_controller(c)
        break
      }
    }
  } catch (e) {
    print(`[preventSliderScroll] error: ${e}`)
  }
}

// ─── HELPER: SCROLL SUAVE CON INTERPOLACIÓN FLUIDA (BUTTER-SMOOTH KINETIC) ───
function enableSmoothScroll(scrolled: any) {
  try {
    const adj = scrolled.get_vadjustment()
    let target = adj.get_value()
    let animId: any = null

    const ctrl = new Gtk.EventControllerScroll()
    ctrl.set_flags(Gtk.EventControllerScrollFlags.VERTICAL)

    ctrl.connect("scroll", (_c, _dx, dy) => {
      const min = adj.get_lower()
      const max = Math.max(min, adj.get_upper() - adj.get_page_size())
      if (max <= min) return false

      if (animId === null) {
        target = adj.get_value()
      }

      // Desplazamiento progresivo suave: 50px por notch
      target = Math.max(min, Math.min(max, target + dy * 50))

      if (animId === null) {
        animId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
          const current = adj.get_value()
          const diff = target - current
          if (Math.abs(diff) < 0.6) {
            adj.set_value(target)
            animId = null
            return false // Detener animación
          }
          adj.set_value(current + diff * 0.20) // Interpolación exponencial suave continua
          return true
        })
      }
      return true
    })

    scrolled.add_controller(ctrl)
  } catch (e) {
    print(`[enableSmoothScroll] error: ${e}`)
  }
}

export default function SettingsWindow(gdkmonitor: Gdk.Monitor) {
  const { TOP, BOTTOM, LEFT } = Astal.WindowAnchor

  // Estado unificado reactivo para navegación y búsqueda
  const [nav, setNav] = createState({ tab: 0, query: "" })
  const setTab = (t: number) => setNav({ tab: t, query: nav.get().query })
  const setQuery = (q: string) => setNav({ tab: nav.get().tab, query: q })

  const tabs = [
    { id: 0, label: "Efectos", icon: "custom-blur-symbolic" },
    { id: 1, label: "Ventanas", icon: "custom-layout-symbolic" },
    { id: 2, label: "Animación", icon: "custom-anim-symbolic" },
    { id: 3, label: "Entrada", icon: "custom-sliders-symbolic" },
    { id: 4, label: "Sistema", icon: "custom-flame-symbolic" },
  ]

  const win = (
    <window
      visible={false}
      name="settings-window"
      namespace="hyprland-settings"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | BOTTOM | LEFT}
      application={app}
      margin_top={8}
      margin_left={10}
      margin_bottom={8}
      keymode={Astal.Keymode.ON_DEMAND}
      $={(self) => {
        const id = String(gdkmonitor.description || gdkmonitor.connector || "default")
        windows[id] = self
      }}
    >
      <box
        orientation={Gtk.Orientation.VERTICAL}
        class={getWidgetThemeClass("settings-window-card")}
        spacing={8}
        vexpand
      >
        {/* ── 1. CABECERA MODERNA CON ACCIÓN DE CIERRE ── */}
        <box class="settings-header-box" halign={Gtk.Align.FILL} valign={Gtk.Align.CENTER}>
          <box orientation={Gtk.Orientation.VERTICAL} hexpand spacing={0}>
            <box spacing={6} valign={Gtk.Align.CENTER}>
              <image iconName="custom-paw-print" class="header-badge-paw" />
              <label label="Configuración Hyprland" class="settings-title" halign={Gtk.Align.START} />
            </box>
            <label
              label="Ajustes dinámicos en tiempo real"
              class="settings-subtitle"
              halign={Gtk.Align.START}
            />
          </box>

          {/* Botón de Recarga Rápida de Config */}
          <button
            class="settings-action-icon-btn"
            tooltipText="Recargar Hyprland (hyprctl reload)"
            onClicked={reloadHyprland}
          >
            <label label="↺" />
          </button>

          {/* Botón Cerrar */}
          <button
            class="settings-close-btn"
            tooltipText="Cerrar panel"
            onClicked={() => {
              ;(win as any).visible = false
            }}
          >
            <label label="✕" />
          </button>
        </box>

        {/* ── 2. BUSCADOR COMPACTO ── */}
        <box class="settings-search-pill" spacing={8} valign={Gtk.Align.CENTER}>
          <entry
            hexpand
            class="settings-search-input"
            placeholderText="Buscar ajuste (blur, gaps, sombras, mouse...)"
            onNotifyText={(self) => {
              setQuery(self.text || "")
            }}
          />
          <image iconName="custom-search-symbolic" class="search-icon" />
        </box>

        {/* ── 3. SELECTOR DE PESTAÑAS (SEGMENTED TABS) ── */}
        {/* Oculto automáticamente cuando hay búsqueda activa */}
        <box
          class="settings-tabs-container"
          spacing={4}
          halign={Gtk.Align.FILL}
          visible={nav(({ query }) => !query || query.trim() === "")}
        >
          {tabs.map((tab) => (
            <button
              hexpand
              class={nav(({ tab: curr }) => `settings-tab-btn ${curr === tab.id ? "active" : ""}`)}
              onClicked={() => setTab(tab.id)}
              tooltipText={tab.label}
            >
              <box spacing={4} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                <image iconName={tab.icon} class="tab-icon" />
                <label label={tab.label} class="tab-label" />
              </box>
            </button>
          ))}
        </box>

        {/* ── 4. ÁREA DE CONTENIDO SCROLLEABLE ── */}
        <scrolledwindow
          class="settings-scroll-view"
          hscrollbarPolicy={Gtk.PolicyType.NEVER}
          vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
          vexpand
          $={(self) => {
            enableSmoothScroll(self)
          }}
        >
          <box orientation={Gtk.Orientation.VERTICAL} spacing={8} class="settings-flow">

            {/* ══════════════════════════════════════════════════════════════
                SECCIÓN 1: EFECTOS & DECORACIÓN (TAB 0)
               ══════════════════════════════════════════════════════════════ */}

            {/* TARJETA 1.0: REPRODUCTOR & LETRAS DE MÚSICA */}
            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="settings-card"
              spacing={5}
              visible={nav(({ tab, query }) => {
                const q = query.trim().toLowerCase()
                if (q) return "letras lyrics reproductor mpris musica sptlrx spotify".includes(q)
                return tab === 0
              })}
            >
              <box spacing={6} valign={Gtk.Align.CENTER} class="card-header-compact">
                <box class="section-badge-icon" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <image iconName="custom-music-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </box>
                <label label="Reproductor & Letras de Música" class="section-title" hexpand halign={Gtk.Align.START} />
              </box>

              {/* Letras sincronizadas en el reproductor MPRIS */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                  <label label="Letras sincronizadas en tiempo real" class="row-label" halign={Gtk.Align.START} />
                  <label label="Mostrar letras en tiempo real (sptlrx) en el widget de música" class="row-sublabel" halign={Gtk.Align.START} />
                </box>
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={mprisLyricsEnabled}
                  onNotifyActive={(self) => setMprisLyricsEnabled(self.active)}
                />
              </box>
            </box>

            {/* TARJETA 1.1: DESENFOQUE & VIDRIO */}
            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="settings-card"
              spacing={5}
              visible={nav(({ tab, query }) => {
                const q = query.trim().toLowerCase()
                if (q) return "desenfoque blur vidrio glass pasadas radio vivacidad vibrancy".includes(q)
                return tab === 0
              })}
            >
              <box spacing={6} valign={Gtk.Align.CENTER} class="card-header-compact">
                <box class="section-badge-icon" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <image iconName="custom-blur-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </box>
                <label label="Desenfoque & Vidrio (Blur)" class="section-title" hexpand halign={Gtk.Align.START} />

                <box spacing={3} class="preset-pill-group" valign={Gtk.Align.CENTER}>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetBlurNone} tooltipText="Desactivar">
                    <label label="Off" />
                  </button>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetBlurBalanced} tooltipText="Equilibrado">
                    <label label="Suave" />
                  </button>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetBlurGlass} tooltipText="Vidrio translúcido">
                    <label label="Glass" />
                  </button>
                </box>
              </box>

              {/* Toggle Activar Blur */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <label label="Habilitar efecto Blur" class="row-label" hexpand halign={Gtk.Align.START} />
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={blurEnabled}
                  onNotifyActive={(self) => setBlur(self.active)}
                />
              </box>

              {/* Sliders emparejados: Radio y Pasadas */}
              <box spacing={8} class="setting-dual-row">
                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Radio (Size)" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={blurSize((sz) => `${sz}px`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={blurSize((sz) => (sz - 1) / 15)}
                    onChangeValue={({ value }) => updateBlurSize(Math.round(value * 15 + 1))}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>

                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Pasadas (Passes)" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={blurPasses((p) => `${p}`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={blurPasses((p) => (p - 1) / 5)}
                    onChangeValue={({ value }) => updateBlurPasses(Math.round(value * 5 + 1))}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>
              </box>

              {/* Vivacidad */}
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} class="setting-single-col">
                <box spacing={4} valign={Gtk.Align.CENTER}>
                  <label label="Vivacidad de color (Vibrancy)" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                  <box class="setting-value-badge">
                    <label label={blurVibrancy((v) => `${Math.round(v * 100)}%`)} class="value-text" />
                  </box>
                </box>
                <slider
                  orientation={Gtk.Orientation.HORIZONTAL}
                  value={blurVibrancy}
                  onChangeValue={({ value }) => updateBlurVibrancy(value)}
                  $={(self) => {
                    self.get_style_context().add_class("astal-slider")
                    preventSliderScroll(self)
                  }}
                />
              </box>
            </box>

            {/* TARJETA 1.2: OPACIDAD Y ATENUACIÓN DE INACTIVAS */}
            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="settings-card"
              spacing={5}
              visible={nav(({ tab, query }) => {
                const q = query.trim().toLowerCase()
                if (q) return "opacidad transparencia activa inactiva dim atenuacion foco".includes(q)
                return tab === 0
              })}
            >
              <box spacing={6} valign={Gtk.Align.CENTER} class="card-header-compact">
                <box class="section-badge-icon" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <image iconName="custom-opacity-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </box>
                <label label="Opacidad & Foco" class="section-title" hexpand halign={Gtk.Align.START} />

                <box spacing={3} class="preset-pill-group" valign={Gtk.Align.CENTER}>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetOpacityGlass} tooltipText="Translúcido">
                    <label label="Glass" />
                  </button>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetOpacitySolid} tooltipText="Sólido">
                    <label label="Sólido" />
                  </button>
                </box>
              </box>

              {/* Sliders emparejados: Opacidad Activa e Inactiva */}
              <box spacing={8} class="setting-dual-row">
                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Ventana Activa" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={activeOpacity((o) => `${Math.round(o * 100)}%`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={activeOpacity((o) => (o - 0.4) / 0.6)}
                    onChangeValue={({ value }) => updateActiveOpacity(value * 0.6 + 0.4)}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>

                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="En segundo plano" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={inactiveOpacity((o) => `${Math.round(o * 100)}%`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={inactiveOpacity((o) => (o - 0.3) / 0.7)}
                    onChangeValue={({ value }) => updateInactiveOpacity(value * 0.7 + 0.3)}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>
              </box>

              {/* Dim Inactive Windows (Atenuación inteligente) */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                  <label label="Atenuar fondo (Dim Inactive)" class="row-label" halign={Gtk.Align.START} />
                  <label label="Oscurece ventanas sin foco para resaltar la actual" class="row-sublabel" halign={Gtk.Align.START} />
                </box>
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={dimInactive}
                  onNotifyActive={(self) => setDim(self.active)}
                />
              </box>

              {/* Intensidad de Dimming (visible si está activo) */}
              <box
                orientation={Gtk.Orientation.VERTICAL}
                spacing={2}
                class="setting-single-col"
                visible={dimInactive}
              >
                <box spacing={4} valign={Gtk.Align.CENTER}>
                  <label label="Fuerza de atenuación" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                  <box class="setting-value-badge">
                    <label label={dimStrength((s) => `${Math.round(s * 100)}%`)} class="value-text" />
                  </box>
                </box>
                <slider
                  orientation={Gtk.Orientation.HORIZONTAL}
                  value={dimStrength((s) => (s - 0.1) / 0.7)}
                  onChangeValue={({ value }) => updateDimStrength(value * 0.7 + 0.1)}
                  $={(self) => {
                    self.get_style_context().add_class("astal-slider")
                    preventSliderScroll(self)
                  }}
                />
              </box>
            </box>

            {/* TARJETA 1.3: SOMBRAS */}
            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="settings-card"
              spacing={5}
              visible={nav(({ tab, query }) => {
                const q = query.trim().toLowerCase()
                if (q) return "sombras shadow relieve profundidad potencia radio".includes(q)
                return tab === 0
              })}
            >
              <box spacing={6} valign={Gtk.Align.CENTER} class="card-header-compact">
                <box class="section-badge-icon" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <image iconName="custom-shadow-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </box>
                <label label="Sombras de Ventanas" class="section-title" hexpand halign={Gtk.Align.START} />

                <box spacing={3} class="preset-pill-group" valign={Gtk.Align.CENTER}>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetShadowNone} tooltipText="Sin sombras">
                    <label label="Off" />
                  </button>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetShadowSoft} tooltipText="Suave">
                    <label label="Suave" />
                  </button>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetShadowDeep} tooltipText="Profunda">
                    <label label="Glow" />
                  </button>
                </box>
              </box>

              {/* Switch Sombras */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <label label="Activar sombras" class="row-label" hexpand halign={Gtk.Align.START} />
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={shadowsEnabled}
                  onNotifyActive={(self) => setShadows(self.active)}
                />
              </box>

              {/* Sliders emparejados: Rango y Render Power */}
              <box spacing={8} class="setting-dual-row" visible={shadowsEnabled}>
                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Radio (Range)" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={shadowRange((r) => `${r}px`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={shadowRange((r) => (r - 2) / 28)}
                    onChangeValue={({ value }) => updateShadowRange(Math.round(value * 28 + 2))}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>

                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Potencia (Power)" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={shadowRenderPower((p) => `${p}`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={shadowRenderPower((p) => (p - 1) / 3)}
                    onChangeValue={({ value }) => updateShadowRenderPower(Math.round(value * 3 + 1))}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>
              </box>
            </box>


            {/* ══════════════════════════════════════════════════════════════
                SECCIÓN 2: VENTANAS, BORDES & DISTRIBUCIÓN (TAB 1)
               ══════════════════════════════════════════════════════════════ */}

            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="settings-card"
              spacing={5}
              visible={nav(({ tab, query }) => {
                const q = query.trim().toLowerCase()
                if (q) return "gaps espaciado bordes esquinas redondeo separation border rounding ventanas layout dwindle master".includes(q)
                return tab === 1
              })}
            >
              <box spacing={6} valign={Gtk.Align.CENTER} class="card-header-compact">
                <box class="section-badge-icon" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <image iconName="custom-layout-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </box>
                <label label="Espaciado & Bordes" class="section-title" hexpand halign={Gtk.Align.START} />

                <box spacing={3} class="preset-pill-group" valign={Gtk.Align.CENTER}>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetGapsNone} tooltipText="Sin separación">
                    <label label="0px" />
                  </button>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetGapsStandard} tooltipText="Estándar 1px">
                    <label label="1px" />
                  </button>
                  <button class="preset-pill" valign={Gtk.Align.CENTER} onClicked={applyPresetGapsFloat} tooltipText="Flotante amplio">
                    <label label="Float" />
                  </button>
                </box>
              </box>

              {/* Sliders emparejados: Gaps In y Gaps Out */}
              <box spacing={8} class="setting-dual-row">
                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Gaps In (Interno)" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={gapsIn((g) => `${g}px`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={gapsIn((g) => g / 20)}
                    onChangeValue={({ value }) => updateGapsIn(Math.round(value * 20))}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>

                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Gaps Out (Externo)" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={gapsOut((g) => `${g}px`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={gapsOut((g) => g / 30)}
                    onChangeValue={({ value }) => updateGapsOut(Math.round(value * 30))}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>
              </box>

              {/* Sliders emparejados: Redondeo (Rounding) y Grosor de Borde */}
              <box spacing={8} class="setting-dual-row">
                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Curvatura (Rounding)" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={rounding((r) => `${r}px`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={rounding((r) => r / 24)}
                    onChangeValue={({ value }) => updateRounding(Math.round(value * 24))}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>

                <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand class="setting-half-col">
                  <box spacing={4} valign={Gtk.Align.CENTER}>
                    <label label="Grosor de Borde" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                    <box class="setting-value-badge">
                      <label label={borderSize((b) => `${b}px`)} class="value-text" />
                    </box>
                  </box>
                  <slider
                    orientation={Gtk.Orientation.HORIZONTAL}
                    value={borderSize((b) => b / 6)}
                    onChangeValue={({ value }) => updateBorderSize(Math.round(value * 6))}
                    $={(self) => {
                      self.get_style_context().add_class("astal-slider")
                      preventSliderScroll(self)
                    }}
                  />
                </box>
              </box>

              {/* Modo de Layout Hyprland (Dwindle vs Master) */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                  <label label="Modo de Organización (Layout)" class="row-label" halign={Gtk.Align.START} />
                  <label label="Espiral dinámica (Dwindle) o Columna maestra (Master)" class="row-sublabel" halign={Gtk.Align.START} />
                </box>
                <box spacing={3} class="segmented-selector" valign={Gtk.Align.CENTER}>
                  <button
                    class={layoutMode((m) => `segment-btn ${m === "dwindle" ? "selected" : ""}`)}
                    valign={Gtk.Align.CENTER}
                    onClicked={() => setLayout("dwindle")}
                  >
                    <label label="Dwindle" />
                  </button>
                  <button
                    class={layoutMode((m) => `segment-btn ${m === "master" ? "selected" : ""}`)}
                    valign={Gtk.Align.CENTER}
                    onClicked={() => setLayout("master")}
                  >
                    <label label="Master" />
                  </button>
                </box>
              </box>

              {/* Redimensionar arrastrando el borde */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <label label="Arrastrar bordes para redimensionar" class="row-label" hexpand halign={Gtk.Align.START} />
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={resizeOnBorder}
                  onNotifyActive={(self) => setResizeBorder(self.active)}
                />
              </box>
            </box>


            {/* ══════════════════════════════════════════════════════════════
                SECCIÓN 3: ANIMACIONES & RENDIMIENTO (TAB 2)
               ══════════════════════════════════════════════════════════════ */}

            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="settings-card"
              spacing={5}
              visible={nav(({ tab, query }) => {
                const q = query.trim().toLowerCase()
                if (q) return "animaciones logo hyprland rendimiento fluidez bezier velocidad".includes(q)
                return tab === 2
              })}
            >
              <box spacing={6} valign={Gtk.Align.CENTER} class="card-header-compact">
                <box class="section-badge-icon" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <image iconName="custom-anim-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </box>
                <label label="Animaciones del Sistema" class="section-title" hexpand halign={Gtk.Align.START} />
              </box>

              {/* Switch Animaciones */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <label label="Efectos de movimiento & ventanas" class="row-label" hexpand halign={Gtk.Align.START} />
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={animationsEnabled}
                  onNotifyActive={(self) => setAnimations(self.active)}
                />
              </box>

              {/* Perfil de Curva de Animación */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline" visible={animationsEnabled}>
                <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                  <label label="Perfil de velocidad" class="row-label" halign={Gtk.Align.START} />
                  <label label="Curvas Bezier y rapidez de apertura" class="row-sublabel" halign={Gtk.Align.START} />
                </box>
                <box spacing={3} class="segmented-selector" valign={Gtk.Align.CENTER}>
                  <button
                    class={animationProfile((p) => `segment-btn ${p === "smooth" ? "selected" : ""}`)}
                    valign={Gtk.Align.CENTER}
                    onClicked={() => setAnimProfile("smooth")}
                    tooltipText="Transiciones cinemáticas fluidas"
                  >
                    <label label="Fluido" />
                  </button>
                  <button
                    class={animationProfile((p) => `segment-btn ${p === "snappy" ? "selected" : ""}`)}
                    valign={Gtk.Align.CENTER}
                    onClicked={() => setAnimProfile("snappy")}
                    tooltipText="Respuesta rápida y elástica"
                  >
                    <label label="Snappy" />
                  </button>
                  <button
                    class={animationProfile((p) => `segment-btn ${p === "instant" ? "selected" : ""}`)}
                    valign={Gtk.Align.CENTER}
                    onClicked={() => setAnimProfile("instant")}
                    tooltipText="Apertura inmediata sin retraso"
                  >
                    <label label="Instantáneo" />
                  </button>
                </box>
              </box>

              {/* Ocultar logo */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <label label="Ocultar logo Hyprland de fondo" class="row-label" hexpand halign={Gtk.Align.START} />
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={disableHyprlandLogo}
                  onNotifyActive={(self) => setLogoDisabled(self.active)}
                />
              </box>
            </box>


            {/* ══════════════════════════════════════════════════════════════
                SECCIÓN 4: ENTRADA & RATÓN (INPUT & CURSOR) (TAB 3)
               ══════════════════════════════════════════════════════════════ */}

            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="settings-card"
              spacing={5}
              visible={nav(({ tab, query }) => {
                const q = query.trim().toLowerCase()
                if (q) return "raton mouse cursor sensibilidad scroll natural touchpad input".includes(q)
                return tab === 3
              })}
            >
              <box spacing={6} valign={Gtk.Align.CENTER} class="card-header-compact">
                <box class="section-badge-icon" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <image iconName="custom-sliders-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </box>
                <label label="Ratón & Touchpad" class="section-title" hexpand halign={Gtk.Align.START} />
              </box>

              {/* Sensibilidad del Ratón */}
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} class="setting-single-col">
                <box spacing={4} valign={Gtk.Align.CENTER}>
                  <label label="Sensibilidad del puntero" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                  <box class="setting-value-badge">
                    <label label={mouseSensitivity((s) => `${s > 0 ? "+" : ""}${s.toFixed(2)}`)} class="value-text" />
                  </box>
                </box>
                <slider
                  orientation={Gtk.Orientation.HORIZONTAL}
                  value={mouseSensitivity((s) => (s + 1.0) / 2.0)}
                  onChangeValue={({ value }) => updateMouseSensitivity(value * 2.0 - 1.0)}
                  $={(self) => {
                    self.get_style_context().add_class("astal-slider")
                    preventSliderScroll(self)
                  }}
                />
              </box>

              {/* Desplazamiento Natural (Touchpad) */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                  <label label="Desplazamiento natural (Touchpad)" class="row-label" halign={Gtk.Align.START} />
                  <label label="Invierte la dirección del desplazamiento" class="row-sublabel" halign={Gtk.Align.START} />
                </box>
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={naturalScroll}
                  onNotifyActive={(self) => setNatScroll(self.active)}
                />
              </box>

              {/* Ocultar Cursor tras Inactividad */}
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} class="setting-single-col">
                <box spacing={4} valign={Gtk.Align.CENTER}>
                  <label label="Ocultar cursor tras inactividad" class="row-label-mini" hexpand halign={Gtk.Align.START} />
                  <box class="setting-value-badge">
                    <label
                      label={cursorInactiveTimeout((t) => (t === 0 ? "Nunca" : `${t}s`))}
                      class="value-text"
                    />
                  </box>
                </box>
                <slider
                  orientation={Gtk.Orientation.HORIZONTAL}
                  value={cursorInactiveTimeout((t) => t / 30)}
                  onChangeValue={({ value }) => updateCursorTimeout(Math.round(value * 30))}
                  $={(self) => {
                    self.get_style_context().add_class("astal-slider")
                    preventSliderScroll(self)
                  }}
                />
              </box>
            </box>


            {/* ══════════════════════════════════════════════════════════════
                SECCIÓN 5: ACCIONES DE SISTEMA & UTILIDADES (TAB 4)
               ══════════════════════════════════════════════════════════════ */}

            <box
              orientation={Gtk.Orientation.VERTICAL}
              class="settings-card"
              spacing={5}
              visible={nav(({ tab, query }) => {
                const q = query.trim().toLowerCase()
                if (q) return "sistema acciones utilidades reload recargar matar matar proceso rendimiento gaming bateria reset defaults".includes(q)
                return tab === 4
              })}
            >
              <box spacing={6} valign={Gtk.Align.CENTER} class="card-header-compact">
                <box class="section-badge-icon" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <image iconName="custom-flame-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
                </box>
                <label label="Herramientas & Rendimiento" class="section-title" hexpand halign={Gtk.Align.START} />
              </box>

              {/* Modo Ultra Rendimiento / Batería */}
              <box spacing={8} valign={Gtk.Align.CENTER} class="setting-row-inline">
                <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                  <label label="Modo Máximo FPS / Batería" class="row-label" halign={Gtk.Align.START} />
                  <label label="Apaga blur y sombras para máxima fluidez en juegos" class="row-sublabel" halign={Gtk.Align.START} />
                </box>
                <switch
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.END}
                  active={performanceMode}
                  onNotifyActive={() => togglePerformanceMode()}
                />
              </box>

              {/* Cuadrícula de botones de acción rápida */}
              <box spacing={8} class="setting-dual-row">
                <button
                  hexpand
                  class="action-card-btn primary"
                  onClicked={reloadHyprland}
                  tooltipText="Recarga la configuración de Hyprland desde disco"
                >
                  <box spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                    <label label="🔄" />
                    <label label="Recargar Hyprland" class="btn-text" />
                  </box>
                </button>

                <button
                  hexpand
                  class="action-card-btn danger"
                  onClicked={killActiveClient}
                  tooltipText="Haz clic en una ventana rebelde o congelada para cerrarla"
                >
                  <box spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                    <label label="🎯" />
                    <label label="Matar Ventana" class="btn-text" />
                  </box>
                </button>
              </box>

              {/* Botón de Restaurar a Valores por Defecto */}
              <button
                class="action-card-btn subtle"
                onClicked={() => {
                  resetToDefaults()
                }}
                tooltipText="Restablece los ajustes visuales recomendados de Hyprland"
              >
                <box spacing={6} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                  <label label="⏪" />
                  <label label="Restablecer Valores Recomendados" class="btn-text" />
                </box>
              </button>
            </box>

          </box>
        </scrolledwindow>
      </box>
    </window>
  )

  return win
}
