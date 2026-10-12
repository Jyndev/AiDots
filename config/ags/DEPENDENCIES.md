# Dependencias de Yuu AGS Bar

Guía de paquetes necesarios para ejecutar la barra **Yuu AGS**, sus paneles (*Control Center*, *Configuración de Hyprland*, *Gemini Chat*) y el reproductor de música con letras sincronizadas.

---

## 1. Instalación Rápida

### Repositorios Oficiales de Arch Linux (`pacman`)
```bash
sudo pacman -S --needed \
  dart-sass \
  playerctl \
  wl-clipboard \
  libpulse \
  networkmanager \
  wireplumber \
  libnotify \
  rofi \
  xdg-utils \
  gjs \
  gtk4
```

### AUR (`yay` / `paru`)
```bash
yay -S --needed \
  sptlrx-bin \
  hyprshot \
  ttf-fredoka \
  aylurs-gtk-shell-git \
  libastal-4-git \
  libastal-io-git \
  libastal-mpris-git \
  libastal-notifd-git \
  libastal-network-git \
  libastal-wireplumber-git \
  libastal-tray-git \
  libastal-hyprland-git
```

### Dependencias de JavaScript / TypeScript (`npm`)
Ejecutar dentro de la carpeta de configuración:
```bash
cd ~/.config/ags/yuu
npm install
```

---

## 2. Detalle y Propósito de cada Paquete

| Paquete | Origen | Función en el Entorno |
| :--- | :---: | :--- |
| **`dart-sass`** | Pacman | Compila los estilos SCSS (`style.scss` y parciales) a CSS en tiempo de ejecución. |
| **`sptlrx-bin`** | AUR | Streaming de letras sincronizadas de Spotify en la barra (`sptlrx pipe`). |
| **`playerctl`** | Pacman | Control multimedia MPRIS (play, pause, next, prev) para reproductores activos. |
| **`wl-clipboard`** | Pacman | Proporciona `wl-copy` y `wl-paste` para el portapapeles y copiado de código en Gemini. |
| **`libpulse`** | Pacman | Proporciona `paplay` para emitir el sonido de notificación al recibir alertas. |
| **`networkmanager`** | Pacman | Proporciona `nmcli` para consultar SSID, fuerza de señal y toggle de Wi-Fi en Control Center. |
| **`wireplumber`** | Pacman | Proporciona `wpctl` para controlar el volumen en el deslizador de audio. |
| **`libnotify`** | Pacman | Proporciona `notify-send` para notificaciones del sistema al recargar configuración. |
| **`hyprshot`** | AUR | Capturas de pantalla por región desde el botón "Foto" del Centro de Control. |
| **`rofi`** / **`rofi-wayland`** | Pacman | Lanzador de aplicaciones ejecutado desde el buscador. |
| **`xdg-utils`** | Pacman | Proporciona `xdg-open` para abrir links web desde las respuestas de Gemini. |
| **`ttf-fredoka`** | AUR | Fuente tipográfica principal utilizada en toda la barra y widgets. |
| **`libastal-*-git`** | AUR | Enlaces GObject Introspection necesarios para los servicios de ASTAL (`AstalMpris`, `AstalNotifd`, `AstalNetwork`, `AstalWp`, etc.). |

---

## 3. Configuración Adicional de Servicios

### Gemini AI
- Para utilizar el chat de Google Gemini, obtén una API Key gratuita en [aistudio.google.com](https://aistudio.google.com/).
- Puedes guardarla desde el chat enviando:
  ```text
  /key TU_API_KEY
  ```
  O guardándola directamente en: `~/.config/gemini_api_key`.

### Letras de Spotify (`sptlrx`)
- La configuración reside en `~/.config/ags/yuu/sptlrx.yaml`.
- Funciona directamente leyendo la pista actual de Spotify vía MPRIS sin necesidad de tokens web.

---

## 4. Iniciar o Recargar la Barra

Para recargar la barra manualmente tras cualquier cambio:
```bash
ags quit; ags run ~/.config/ags/yuu/app.ts
```
