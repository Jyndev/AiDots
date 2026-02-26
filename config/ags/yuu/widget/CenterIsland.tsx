import { Gtk } from "ags/gtk4"
import Mpris from "./mpris"

export function CenterIsland() {
  return (
    <box class="island center-island" spacing={0}>
      {/* Notch Derecho de la Isla Central */}
      <Gtk.DrawingArea
        widthRequest={60}
        heightRequest={60}
        class="notch-drawing-area"
        $={(self) => {
          self.connect("realize", () => self.queue_draw())
          self.set_draw_func((area, cr, width, height) => {
            const context = area.get_style_context()
            const color = context.get_color()

            const circleRadius = 60
            const notchCenterX = 4 // Coordenada para el notch derecho
            const notchCenterY = 60

            cr.setFillRule(1)
            cr.rectangle(0, 0, width, height)
            cr.arc(notchCenterX, notchCenterY, circleRadius, 0, Math.PI * 2)
            cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha)
            cr.fill()
          })
        }}
      />
     

      <box class="content">
        <Mpris />
      </box>

       {/* Notch Izquierdo de la Isla Central */}
      <Gtk.DrawingArea
        widthRequest={60}
        heightRequest={60}
        class="notch-drawing-area"
        $={(self) => {
          self.connect("realize", () => self.queue_draw())
          self.set_draw_func((area, cr, width, height) => {
            const context = area.get_style_context()
            const color = context.get_color()

            const circleRadius = 60
            const notchCenterX = 56 // Coordenada para el notch izquierdo
            const notchCenterY = 60

            cr.setFillRule(1)
            cr.rectangle(0, 0, width, height)
            cr.arc(notchCenterX, notchCenterY, circleRadius, 0, Math.PI * 2)
            cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha)
            cr.fill()
          })
        }}
      />
    </box>
  )
}
