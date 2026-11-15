"""Textos de las locuciones de la interfaz (navegación por voz y tutorial), en inglés y castellano.

Los usa generar_voces_ui.py para pregenerar demo/audios/<idioma>/ui/<id>.mp3, y generar_voces.py
los copia a demo/audios/textos.js (clave "ui") para que locucion.js los diga con la voz del navegador
si un mp3 no carga. Un id nunca cambia de significado: si cambia el texto, se regenera el mp3 con el
mismo id (python generar_voces_ui.py --todos, o borrando ese mp3).

TUTORIAL: los clips tutorial_* quedan creados para que quien implemente el tutorial (otra persona u
otro LLM) los use tal cual, sin generar audios nuevos. Son la locución de las siete pantallas de
Tutorial.pdf, en orden, una por pantalla. El texto original es el castellano; el inglés es su
traducción y es el idioma que usa la app por defecto. Ver demo/audios/README.md.

Las frases marcadas PENDIENTE completan texto que en el PDF viene cortado ("..."); hay que
confirmarlas con el autor del tutorial y, si cambian, regenerar esos dos ids en los dos idiomas.
"""

TEXTOS_UI = {
    "en": {
        # 1. Las dos manos
        "tutorial_1_manos": (
            "Stand in front of the camera and raise both hands. "
            "Left hand: time. Right hand: space and filters. "
            "Place your hands in front of the camera. Both must turn black to continue."
        ),
        # 2. Estaciones, mano izquierda
        "tutorial_2_estaciones": (
            "Seasons, with your left hand. "
            "Close your hand and turn it gently to change the season."
        ),
        # 3. Espacialmente, mano derecha. PENDIENTE: "toward another part of the river" completa el corte del PDF
        "tutorial_3_espacio": (
            "Moving through space, with your right hand. "
            "Move your hand in the air: up, down, left, or right. "
            "Each direction will guide you toward another part of the river."
        ),
        # 4. Filtros, pulgar. PENDIENTE: "with the shape of your fingers" y la frase del pulgar completan el PDF
        "tutorial_4_pulgar": (
            "Filters, with your right hand. "
            "To filter which data you are hearing, you can use different gestures with the shape of your fingers. "
            "Finger one, your thumb, represents the width of the river: you will hear the strings."
        ),
        # 5. Filtros, índice
        "tutorial_5_indice": (
            "Finger two, your index finger, represents the water level: you will hear the woodwinds."
        ),
        # 6. Filtros, medio
        "tutorial_6_medio": (
            "Finger three, your middle finger, represents the slope of the water: "
            "you will hear the harp and timpani."
        ),
        # 7. Filtros, anular
        "tutorial_7_anular": (
            "Finger four, your ring finger, represents the range: "
            "you will hear the double basses and horns."
        ),
    },
    "es": {
        "tutorial_1_manos": (
            "Posiciónate frente a la cámara y levanta ambas manos. "
            "Mano izquierda: tiempo. Mano derecha: espacialidad y filtros. "
            "Coloca tus manos frente a la cámara. Las dos deben aparecer en negro para continuar."
        ),
        "tutorial_2_estaciones": (
            "Estaciones, con la mano izquierda. "
            "Cierra tu mano y gira suavemente para cambiar de estación."
        ),
        # PENDIENTE: "hacia otra parte del río" completa el corte del PDF
        "tutorial_3_espacio": (
            "Espacialmente, con la mano derecha. "
            "Mueve tu mano en el aire hacia arriba, abajo, izquierda o derecha. "
            "Cada dirección te guiará hacia otra parte del río."
        ),
        # PENDIENTE: "la forma de tus dedos" y la frase del pulgar completan el PDF
        "tutorial_4_pulgar": (
            "Filtros, con la mano derecha. "
            "Para filtrar qué datos estás escuchando podrás utilizar diferentes gestos, la forma de tus dedos. "
            "El dedo 1, tu pulgar, representa el ancho del río, escucharás las cuerdas."
        ),
        "tutorial_5_indice": (
            "El dedo 2, tu índice, representa el nivel del agua, escucharás las maderas."
        ),
        "tutorial_6_medio": (
            "El dedo 3, tu dedo medio, representa la pendiente del agua, escucharás el arpa y el timbal."
        ),
        "tutorial_7_anular": (
            "El dedo 4, tu anular, representa la amplitud, escucharás los contrabajos y los cornos."
        ),
    },
}


