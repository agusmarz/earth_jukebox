"""Textos de las locuciones de la interfaz (navegación por voz y tutorial), en inglés y castellano.

Los usa generar_voces_ui.py para pregenerar demo/audios/<idioma>/ui/<id>.mp3, y generar_voces.py
los copia a demo/audios/textos.js (clave "ui") para que locucion.js los diga con la voz del navegador
si un mp3 no carga. Un id nunca cambia de significado: si cambia el texto, se regenera el mp3 con el
mismo id (python generar_voces_ui.py --todos, o borrando ese mp3).

TUTORIAL: los clips tutorial_* quedan creados para que quien implemente el tutorial (otra persona u
otro LLM) los use tal cual, sin generar audios nuevos. Son la locución de las siete pantallas de
Tutorial.pdf, en orden, una por pantalla, más tutorial_0_parana (presentación de la app con el
Paraná de ejemplo) y tutorial_8_fin (cierre), que no están en el PDF. El texto original es el
castellano; el inglés es su traducción y es el idioma que usa la app por defecto. Ver
demo/audios/README.md. Los usa demo/tutorial.js.

Las pantallas 3 y 4 completan texto que en el PDF viene cortado ("..."). Desde la pantalla 3 el
Paraná suena cuando la persona acerca el cuadrado con la mano (nunca solo), y esos textos lo
explican e invitan a recorrerlo. Los instrumentos son los de la música Relieve (la de
la app por defecto): el ancho va a las maderas, que tocan la melodía, y el nivel a las cuerdas.
"""

