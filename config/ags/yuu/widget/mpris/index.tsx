import AstalMpris from "gi://AstalMpris"
import { createBinding, createComputed, createEffect, createState, For, type Accessor } from "ags"
import { createSubprocess } from "ags/process"
import { Gtk } from "ags/gtk4"
import { BongoCat } from "../BongoCat"
import { ProgressBar } from "./progressBar"
import { mprisLyricsEnabled } from "../../services/themeSettings"

// Subproceso reactivo de letras sincronizadas mediante sptlrx forzado a Spotify vía configuración
const lyrics = createSubprocess("", "sptlrx -p mpris --config /home/jyndev/.config/ags/yuu/sptlrx.yaml pipe")

/**
 * Widget con animación de deslizamiento vertical (Slide Up) para las letras de Spotify.
 */
function SlidingLyrics({ lyric, title }: { lyric: Accessor<string>; title: Accessor<string> }) {
  const stack = new Gtk.Stack({
    transitionType: Gtk.StackTransitionType.SLIDE_UP,
    transitionDuration: 300,
    halign: Gtk.Align.START,
    valign: Gtk.Align.CENTER,
  })

  const l1 = new Gtk.Label({
    label: "",
    wrap: false,
    lines: 1,
    ellipsize: 3,
    maxWidthChars: 38,
    xalign: 0,
    halign: Gtk.Align.START,
    cssClasses: ["mpris-lyrics"],
  })

  const l2 = new Gtk.Label({
    label: "",
    wrap: false,
    lines: 1,
    ellipsize: 3,
    maxWidthChars: 38,
    xalign: 0,
    halign: Gtk.Align.START,
    cssClasses: ["mpris-lyrics"],
  })

  stack.add_named(l1, "slot1")
  stack.add_named(l2, "slot2")
  stack.set_visible_child_name("slot1")

  let activeSlot = "slot1"
  let lastVerse = ""

  // Reiniciar estado al cambiar de canción
  createEffect(() => {
    title()
    lastVerse = ""
    l1.set_label("")
    l2.set_label("")
    activeSlot = "slot1"
    stack.set_visible_child_name("slot1")
  })

  createEffect(() => {
    const text = lyric()
    const clean = (text ?? "").trim()
    if (!clean) {
      lastVerse = ""
      return
    }
    if (clean === lastVerse) return

    if (!lastVerse) {
      lastVerse = clean
      if (activeSlot === "slot1") {
        l1.set_label(clean)
      } else {
        l2.set_label(clean)
      }
      return
    }

    lastVerse = clean
    if (activeSlot === "slot1") {
      l2.set_label(clean)
      stack.set_visible_child_name("slot2")
      activeSlot = "slot2"
    } else {
      l1.set_label(clean)
      stack.set_visible_child_name("slot1")
      activeSlot = "slot1"
    }
  })

  return stack
}

