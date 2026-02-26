import Gtk from "gi://Gtk"
import { Accessor } from "gnim"

export function ProgressBar({
  currProgress,
}: {
  currProgress: Accessor<number>
}) {
  return (
    <box
      class="progress-bar"
      $={(self) => {
        const bar = new Gtk.DrawingArea({
          hexpand: true,
          heightRequest: 3,
        })

        bar.set_draw_func((area, cr, width, height) => {
          const progress = currProgress()
          
          // 1. Obtener el contexto de estilo del widget
          const context = area.get_style_context()
          
          // 2. Leer el color de la propiedad 'color' de CSS
          const color = context.get_color() 

          // 3. Aplicar el color dinámico al pincel de Cairo
          cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha)
          
          cr.rectangle(0, 0, width * progress, height)
          cr.fill()
        })

        bar.set_valign(Gtk.Align.END)
        self.append(bar)
        currProgress.subscribe(() => bar.queue_draw())
      }}
    />
  )
}