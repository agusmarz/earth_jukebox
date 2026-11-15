# Locuciones

| Carpeta | Qué hay | Lo genera |
| --- | --- | --- |
| `en/<id>.mp3`, `es/<id>.mp3` | Presentación de cada río | `scripts/generar_voces.py` |
| `en/ui/<id>.mp3`, `es/ui/<id>.mp3` | Locuciones de la interfaz: tutorial, y respuestas de los comandos de voz (`voz.js`) | `scripts/generar_voces_ui.py` |
| `textos.js` | Los mismos textos (`window.TEXTOS_LOCUCION.textos` para ríos, `.ui` para la interfaz), para decirlos con la voz del navegador si un mp3 no carga | los dos scripts |

Voces: `en-US-AvaNeural` y `es-AR-ElenaNeural` (edge-tts). Los textos se editan en `scripts/generar_voces.py` (ríos) y `scripts/textos_ui.py` (interfaz), nunca en `textos.js` ni a mano en los mp3.

## Tutorial: audios listos para quien lo implemente

**Estos clips ya están creados para que la persona o el LLM que implemente el tutorial los use tal cual.** No hace falta generar audios nuevos ni escribir textos: hay uno por pantalla de `Tutorial.pdf`, en orden. La app usa inglés por defecto (`en/ui/`); `es/ui/` es el texto original del PDF.

| Pantalla | id | Contenido | Duración aprox. (en) |
| --- | --- | --- | --- |
| 1 | `tutorial_1_manos` | Pararse frente a la cámara y levantar las dos manos; izquierda tiempo, derecha espacio y filtros | 12 s |
| 2 | `tutorial_2_estaciones` | Mano izquierda: puño cerrado y girar para cambiar de estación | 6 s |
| 3 | `tutorial_3_espacio` | Mano derecha: moverla arriba, abajo, izquierda o derecha | 10 s |
| 4 | `tutorial_4_pulgar` | Filtros con los dedos; pulgar = Width, cuerdas | 12 s |
| 5 | `tutorial_5_indice` | Índice = Level, maderas | 6 s |
| 6 | `tutorial_6_medio` | Medio = Slope, arpa y timbal | 6 s |
| 7 | `tutorial_7_anular` | Anular = Range, contrabajos y cornos | 6 s |

Ruta de cada uno: `audios/<idioma>/ui/<id>.mp3`. Texto: `window.TEXTOS_LOCUCION.ui[<idioma>][<id>]`. Los textos de las pantallas 3 y 4 completan frases que en el PDF están cortadas y están marcados PENDIENTE en `scripts/textos_ui.py`; si cambian, se regeneran con el mismo id.

Cómo reproducirlos:

- Usar el mismo mecanismo que `locucion.js`: un `<audio>`, plan B con `speechSynthesis` y el mismo texto, una locución nueva corta la anterior, y mientras habla `Sonido.atenuar(true)` baja la orquesta.
- Usar `Locucion.decir('tutorial_1_manos')` (idioma `'en'` por defecto). Lee `audios/<idioma>/ui/<id>.mp3`, si no carga dice `TEXTOS_LOCUCION.ui` con la voz del navegador, corta lo anterior, baja la orquesta y **no** cambia lo que repite la tecla R. `Locucion.hablando` y el evento `locucion` de window dicen si está hablando.
- Al entrar a cada pantalla suena su clip. Al pasar a la siguiente (NEXT o "next" por voz) se corta el anterior y suena el nuevo. El botón de repetir de la pantalla vuelve a decir el clip actual.
- La barra espaciadora mantenida queda reservada para hablar (push-to-talk de los comandos de voz): el tutorial no debe usarla para avanzar.
