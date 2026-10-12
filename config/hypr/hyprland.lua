-- ~/.config/hypr/hyprland.lua
-- Hyprland Lua Configuration (Hyprland >= 0.55 / 0.56)
-- Refer to https://wiki.hypr.land/Configuring/Start/

------------------
---- MONITORS ----
------------------

hl.monitor({
    output   = "HDMI-A-1",
    mode     = "1920x1080@120",
    position = "auto",
    scale    = 1,
})

---------------------
---- MY PROGRAMS ----
---------------------

local terminal        = "kitty"
local fileManager     = "nemo"
local menu            = "rofi -show drun"
local opacity_default = 0.78

-------------------------------
---- ENVIRONMENT VARIABLES ----
-------------------------------

hl.env("QT_QPA_PLATFORMTHEME", "qt6ct")
hl.env("QT_QPA_PLATFORM", "wayland")
hl.env("XDG_CURRENT_DESKTOP", "Hyprland")
hl.env("XDG_SESSION_TYPE", "wayland")
hl.env("XDG_SESSION_DESKTOP", "Hyprland")
hl.env("XCURSOR_SIZE", "24")
hl.env("GTK_ICON_THEME", "Colloid-Purple")
hl.env("GTK_THEME", "Tokyonight-Dark")

-- Electron
hl.env("ELECTRON_OZONE_PLATFORM_HINT", "auto")

-------------------
---- AUTOSTART ----
-------------------

hl.on("hyprland.start", function ()
    hl.exec_cmd("dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP")
    hl.exec_cmd("~/.config/hypr/scripts/cursor-sync.sh")
    hl.exec_cmd("~/.config/ags/yuu/run_ags.sh")
    hl.exec_cmd("awww-daemon")
    hl.exec_cmd("hypr-dock")
end)

-- Ejecutar en inicio y en cada recarga de configuración
hl.exec_cmd('openrgb --startminimized -p "Joyner"')
hl.exec_cmd("~/.config/hypr/scripts/cursor-sync.sh")

-----------------------
---- LOOK AND FEEL ----
-----------------------

hl.config({
    cursor = {
        no_hardware_cursors  = true,
        enable_hyprcursor    = false,
        sync_gsettings_theme = false, -- Permite que nwg-look / gsettings controle el cursor sin ser sobreescrito
    },

    general = {
        gaps_in  = 1,
        gaps_out = 1,

        border_size = 0,

        col = {
            active_border   = { colors = { "rgba(33ccffee)", "rgba(00ff99ee)" }, angle = 45 },
            inactive_border = "rgba(595959aa)",
        },

        resize_on_border = true,
        allow_tearing    = false,
        layout           = "dwindle",
    },

    decoration = {
        rounding       = 10,
        rounding_power = 2,

        active_opacity   = opacity_default,
        inactive_opacity = 0.6,

        shadow = {
            enabled      = false,
            range        = 6,
            render_power = 2,
            color        = "rgba(152652ee)",
        },

        blur = {
            enabled  = true,
            size     = 4,
            passes   = 4,
            vibrancy = 0.08,
        },
    },

    misc = {
        force_default_wallpaper = -1,
        disable_hyprland_logo   = false,
    },
})

--------------------
---- ANIMATIONS ----
--------------------

hl.config({
    animations = {
        enabled = true,
    },
})

-- Curvas bezier de aceleración y desaceleración fluidas
hl.curve("easeOutQuint",   { type = "bezier", points = { { 0.23, 1 },    { 0.32, 1 } } })
hl.curve("easeInOutCubic", { type = "bezier", points = { { 0.65, 0 },    { 0.35, 1 } } })
hl.curve("openSpring",     { type = "bezier", points = { { 0.05, 0.9 },  { 0.1, 1.05 } } })
hl.curve("closeFast",      { type = "bezier", points = { { 0.3, 0 },     { 0.8, 0.15 } } })
hl.curve("smoothLinear",   { type = "bezier", points = { { 0, 0 },       { 1, 1 } } })

-- Ventanas: Apertura con popin elástico y cierre rápido y limpio
hl.animation({ leaf = "windows",     enabled = true, speed = 4,   bezier = "easeOutQuint" })
hl.animation({ leaf = "windowsIn",   enabled = true, speed = 3.6, bezier = "openSpring",   style = "popin 75%" })
hl.animation({ leaf = "windowsOut",  enabled = true, speed = 2.6, bezier = "closeFast",    style = "popin 80%" })
hl.animation({ leaf = "windowsMove", enabled = true, speed = 4,   bezier = "easeOutQuint" })

-- Fundido (fade) sincronizado con apertura y cierre
hl.animation({ leaf = "fade",        enabled = true, speed = 3.2, bezier = "easeOutQuint" })
hl.animation({ leaf = "fadeIn",      enabled = true, speed = 2.8, bezier = "easeOutQuint" })
hl.animation({ leaf = "fadeOut",     enabled = true, speed = 2.2, bezier = "closeFast" })

-- Bordes y espacios de trabajo
hl.animation({ leaf = "border",      enabled = true, speed = 3,   bezier = "easeOutQuint" })
hl.animation({ leaf = "borderangle", enabled = true, speed = 30,  bezier = "smoothLinear", style = "loop" })
hl.animation({ leaf = "workspaces",  enabled = true, speed = 4,   bezier = "easeOutQuint", style = "slidefade 20%" })

