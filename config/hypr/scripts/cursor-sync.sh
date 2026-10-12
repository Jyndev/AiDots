#!/bin/bash
# Garantizar instancia única con flock
exec 200<"$0"
flock -n 200 || exit 0

apply_cursor() {
    local theme
    local size
    theme=$(gsettings get org.gnome.desktop.interface cursor-theme 2>/dev/null | tr -d "'\"")
    size=$(gsettings get org.gnome.desktop.interface cursor-size 2>/dev/null)
    
    if [ -z "$theme" ]; then
        theme="Adwaita"
    fi
    if [ -z "$size" ] || [ "$size" = "0" ]; then
        size=24
    fi
    
    hyprctl setcursor "$theme" "$size"
}

# Aplicar el tema actual inmediatamente
apply_cursor

# Escuchar cambios de nwg-look y gsettings en tiempo real
gsettings monitor org.gnome.desktop.interface cursor-theme | while read -r _; do
    apply_cursor
done
