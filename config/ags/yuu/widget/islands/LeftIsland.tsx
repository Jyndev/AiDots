import { Gtk } from "ags/gtk4"
// Importa la variable que contiene tus colores (si la tienes definida en un archivo de constantes/variables)
// Supongamos que tienes un objeto 'colors' que se actualiza.

export function LeftIsland() {
  return (
    <box class="island left-island">
      <box class="content">
        <image class="custom-icon" iconName="custom-arch-symbolic" pixel_size={30} />
      </box>
      <Gtk.DrawingArea
        widthRequest={60}
        heightRequest={60}
        // USAMOS UN SELECTOR DE CLASE EN LUGAR DE ETIQUETA
        class="notch-drawing-area"
        $={(self) => {
          // Obligamos a redibujar cuando cambie el estilo
          self.connect("realize", () => self.queue_draw())
          
          self.set_draw_func((area, cr, width, height) => {
            const context = area.get_style_context()
            // GTK4: Intentamos obtener el color de primer plano (fg) 
            // que definiremos en el CSS específicamente para esta clase
            const color = context.get_color()

            const circleRadius = 60
            const notchCenterX = 56
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