---------------
---- INPUT ----
---------------

hl.config({
    input = {
        kb_layout  = "latam",
        kb_variant = "",
        kb_model   = "",
        kb_options = "",
        kb_rules   = "",

        follow_mouse = 1,

        sensitivity = 0,

        touchpad = {
            natural_scroll = false,
        },
    },
})

hl.device({
    name        = "epic-mouse-v1",
    sensitivity = -0.5,
})

---------------------
---- KEYBINDINGS ----
---------------------

local mainMod = "SUPER"

hl.bind(mainMod .. " + Q", hl.dsp.exec_cmd(terminal))
hl.bind(mainMod .. " + C", hl.dsp.window.close())
hl.bind(mainMod .. " + M", hl.dsp.exec_cmd("command -v hyprshutdown >/dev/null 2>&1 && hyprshutdown || hyprctl dispatch 'hl.dsp.exit()'"))
hl.bind(mainMod .. " + E", hl.dsp.exec_cmd(fileManager))
hl.bind(mainMod .. " + V", hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + R", hl.dsp.exec_cmd(menu))
hl.bind(mainMod .. " + P", hl.dsp.window.pseudo())

-- Mover foco con flechas
hl.bind(mainMod .. " + left",  hl.dsp.focus({ direction = "left" }))
hl.bind(mainMod .. " + right", hl.dsp.focus({ direction = "right" }))
hl.bind(mainMod .. " + up",    hl.dsp.focus({ direction = "up" }))
hl.bind(mainMod .. " + down",  hl.dsp.focus({ direction = "down" }))

-- Cambiar de espacio de trabajo con mainMod + [0-9]
-- Mover ventana activa a un espacio de trabajo con mainMod + SHIFT + [0-9]
for i = 1, 10 do
    local key = i % 10 -- 10 corresponde a la tecla 0
    hl.bind(mainMod .. " + " .. key,         hl.dsp.focus({ workspace = i }))
    hl.bind(mainMod .. " + SHIFT + " .. key, hl.dsp.window.move({ workspace = i }))
end

-- Controles multimedia de volumen / reproducción
hl.bind("XF86AudioRaiseVolume", hl.dsp.exec_cmd("~/.config/scripts/volume/up.sh"))
hl.bind("XF86AudioLowerVolume", hl.dsp.exec_cmd("~/.config/scripts/volume/down.sh"))
hl.bind("XF86AudioPlay",        hl.dsp.exec_cmd("~/.config/scripts/volume/stop_play.sh"))

-- Espacio de trabajo especial (scratchpad / magic)
hl.bind(mainMod .. " + S",         hl.dsp.workspace.toggle_special("magic"))
hl.bind(mainMod .. " + SHIFT + S", hl.dsp.window.move({ workspace = "special:magic" }))

-- Navegación de espacios de trabajo con rueda del ratón
hl.bind(mainMod .. " + mouse_down", hl.dsp.focus({ workspace = "e+1" }))
hl.bind(mainMod .. " + mouse_up",   hl.dsp.focus({ workspace = "e-1" }))

-- Mover / redimensionar ventanas con clic y arrastre
hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(),   { mouse = true })
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })

-- Dock
hl.bind(mainMod .. " + D", hl.dsp.exec_cmd("hypr-dock"))

----------------------
---- WINDOW RULES ----
----------------------

-- Ventanas flotantes
local float_classes = {
    "nwg-look",
    "org.gnome.tweaks",
    "zenity",
    "org.gnome.SystemMonitor",
    "org.openrgb.OpenRGB",
    "python3",
    "eog",
    "xdg-desktop-portal-gtk",
    "org.gnome.FileRoller",
}

for _, class in ipairs(float_classes) do
    hl.window_rule({
        match = { class = class },
        float = true,
    })
end

-- nwg-look (Personalizador de apariencia GTK)
hl.window_rule({
    match  = { class = "nwg-look" },
    float  = true,
    size   = { 800, 580 },
    center = true,
})

-- Spotify
hl.window_rule({
    match  = { class = "Spotify" },
    float  = true,
    size   = { 1000, 700 },
    center = true,
})

-- Visualizador de imágenes EOG
hl.window_rule({
    match  = { class = "org.gnome.eog" },
    float  = true,
    center = true,
})

-- FondosApp (general)
hl.window_rule({
    match  = { class = "FondosApp" },
    float  = true,
    size   = { 400, 200 },
    center = true,
})

-- FondosApp (específico para selector de Material Wallpaper)
hl.window_rule({
    match  = { class = "FondosApp", title = "(Hyprland Material Wallpaper)(.*)" },
    float  = true,
    size   = { 970, 651 },
    center = true,
})

-- Propiedades de archivo Nemo
hl.window_rule({
    match = { class = "nemo", title = "(Propiedades)(.*)" },
    float = true,
})

-- Pantalla en pantalla (Picture-in-Picture)
hl.window_rule({
    match   = { title = "^(Pantalla en pantalla)(.*)$" },
    float   = true,
    pin     = true,
    opacity = "1.0 override 1.0 override",
})

-- Forzar que la terminal Kitty siempre se adapte al mosaico (tile)
hl.window_rule({
    match = { class = "kitty" },
    tile  = true,
    size  = { 900, 550 },
})
