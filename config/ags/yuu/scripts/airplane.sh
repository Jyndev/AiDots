#!/bin/bash

# Obtener el estado actual del WiFi usando nmcli
STATE=$(nmcli radio wifi)

if [ "$STATE" = "enabled" ]; then
    # Activar Modo Avión: Apaga todo
    nmcli radio all off
    notify-send "Modo Avión" "Activado: Conexiones deshabilitadas" \
        -i airplane-mode-symbolic \
        -a "Sistema" \
        -u normal
else
    # Desactivar Modo Avión: Enciende todo
    nmcli radio all on
    notify-send "Modo Avión" "Desactivado: Restaurando conexiones" \
        -i network-wireless-symbolic \
        -a "Sistema" \
        -u normal
fi