export default function Mpris() {
  const mpris = AstalMpris.get_default()

  const players = createBinding(mpris, "players")

  const preferredPlayer = players((p) => {
    if (!p || p.length === 0) return []

    // 1. Priorizar Spotify si está reproduciendo
    const spotifyPlaying = p.find((player) => {
      const name = ((player.busName || "") + " " + (player.identity || "")).toLowerCase()
      return name.includes("spotify") && player.playbackStatus === AstalMpris.PlaybackStatus.PLAYING
    })
    if (spotifyPlaying) return [spotifyPlaying]

    // 2. Cualquier reproductor activamente reproduciendo
    const playing = p.find(
      (player) => player.playbackStatus === AstalMpris.PlaybackStatus.PLAYING
    )
    if (playing) return [playing]

    // 3. Spotify aunque esté en pausa
    const spotify = p.find((player) => {
      const name = ((player.busName || "") + " " + (player.identity || "")).toLowerCase()
      return name.includes("spotify")
    })
    if (spotify) return [spotify]

    return [p[0]]
  })

  return (
    <box class="mpris" hexpand={false}>
      <For each={preferredPlayer}>
        {(player) => {
          const position = createBinding(player, "position")
          const isPlaying = createBinding(player, "playbackStatus")((s) => s === AstalMpris.PlaybackStatus.PLAYING)
          const title = createBinding(player, "title")((t) => t || "Sin música")
          const artist = createBinding(player, "artist")((a) => a || "")
          const hasTitle = createBinding(player, "title")((t) => !!t && t !== "Unknown" && t !== "")

          const isSpotify = ((player.busName || "") + " " + (player.identity || "")).toLowerCase().includes("spotify")
          const cleanLyric = createComputed([lyrics], (l) => (l ?? "").trim())
          const hasLyrics = createComputed(
            [cleanLyric, mprisLyricsEnabled],
            (l, enabled) => enabled && isSpotify && l.length > 0
          )

          // Estado reactivo para revelar los controles de acción solo en hover sobre el reproductor
          const [isHovered, setIsHovered] = createState<boolean>(false)

          return (
            <box
              orientation={Gtk.Orientation.VERTICAL}
              $={(self) => {
                const motion = new Gtk.EventControllerMotion()
                motion.connect("enter", () => setIsHovered(true))
                motion.connect("leave", () => setIsHovered(false))
                self.add_controller(motion)
              }}
            >
              <box spacing={12} valign={Gtk.Align.CENTER}>
                {/* El gato aparece siempre que haya una canción detectada */}
                <box visible={hasTitle} valign={Gtk.Align.CENTER}>
                  <BongoCat />
                </box>

                <box
                  orientation={Gtk.Orientation.VERTICAL}
                  halign={Gtk.Align.START}
                  valign={Gtk.Align.CENTER}
                  vexpand={false}
                  spacing={2}
                >
                  {/* Fila 1: Título y (si hay letra) Artista en línea a su lado */}
                  <box spacing={6} valign={Gtk.Align.CENTER} halign={Gtk.Align.START}>
                    <label
                      class="song-title"
                      label={title((t) => {
                        const text = t || "Sin música"
                        return text.length > 22 ? text.substring(0, 22) + "..." : text
                      })}
                      halign={Gtk.Align.START}
                      ellipsize={3}
                    />

                    {/* Si HAY letras, el artista va aquí arriba al lado del título */}
                    <label
                      class="song-artist-inline"
                      label={artist((a) => (a && a !== "Desconocido" ? `• ${a}` : ""))}
                      halign={Gtk.Align.START}
                      ellipsize={3}
                      maxWidthChars={18}
                      visible={hasLyrics}
                    />
                  </box>

                  {/* Fila 2: Letra sincronizada O Artista abajo si NO hay letra */}
                  <box valign={Gtk.Align.CENTER} halign={Gtk.Align.START}>
                    <box visible={hasLyrics} halign={Gtk.Align.START}>
                      <SlidingLyrics lyric={cleanLyric} title={title} />
                    </box>

                    {/* Si NO hay letra, el artista vuelve abajo */}
                    <label
                      class="song-artist"
                      label={artist((a) => (a && a !== "Desconocido" ? a : "Desconocido"))}
                      halign={Gtk.Align.START}
                      ellipsize={3}
                      maxWidthChars={26}
                      visible={hasLyrics((h) => !h)}
                    />
                  </box>

                  {/* Fila 3: Barra de progreso */}
                  <ProgressBar
                    currProgress={position((p) =>
                      player.length > 0 ? p / player.length : 0,
                    )}
                  />
                </box>

                {/* Controles de reproducción: Ocultos por defecto, visibles en Hover */}
                <revealer
                  revealChild={isHovered}
                  transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
                  transitionDuration={250}
                  valign={Gtk.Align.CENTER}
                >
                  <box visible={hasTitle} spacing={0} valign={Gtk.Align.CENTER} class="mpris-controls">
                    <button
                      valign={Gtk.Align.CENTER}
                      tooltipText="Anterior"
                      onClicked={() => player.previous()}
                    >
                      <image iconName="custom-previous-symbolic" />
                    </button>
                    <button
                      valign={Gtk.Align.CENTER}
                      tooltipText={isPlaying((p) => (p ? "Pausar" : "Reproducir"))}
                      onClicked={() => player.play_pause()}
                    >
                      <box>
                        <image
                          iconName="custom-pause-symbolic"
                          visible={isPlaying}
                        />
                        <image
                          iconName="custom-play-symbolic"
                          visible={isPlaying((v) => !v)}
                        />
                      </box>
                    </button>
                    <button
                      valign={Gtk.Align.CENTER}
                      tooltipText="Siguiente"
                      onClicked={() => player.next()}
                    >
                      <image iconName="custom-next-symbolic" />
                    </button>
                  </box>
                </revealer>
              </box>
            </box>
          )
        }}
      </For>
    </box>
  )
}