TEXTOS_UI = {
    "en": {
        # 0. Presentación del tutorial y de la app, con el Paraná de ejemplo (no está en Tutorial.pdf)
        "tutorial_0_parana": (
            "Welcome to the tutorial. We will learn with the Paraná River, in South America, "
            "which flows south past the cities of Santa Fe and Rosario. "
            "The SWOT satellite, from NASA and CNES, measures every stretch of the river: its width, its water level, "
            "its slope, and its range, that is, how much the water rises and falls. "
            "Here, each of those measurements is played by a group of instruments, so the river sounds like an orchestra, "
            "and you are its conductor. You will conduct it with your hands: "
            "your left hand moves through time, and your right hand moves along the river and chooses what you hear. "
            "In each step, try the gesture: a short chime tells you the camera recognized it. "
            "Say next to continue, back to return, or repeat to hear a step again."
        ),
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
        # 3. Espacialmente, mano derecha. Completa el corte del PDF: el Paraná suena y se invita a recorrerlo
        "tutorial_3_espacio": (
            "Moving through space, with your right hand. "
            "Move your hand in the air, up, down, left, or right, and a square travels over the map of the Paraná. "
            "You make the music: the river stays silent until you bring the square close to it. "
            "As you approach, the orchestra starts to play, louder the closer you get, and your headphones tell you on which side the river is. "
            "At every point, the music follows that stretch of the river: its width, its water level, its slope, and its range. "
            "So as you travel along it, the music changes with the river. Hold still, and the orchestra holds its chord. "
            "Find the river, move up from Rosario toward Santa Fe, and feel it. Take your time, and say next when you are ready."
        ),
        # 4. Filtros, pulgar. Completa el corte del PDF ("with the shape of your fingers")
        "tutorial_4_pulgar": (
            "Filters, with your right hand. "
            "To filter which data you are hearing, you can use different gestures with the shape of your fingers: "
            "a raised finger brings its instruments in, a lowered finger takes them out. "
            "Finger one, your thumb, represents the width of the river: you will hear the woodwinds playing the melody. "
            "Bring the square onto the river, close your hand, raise only your thumb, and listen."
        ),
        # 5. Filtros, índice
        "tutorial_5_indice": (
            "Finger two, your index finger, represents the water level: you will hear the strings. "
            "Raise your index finger and listen."
        ),
        # 6. Filtros, medio
        "tutorial_6_medio": (
            "Finger three, your middle finger, represents the slope of the water: you will hear the harp and timpani. "
            "Raise your middle finger and listen."
        ),
        # 7. Filtros, anular
        "tutorial_7_anular": (
            "Finger four, your ring finger, represents the range: you will hear the double basses and horns. "
            "Raise your ring finger and listen. Then try raising several fingers at once."
        ),
        # 8. Cierre, con el Paraná de ejemplo (no está en Tutorial.pdf)
        "tutorial_8_fin": (
            "That's all you need. Let's put it together on the Paraná. "
            "A square follows your right hand over the map. When it touches the river, the orchestra plays loud; "
            "as it moves away, the music fades, and the sound in your headphones tells you on which side the river is. "
            "Move up, from Rosario toward Santa Fe, and listen to how the river changes. "
            "Hold your hand still and the orchestra holds its chord. "
            "Raise or lower your fingers to bring the instruments in and out, and turn your closed left fist to change the season. "
            "You can also speak at any time: hold the space bar and say help. "
            "Say next to choose your river."
        ),
        # Respuestas del tutorial
        "tutorial_manos_listas": "Both hands are in view. Say next to continue.",
        "tutorial_falta_mano": "I can't see both hands yet. Raise both hands in front of the camera, with your palms open.",
        "tutorial_saltar": "Skipping the tutorial.",
    },
    "es": {
        "tutorial_0_parana": (
            "Bienvenido al tutorial. Vamos a aprender con el río Paraná, en Sudamérica, "
            "que baja hacia el sur pasando por las ciudades de Santa Fe y Rosario. "
            "El satélite SWOT, de la NASA y el CNES, mide cada tramo del río: su ancho, el nivel del agua, "
            "su pendiente y su amplitud, es decir, cuánto sube y baja el agua. "
            "Aquí, cada una de esas medidas la toca un grupo de instrumentos, así el río suena como una orquesta, "
            "y tú eres quien la dirige. La vas a dirigir con las manos: "
            "la mano izquierda recorre el tiempo, y la mano derecha recorre el río y elige qué escuchas. "
            "En cada paso, prueba el gesto: un sonido corto te avisa que la cámara lo reconoció. "
            "Di siguiente para continuar, atrás para volver, o repetir para escuchar un paso de nuevo."
        ),
        "tutorial_1_manos": (
            "Posiciónate frente a la cámara y levanta ambas manos. "
            "Mano izquierda: tiempo. Mano derecha: espacialidad y filtros. "
            "Coloca tus manos frente a la cámara. Las dos deben aparecer en negro para continuar."
        ),
        "tutorial_2_estaciones": (
            "Estaciones, con la mano izquierda. "
            "Cierra tu mano y gira suavemente para cambiar de estación."
        ),
        "tutorial_3_espacio": (
            "Espacialmente, con la mano derecha. "
            "Mueve tu mano en el aire, hacia arriba, abajo, izquierda o derecha, y un cuadrado recorrerá el mapa del Paraná. "
            "La música la generas tú: el río está en silencio hasta que acercas el cuadrado. "
            "A medida que te acercas, la orquesta empieza a sonar, más fuerte cuanto más cerca estás, y tus auriculares te dicen de qué lado está el río. "
            "En cada punto, la música sigue a ese tramo del río: su ancho, el nivel del agua, su pendiente y su amplitud. "
            "Así, mientras lo recorres, la música cambia con el río. Si te quedas quieto, la orquesta sostiene su acorde. "
            "Encuentra el río, sube de Rosario hacia Santa Fe, y siéntelo. Tómate tu tiempo, y di siguiente cuando estés listo."
        ),
        "tutorial_4_pulgar": (
            "Filtros, con la mano derecha. "
            "Para filtrar qué datos estás escuchando podrás utilizar diferentes gestos, la forma de tus dedos: "
            "un dedo levantado hace entrar sus instrumentos, un dedo bajo los saca. "
            "El dedo 1, tu pulgar, representa el ancho del río, escucharás las maderas tocando la melodía. "
            "Lleva el cuadrado sobre el río, cierra la mano, levanta solo el pulgar, y escucha."
        ),
        "tutorial_5_indice": (
            "El dedo 2, tu índice, representa el nivel del agua, escucharás las cuerdas. "
            "Levanta el índice y escucha."
        ),
        "tutorial_6_medio": (
            "El dedo 3, tu dedo medio, representa la pendiente del agua, escucharás el arpa y el timbal. "
            "Levanta el dedo medio y escucha."
        ),
        "tutorial_7_anular": (
            "El dedo 4, tu anular, representa la amplitud, escucharás los contrabajos y los cornos. "
            "Levanta el anular y escucha. Después prueba levantar varios dedos a la vez."
        ),
        "tutorial_8_fin": (
            "Eso es todo lo que necesitas. Juntemos todo en el Paraná. "
            "Un cuadrado sigue a tu mano derecha sobre el mapa. Cuando toca el río, la orquesta suena fuerte; "
            "a medida que se aleja, la música se apaga, y el sonido en tus auriculares te dice de qué lado quedó el río. "
            "Sube, de Rosario hacia Santa Fe, y escucha cómo cambia el río. "
            "Si dejas la mano quieta, la orquesta sostiene su acorde. "
            "Levanta o baja los dedos para que entren y salgan los instrumentos, y gira el puño izquierdo cerrado para cambiar de estación. "
            "También puedes hablar en cualquier momento: mantén apretada la barra espaciadora y di ayuda. "
            "Di siguiente para elegir tu río."
        ),
        "tutorial_manos_listas": "Las dos manos están a la vista. Di siguiente para continuar.",
        "tutorial_falta_mano": "Todavía no veo las dos manos. Levanta las dos manos frente a la cámara, con las palmas abiertas.",
        "tutorial_saltar": "Saltamos el tutorial.",
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
        # Suena apenas se abre la página, mientras el navegador pide el permiso del micrófono. De la
        # bienvenida no se pasa sin la cámara: el "next" recién se pide en camara_activada
        "inicio": (
            "Welcome to The Melody of Water. You will play the rivers with your hands, so first, "
            "press the C key to turn on the camera. If your browser asks for the camera or the microphone, allow it. "
            "The camera takes a few seconds to load, and that's normal, so please wait. "
            "While it loads you will hear a soft water sound. When the sound stops, the camera is ready."
        ),
        # Ayuda de la bienvenida; voz.js le agrega camara_pedir o decir_next según la cámara
        "vista_bienvenida": (
            "Welcome to The Melody of Water, where satellite data from the great rivers of the world "
            "becomes orchestral music. Hold the space bar while you speak, or say help at any time."
        ),
        "camara_pedir": (
            "First, press the C key to turn on the camera. It takes a few seconds: "
            "when the water sound stops, the camera is ready."
        ),
        "camara_activada": (
            "The camera is on. Now press and hold the space bar, say next, and release it to continue."
        ),
        "decir_next": "Say next to continue.",
        "camara_error_permiso": (
            "The camera is blocked. Allow it from the browser's address bar, then press C again."
        ),
        "camara_error_sin_camara": "No camera was found. Connect one, then press C again.",
        "camara_error": "The camera could not start. Press C to try again.",
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
        # Al terminar la presentación de un río con estaciones (demo.js, presentarRio)
        **{
            f"estacion_inicio_{clave}": (
                f"You are listening to {nombre}. To change the season, "
                "close your left hand into a fist and turn it in a circle."
            )
            for clave, nombre in [("verano", "summer"), ("otono", "autumn"), ("invierno", "winter"), ("primavera", "spring")]
        },
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
            "Bienvenido a The Melody of Water. Vas a tocar los ríos con tus manos, así que primero "
            "presiona la tecla C para prender la cámara. Si el navegador pide permiso para la cámara o el micrófono, acéptalo. "
            "La cámara tarda algunos segundos en cargar, y es normal, así que espera un poco. "
            "Mientras carga vas a escuchar un suave sonido de agua. Cuando deje de sonar, la cámara está lista."
        ),
        "vista_bienvenida": (
            "Bienvenido a The Melody of Water, donde los datos satelitales de los grandes ríos del mundo "
            "se convierten en música orquestal. Mantén apretada la barra espaciadora mientras hablas, "
            "o di ayuda en cualquier momento."
        ),
        "camara_pedir": (
            "Primero presiona la tecla C para prender la cámara. Tarda algunos segundos: "
            "cuando deje de sonar el agua, la cámara está lista."
        ),
        "camara_activada": (
            "La cámara está prendida. Ahora mantén apretada la barra espaciadora, di siguiente y suéltala para continuar."
        ),
        "decir_next": "Di siguiente para continuar.",
        "camara_error_permiso": (
            "La cámara está bloqueada. Permítela desde la barra de direcciones del navegador y presiona C de nuevo."
        ),
        "camara_error_sin_camara": "No se encontró ninguna cámara. Conecta una y presiona C de nuevo.",
        "camara_error": "La cámara no pudo arrancar. Presiona C para intentar de nuevo.",
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
        **{
            f"estacion_inicio_{clave}": (
                f"Estás escuchando {nombre}. Para cambiar de estación, "
                "cierra tu mano izquierda en un puño y gírala en círculo."
            )
            for clave, nombre in [("verano", "el verano"), ("otono", "el otoño"), ("invierno", "el invierno"), ("primavera", "la primavera")]
        },
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
