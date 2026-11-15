# Locuciones

| Carpeta | Qué hay | Lo genera |
| --- | --- | --- |
| `en/<id>.mp3`, `es/<id>.mp3` | Presentación de cada río | `scripts/generar_voces.py` |
| `en/ui/<id>.mp3`, `es/ui/<id>.mp3` | Locuciones de la interfaz: tutorial, y respuestas de los comandos de voz (`voz.js`) | `scripts/generar_voces_ui.py` |
| `textos.js` | Los mismos textos (`window.TEXTOS_LOCUCION.textos` para ríos, `.ui` para la interfaz), para decirlos con la voz del navegador si un mp3 no carga | los dos scripts |

Voces: `en-US-AvaNeural` y `es-AR-ElenaNeural` (edge-tts). Los textos se editan en `scripts/generar_voces.py` (ríos) y `scripts/textos_ui.py` (interfaz), nunca en `textos.js` ni a mano en los mp3.

## Tutorial

Lo implementa `tutorial.js` (vista `#tutorial`, entre la bienvenida y el menú). Una nota de voz por pantalla, en orden; las pantallas 1 a 7 son las de `Tutorial.pdf`, la 0 y la 8 se agregaron para presentar la app con el Paraná de ejemplo y para cerrar.

| Pantalla | id | Contenido |
| --- | --- | --- |
| 0 | `tutorial_0_parana` | Presentación: el Paraná de ejemplo, SWOT mide cada tramo, cada medida la toca un grupo de instrumentos, se dirige con las manos |
| 1 | `tutorial_1_manos` | Pararse frente a la cámara y levantar las dos manos; izquierda tiempo, derecha espacio y filtros |
| 2 | `tutorial_2_estaciones` | Mano izquierda: puño cerrado y girar para cambiar de estación |
| 3 | `tutorial_3_espacio` | Mano derecha: mover el cuadrado. La música la genera la persona al acercarse al río, según los datos de cada tramo; invita a recorrerlo de Rosario a Santa Fe |
| 4 | `tutorial_4_pulgar` | Filtros con los dedos; pulgar = ancho, maderas (la melodía) |
| 5 | `tutorial_5_indice` | Índice = nivel, cuerdas |
| 6 | `tutorial_6_medio` | Medio = pendiente, arpa y timbal |
| 7 | `tutorial_7_anular` | Anular = amplitud, contrabajos y cornos |
| 8 | `tutorial_8_fin` | Cierre: cómo se toca un río, y elegir uno |

Respuestas: `tutorial_manos_listas`, `tutorial_falta_mano` (pantalla 1) y `tutorial_saltar`. Los instrumentos son los de la música Relieve, la de la app por defecto (en Original el ancho va a las cuerdas y el nivel a las maderas, como en el PDF).

Desde la pantalla 3 el tutorial no reproduce música por su cuenta: la orquesta queda en silencio y suena solo cuando la persona acerca el cuadrado a los tramos reales del Paraná (`datos/parana.json`, entre Rosario y Santa Fe), con las mismas reglas de cercanía y paneo que el tablero. En las pantallas de dedos cada dedo prende su capa.

Cómo suenan: con `Locucion.decir(id)`, que corta lo anterior y baja la orquesta mientras habla. La barra espaciadora mantenida queda para hablar (comandos de voz); el tutorial no la usa.
