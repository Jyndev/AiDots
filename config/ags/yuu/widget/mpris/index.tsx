import AstalMpris from "gi://AstalMpris"
import { createBinding, For, createState } from "ags"
import { Gtk } from "ags/gtk4"
import { BongoCat } from "../BongoCat"
import { ProgressBar } from "./progressBar"

export default function Mpris() {
  const mpris = AstalMpris.get_default()

  const players = createBinding(mpris, "players")

  // Nuevo enlace que solo contiene el reproductor que queremos mostrar
  const preferredPlayer = players((p) => {
    const spotify = p.find(player => 
        player.busName.toLowerCase().includes("spotify") || 
        player.identity.toLowerCase().includes("spotify")
    );
    const active = spotify || p[0];
    return active ? [active] : []; // For necesita un array
  });

  return (
    <box class="mpris" hexpand={false}>
      <For each={preferredPlayer}>
        {(player) => {
          const position = createBinding(player, "position")
          const isPlaying = createBinding(player, "playbackStatus")((s) => s === AstalMpris.PlaybackStatus.PLAYING)
          const hasTitle = createBinding(player, "title")((t) => !!t && t !== "Unknown" && t !== "")
          
          return (
              <box orientation={Gtk.Orientation.VERTICAL}>
                <box spacing={15}>
                  {/* El gato ahora aparece siempre que haya una canción detectada */}
                  <box visible={hasTitle}>
                    <BongoCat />
                  </box>

                  <box
                    orientation={Gtk.Orientation.VERTICAL}
                    halign={Gtk.Align.START}
                    vexpand={false}
                  >
                    <label
                      class="song-artist"
                      label={createBinding(player, "artist")((a) => a || "Desconocido")}
                      halign={Gtk.Align.START}
                    />

                    <label
                      class="song-title"
                      label={createBinding(player, "title")((t) => {
                        const title = t || "Sin música";
                        return title.length > 20 ? title.substring(0, 20) + "..." : title
                      })}
                      halign={Gtk.Align.START}
                      ellipsize={3} 
                    />

                    <ProgressBar
                      currProgress={position((p) =>
                        player.length > 0 ? p / player.length : 0,
                      )}
                    />
                  </box>

                  {/* Los controles se ocultan si no hay una canción cargada */}
                  <box visible={hasTitle} spacing={0}>
                    <button onClicked={() => player.previous()}>
                      <image icon_name="custom-previous-symbolic" />
                    </button>
                    <button
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

                    <button onClicked={() => player.next()}>
                      <image icon_name="custom-next-symbolic" />
                    </button>
                  </box>
                </box>
              </box>
          );
        }}
      </For>
    </box>
  );
}
