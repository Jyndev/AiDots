import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"

export function BongoCat() {
  const home = GLib.get_home_dir();
  const up = `${home}/.config/ags/yuu/bongo_cat/a.png`;
  const down = `${home}/.config/ags/yuu/bongo_cat/b.png`;

  // Creamos el widget con el constructor de clase para tener control total
  const img = new Gtk.Image({
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    pixel_size: 40,
  });

  // Establecemos la imagen inicial
  img.set_from_file(up);

  // Iniciamos la animación
  let state = false;
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
    state = !state;
    img.set_from_file(state ? down : up);
    return GLib.SOURCE_CONTINUE;
  });

  return img; // Retornamos el objeto Gtk.Image directamente
}