# Navegación por voz (voz.js). Suenan solo como respuesta a un comando hablado, nunca a una tecla.
RIOS_MENU = [
    # id, nombre en inglés, nombre en castellano, en el orden del menú (demo/rios.js)
    ("amazonas", "Amazon", "Amazonas"),
    ("congo", "Congo", "Congo"),
    ("ganges", "Ganges", "Ganges"),
    ("orinoco", "Orinoco", "Orinoco"),
    ("yangtse", "Yangtze", "Yangtsé"),
    ("yenisei", "Yenisei", "Yeniséi"),
    ("parana", "Paraná", "Paraná"),
    ("lena", "Lena", "Lena"),
    ("mississippi", "Mississippi", "Misisipi"),
    ("mekong", "Mekong", "Mekong"),
]
NUMEROS_EN = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]
NUMEROS_ES = ["Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"]

NAVEGACION = {
    "en": {
        # Suena apenas se abre la página, mientras el navegador pide el permiso del micrófono
        "inicio": (
            "Welcome to The Melody of Water. To use your voice, press and hold the space bar while you speak, "
            "and release it when you finish. If your browser asks for the microphone, allow it. "
            "Say next to continue."
        ),
        "vista_bienvenida": (
            "Welcome to The Melody of Water, where satellite data from the great rivers of the world "
            "becomes orchestral music. Hold the space bar while you speak. Say next to continue, "
            "or help at any time."
        ),
        "vista_menu": (
            "Choose a river. "
            + " ".join(f"{n}, {en}." for n, (_, en, _) in zip(NUMEROS_EN, RIOS_MENU))
            + " Hold the space bar and say a river's name or its number."
        ),
        "vista_tablero_portada": "The orchestra is ready. Say start, or press any key, to listen to the river.",
        "vista_tablero_comandos": (
            "Hold the space bar and say: width, level, slope or range, to turn an instrument on or off. "
            "Summer, autumn, winter or spring. Scale. Music. Zoom in, zoom out, or whole river. "
            "Repeat, to hear the introduction again. Status. Or menu, to go back to the rivers."
        ),
        "capa_width_on": "Width on.",
        "capa_width_off": "Width off.",
        "capa_level_on": "Level on.",
        "capa_level_off": "Level off.",
        "capa_slope_on": "Slope on.",
        "capa_slope_off": "Slope off.",
        "capa_range_on": "Range on.",
        "capa_range_off": "Range off.",
        "estacion_verano": "Summer.",
        "estacion_otono": "Autumn.",
        "estacion_invierno": "Winter.",
        "estacion_primavera": "Spring.",
        "escala_propia": "Own scale.",
        "escala_global": "Global scale.",
        "musica_original": "Music: original.",
        "musica_dos_octavas": "Music: two octaves.",
        "musica_relieve": "Music: relief.",
        "zoom_in": "Zoom in.",
        "zoom_out": "Zoom out.",
        "zoom_reset": "Whole river.",
        "volver_menu": "Back to the river menu.",
        "volver_inicio": "Back to the start.",
        **{f"confirmar_{id_}": f"Did you mean the {en}? Say yes or no." for id_, en, _ in RIOS_MENU},
        "cancelado": "Cancelled.",
        "error_no_entendi": "Sorry, I didn't catch that. Say help to hear the options.",
        "error_no_disponible": "That command isn't available here. Say help to hear the options.",
        "error_sin_mic": "No microphone was found. You can use the keyboard instead.",
        "error_permiso": "Microphone access is blocked. Allow it from the browser's address bar, or use the keyboard.",
        "error_sin_reconocimiento": "This browser can't recognize voice commands. Try Chrome or Edge, or use the keyboard.",
        "error_red": "Voice recognition needs an internet connection. Check it and try again.",
        "error_sin_estacion": "This river has no data for that season.",
        "error_cargando": "The orchestra is still loading. Try again in a moment.",
        "mic_activado": (
            "Voice commands are on. Hold the space bar while you speak. "
            "On this screen and in the river menu, you can also just speak."
        ),
    },
    "es": {
        "inicio": (
            "Bienvenido a The Melody of Water. Para usar tu voz, mantén apretada la barra espaciadora mientras hablas, "
            "y suéltala al terminar. Si el navegador pide permiso para usar el micrófono, acéptalo. "
            "Di siguiente para continuar."
        ),
        "vista_bienvenida": (
            "Bienvenido a The Melody of Water, donde los datos satelitales de los grandes ríos del mundo "
            "se convierten en música orquestal. Mantén apretada la barra espaciadora mientras hablas. "
            "Di siguiente para continuar, o ayuda en cualquier momento."
        ),
        "vista_menu": (
            "Elige un río. "
            + " ".join(f"{n}, {es}." for n, (_, _, es) in zip(NUMEROS_ES, RIOS_MENU))
            + " Mantén apretada la barra espaciadora y di el nombre o el número de un río."
        ),
        "vista_tablero_portada": "La orquesta está lista. Di empezar, o presiona cualquier tecla, para escuchar el río.",
        "vista_tablero_comandos": (
            "Mantén apretada la barra espaciadora y di: ancho, nivel, pendiente o amplitud, para prender o apagar "
            "un instrumento. Verano, otoño, invierno o primavera. Escala. Música. Acercar, alejar, o río entero. "
            "Repetir, para volver a escuchar la presentación. Estado. O menú, para volver a los ríos."
        ),
        "capa_width_on": "Ancho prendido.",
        "capa_width_off": "Ancho apagado.",
        "capa_level_on": "Nivel prendido.",
        "capa_level_off": "Nivel apagado.",
        "capa_slope_on": "Pendiente prendida.",
        "capa_slope_off": "Pendiente apagada.",
        "capa_range_on": "Amplitud prendida.",
        "capa_range_off": "Amplitud apagada.",
        "estacion_verano": "Verano.",
        "estacion_otono": "Otoño.",
        "estacion_invierno": "Invierno.",
        "estacion_primavera": "Primavera.",
        "escala_propia": "Escala propia.",
        "escala_global": "Escala global.",
        "musica_original": "Música: original.",
        "musica_dos_octavas": "Música: dos octavas.",
        "musica_relieve": "Música: relieve.",
        "zoom_in": "Acercando.",
        "zoom_out": "Alejando.",
        "zoom_reset": "Río entero.",
        "volver_menu": "De vuelta en el menú de ríos.",
        "volver_inicio": "De vuelta al inicio.",
        **{f"confirmar_{id_}": f"¿Quisiste decir el {es}? Di sí o no." for id_, _, es in RIOS_MENU},
        "cancelado": "Cancelado.",
        "error_no_entendi": "Perdón, no te entendí. Di ayuda para escuchar las opciones.",
        "error_no_disponible": "Ese comando no está disponible acá. Di ayuda para escuchar las opciones.",
        "error_sin_mic": "No se encontró ningún micrófono. Puedes usar el teclado.",
        "error_permiso": "El micrófono está bloqueado. Permítelo desde la barra de direcciones del navegador, o usa el teclado.",
        "error_sin_reconocimiento": "Este navegador no reconoce comandos de voz. Prueba con Chrome o Edge, o usa el teclado.",
        "error_red": "El reconocimiento de voz necesita conexión a internet. Revísala y vuelve a intentar.",
        "error_sin_estacion": "Este río no tiene datos para esa estación.",
        "error_cargando": "La orquesta todavía está cargando. Prueba de nuevo en un momento.",
        "mic_activado": (
            "Comandos de voz activados. Mantén apretada la barra espaciadora mientras hablas. "
            "En esta pantalla y en el menú de ríos, también puedes hablar directamente."
        ),
    },
}

for _idioma, _textos in NAVEGACION.items():
    TEXTOS_UI[_idioma].update(_textos)
