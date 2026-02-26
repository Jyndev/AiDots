import { Gtk } from "ags/gtk4"
import { TodayStats } from "../TodayStats"

export function RightIsland() {
  return (
    <box class="island right-island" spacing={0}>
      <Gtk.DrawingArea
        widthRequest={60}
        heightRequest={60}
        // Usamos la misma clase que configuramos en el CSS
        class="notch-drawing-area"
        $={(self) => {
          // Forzar redibujado al cambiar estilos (Matugen)
          self.connect("realize", () => self.queue_draw())
          
          self.set_draw_func((area, cr, width, height) => {
            const context = area.get_style_context()
            const color = context.get_color() // Lee col.$bg_color del CSS

            const circleRadius = 60
            const notchCenterX = 4
            const notchCenterY = 60

            cr.setFillRule(1) // Cairo.FillRule.EVEN_ODD
            cr.rectangle(0, 0, width, height)
            cr.arc(notchCenterX, notchCenterY, circleRadius, 0, Math.PI * 2)

            // Aplicamos el color dinámico
            cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha)
            cr.fill()
          })
        }}
      />

      <box class="content">
        <TodayStats />
      </box>
    </box>
  )
}
