# The Melody of Water, demo del mapa sonoro de ríos

Prototipo para "leer" un río con el mouse. Sirve para cualquier río que tenga sus datos en `datos/`, sin tocar código. Un cuadrado sigue al mouse sobre el mapa. Si toca el río suena fuerte, a medida que se aleja baja el volumen, y el paneo estéreo indica hacia qué lado quedó el río. Es la base para después reemplazar el mouse por la mano.

## Vistas

La interfaz está en inglés y copia los diseños de `earth_jukebox_design` (`welcome.png`, `home.png` y `river_dashboard.png`). Es una sola página con tres vistas, y la dirección cambia con cada una, así funcionan el botón de atrás del navegador y los enlaces directos.

| Vista | Dirección | Cómo se sale |
| --- | --- | --- |
| Bienvenida, "The Melody of Water" | `index.html` | Clic en la pestaña de abajo, o Enter, Espacio, flecha derecha o N |
| Menú de ríos sobre el planisferio | `#rios` | Clic en la etiqueta de un río, o las teclas 1 a 9 y 0 para el décimo. Escape vuelve a la bienvenida |
| Tablero del río | `#rio/<id>` | Clic en el logo de arriba a la izquierda, o Escape |

Los ríos del menú van numerados de mayor a menor caudal, con su nombre en inglés, según `rios.js`. Un río de `datos/indice.json` que no esté en `rios.js` aparece al final con el nombre de sus datos. Las etiquetas van sobre el punto medio del cauce, y si dos se pisan se separan y una línea las une con su río.

El botón del micrófono, el texto "Say NEXT", la pestaña con el micrófono del menú y el botón Tutorial están dibujados como en el diseño pero todavía no hacen nada. Quedan para los comandos de voz. En el lugar de las dos manos del diseño, abajo a la derecha del tablero, va la cámara del control con las manos. El fondo de colores que sigue al cursor en `river_dashboard.png` tampoco está, y el tablero va sobre fondo blanco.

## Cómo abrirla

La demo lee las muestras de la orquesta con `fetch`, y el navegador no lo permite desde una dirección `file://`. Por eso hay que abrirla desde un servidor local. En esta carpeta corré

```bash
python -m http.server
```

y entrá a http://localhost:8000 con Chrome o Edge. No necesita internet. La portada muestra el avance mientras se cargan los instrumentos, y el primer clic o tecla habilita el audio. Con auriculares se nota mucho mejor el paneo.

La dirección acepta estos parámetros, y se pueden combinar.

| Parámetro | Qué hace |
| --- | --- |
| `#rio/<id>` | Abre directo el tablero de ese río. La dirección vieja `?rio=<id>` también funciona |
| `?normalizacion=global` | Arranca con la normalización global. Sin el parámetro arranca con la propia |
| `?musica=dos_octavas` o `?musica=relieve` | Arranca con esa lógica musical. Sin el parámetro arranca con la original |
| `?estacion=invierno` | Arranca con esa estación (`verano`, `otono`, `invierno` o `primavera`) si el río tiene estaciones. Sin el parámetro arranca en verano |
| `?carpeta=pruebas` | Lee los datos de `pruebas/` en lugar de `datos/` |

Por ejemplo http://localhost:8000/?carpeta=pruebas&normalizacion=global#rio/sintetico. La dirección se actualiza sola al cambiar de río o de normalización, así se puede copiar y compartir.

La orquesta empieza a cargarse apenas se abre la bienvenida, así al elegir un río ya suele estar lista y arranca sola, porque el clic en el menú ya habilitó el audio. Si se entra directo a `#rio/<id>`, el tablero pide un clic o una tecla antes de sonar.

Si `datos/` todavía no tiene datos, la portada lo avisa. Mientras tanto se puede probar con `?carpeta=pruebas`.

## Ríos y datos

En el tablero, además del menú, el selector River del panel lista los ríos de `datos/indice.json`. Se maneja con el mouse o con el teclado (Tab hasta el selector y flechas), y al cambiar de río se anuncia para lectores de pantalla. Al cambiar, se corta lo que estaba sonando y la orquesta arranca de nuevo con el río nuevo. Las capas prendidas y apagadas y la normalización elegida se mantienen.

Cada río es un archivo `datos/<id>.json` con este formato.

```
indice.json  {"rios": [{"id": "parana", "nombre": "Paraná"}]}
<id>.json    {"version": 1, "id", "nombre", "fuente", "unidades": {"ancho", "nivel", "pendiente", "amplitud"},
              "ciudades": [[nombre, lat, lon]],
              "tramos": [{"id", "tipo", "nombre", "de_hueco", "km", "pasadas", "valor",
                          "normas": {"propia": {...}, "global": {...}},
                          "corregido", "medido", "interpolado", "linea": [[lon, lat]]}]}
```

`valor` tiene los valores en sus unidades y `normas` los mismos valores llevados a 0 a 1 de las dos formas. `de_hueco`, `corregido`, `medido` e `interpolado` son opcionales. El título, la pestaña y la descripción del mapa salen de `nombre`, y las ciudades se dibujan con la etiqueta a la derecha, salvo que pise a otra ciudad que está al este, en cuyo caso va a la izquierda.

## Presentación hablada

Al empezar a escuchar y cada vez que se elige otro río, una voz dice en inglés dónde está el río, qué países recorre y cuánto mide. Es una voz neuronal pregrabada, `audios/en/<id>.mp3` (en-US-AvaNeural), que genera `scripts/generar_voces.py` con edge-tts junto con `audios/textos.js`. El script también genera las versiones en castellano de `audios/es/`, que la interfaz ya no usa. Si un mp3 no carga, `locucion.js` dice el mismo texto con la voz del navegador. Si se cambia de río antes de que termine, la presentación anterior se corta. Mientras habla, la orquesta baja a un quinto de su volumen y vuelve al terminar.

El botón Replay del panel (o la tecla R) repite la presentación. `locucion.js` usa un elemento de audio y no `fetch`, así que funciona también desde `file://`, aunque el resto de la demo sigue necesitando el servidor local.

## Zoom

El tablero arranca con el río entero. La rueda del mouse acerca o aleja el mapa alrededor del cursor, y las teclas + y − hacen lo mismo alrededor del cuadrado. Con 0 se vuelve al río entero. El minimapa de abajo a la derecha muestra el río completo con un rectángulo verde sobre la parte que se ve, y un clic o arrastre sobre él mueve la vista. El zoom no cambia el sonido: el cuadrado sigue midiendo la distancia en píxeles de pantalla.

## Control con las manos

`manos.js` es el port a la web de `manos/Mediapipe.py`, con `@mediapipe/tasks-vision` corriendo en el navegador, sin ningún proceso aparte. El botón Camera del pie del panel (o la tecla C) prende la cámara, y el cuadro muestra la imagen espejada en grises con los esqueletos de las manos, el recuadro punteado de la zona de la mano derecha, el eje del puño izquierdo y un resumen de dedos y giro.

- La mano derecha es la única que mueve el cuadrado. Las esquinas del recuadro punteado van a las esquinas de la parte útil del mapa (`Mapa.areaUtil`, la que no tapan el panel, el logo ni las fuentes), salvo arriba, donde la mano llega hasta el mismo margen que a los costados. Mientras se ve la mano, el mouse no mueve el cuadrado; sin la mano vuelven el mouse y las flechas.
- Sus cuatro primeros dedos (pulgar, índice, medio y anular) prenden y apagan las capas 1 a 4: dedo levantado, capa prendida. Un dedo tiene que quedarse igual 200 ms para contar. El meñique no hace nada. Si la mano sale de cuadro las capas quedan como estaban.
- La mano izquierda es la única que cambia la estación, y solo con el puño cerrado. Al cerrarlo aparece un eje que flota con la mano, y cada vuelta completa del puño a su alrededor pasa a la estación siguiente (sentido horario) o a la anterior (antihorario).
- MediaPipe distingue las manos por su forma y con el puño cerrado suele confundirlas. Por eso una mano conserva su identidad mientras se mueva sin saltos, en cualquier parte de la cámara, y una mano que aparece sola se decide por mayoría de la etiqueta en 5 cuadros (unos 170 ms, en los que todavía no hace nada).

Los parámetros son los de `Mediapipe.py` salvo la sensibilidad, que baja de 2,4 a 1,6 para que la zona de la mano derecha sea más grande (62,5 % del cuadro). La librería se baja de jsDelivr y el modelo se busca en `hand_landmarker.task` (en esta carpeta), en `../../manos/hand_landmarker.task` y si no se baja de Google, así que el control con las manos necesita internet. La cámara solo funciona en `localhost` o con HTTPS, como en GitHub Pages.

## Estaciones del año

El selector de estación, debajo del de río, cambia los valores de cada tramo por los de esa estación: ancho, nivel, pendiente y amplitud calculados solo con las pasadas de sus tres meses, de todos los años medidos. No hay opción de todo el año: si la dirección no pide una estación, el río arranca en verano, y la estación elegida se mantiene al cambiar a otro río que la tenga. Se usa la misma normalización propia del año entero en las cuatro estaciones, así se comparan entre sí. Como con la normalización, lo que está sonando no se corta y el cambio entra en la nota siguiente, y el grosor del río y el panel se actualizan al instante. Los tramos que en esa estación no tienen pasadas buenas se dibujan en gris y suenan con valores interpolados.

Las estaciones se leen de `datos/estaciones/<id>.json`, que genera el paso estaciones de `scripts/procesar_rio.py`. Si un río no tiene ese archivo, el selector queda deshabilitado, avisa que el río todavía no tiene estaciones y el río suena con los valores del año entero de `datos/<id>.json`. Hoy lo tienen los diez ríos. El cambio es sutil, sobre todo en la amplitud, porque el nivel sobre el mar y el ancho cambian poco de una estación a otra frente a lo que cambian a lo largo del río.

## Normalización

El botón Scale del panel (o la tecla N) alterna entre dos formas de llevar cada característica a 0 a 1, que es lo que maneja el sonido y el grosor del río en el mapa.

| Modo | Cómo normaliza | Para qué sirve |
| --- | --- | --- |
| Propia | Percentiles 5 y 95 de los valores medidos en ese río | Cada río usa todo el rango sonoro, se escuchan bien sus diferencias internas |
| Global | Rangos fijos iguales para todos los ríos | Se puede comparar un río con otro, uno más ancho suena más ancho |

Cada tramo trae las dos y `demo.js` hace que `tramo.norma` apunte a la elegida, así `sonido.js` no sabe nada del modo. Al cambiar no se corta lo que está sonando, el cambio entra en la nota siguiente. Las barras del panel y el grosor del río se actualizan al instante.

## Qué suena

El río suena como una orquesta de instrumentos grabados. Cada característica del tramo más cercano maneja una familia de instrumentos. Todos tocan en el mismo tempo (80 bpm) y sobre la misma progresión en re menor, así el conjunto siempre suena musical.

| Tecla | Característica | Instrumentos | Qué cambia |
| --- | --- | --- | --- |
| 1 | Ancho mediano | Chelos, violas y violines | Un río angosto suena con los chelos solos y uno ancho con el acorde completo y más brillo. El acorde se vuelve a atacar en cada compás, pisando un poco el anterior, como un cambio de arco |
| 2 | Nivel mediano | Fagot, clarinete, oboe y flauta | Más alto el pelo de agua, más aguda la melodía, y la madera cambia según el nivel. Cada tramo tiene su propio motivo |
| 3 | Pendiente | Arpa y timbal | Más pendiente, más notas de arpa por compás. El timbal marca la fundamental del acorde |
| 4 | Amplitud | Contrabajo y cornos | Cuanto más sube y baja el agua, más se mueve el contrabajo y más crecen los cornos en cada compás |

### Lógica musical

El botón Music del panel (o la tecla M) pasa por tres formas de llevar los datos a notas. Lo que está sonando no se corta, el cambio entra en la nota siguiente. Si la orquesta está en fermata, la rearma con las alturas nuevas.

| Modo | Melodía (maderas) | Cuerdas | Arpa | Contrabajo |
| --- | --- | --- | --- | --- |
| Original | Nivel. La nota base va de re3 a do5 (22 semitonos) y el motivo de cada tramo le suma saltos de hasta una octava | Ancho, de 1 a 6 voces y más brillo | Pendiente, más notas por compás en un registro fijo | Amplitud, tres patrones |
| Dos octavas | Nivel. La nota base va de re3 a re5 y el motivo queda como un adorno de hasta dos notas de la escala | Ancho, igual que en original | Pendiente, más notas y además un registro que sube de la2 a la4 | Amplitud, tres patrones |
| Relieve | Ancho. Dos octavas de la escala menor, de re3 a re5, sin saltos al azar (el motivo solo pone el ritmo). Las notas que rozan el acorde a un semitono pasan a la nota vecina | Nivel, de 1 a 6 voces y más brillo | Pendiente, más notas por compás, siempre arriba de la melodía para no taparla | Amplitud, de 1 a 8 notas por compás |

El modo relieve sale de los experimentos de `pruebas/experimentos_sonido.js`. El nivel es la altura del agua sobre el mar y baja parejo hacia la desembocadura (su correlación con el kilómetro es 0,98 en el Paraná y 0,96 en el Mississippi). Entre dos tramos vecinos cambia una cincuentava parte de un grado de la escala, así que con el nivel en la melodía se escucha dónde estás en el río pero no cómo es cada tramo. En relieve el nivel pasa a las cuerdas, que dan el color de fondo, y la melodía toma el ancho, que sí cambia de un tramo al vecino. Con relieve, las teclas 1 y 2 siguen prendiendo y apagando el ancho y el nivel, que ahora suenan en las maderas y en las cuerdas, y el panel lo muestra.

La obra está en re menor, por eso los rangos van de re a re. Los parámetros de cada modo están en `MUSICAS`, al principio de `sonido.js`.

### Experimentos

```bash
node pruebas/experimentos_sonido.js            # los dos ríos
node pruebas/experimentos_sonido.js parana     # uno solo
```

Carga `sonido.js` tal cual con un Web Audio falso que anota cada nota, simula el cuadrado quedándose en cada tramo y barriendo el cauce a 2, 6 y 20 tramos por segundo, y muestra una tabla con las tres músicas lado a lado. Mide, entre otras cosas, si la melodía ordena bien los tramos, cuánto salta dentro de un mismo tramo, si se oye el detalle local al barrir, cuántas notas rozan el acorde o quedan tapadas por el arpa y cuántas densidades distintas toma el bajo. No suena nada y tarda unos segundos.

Cada tramo que cruza el cuadrado dispara una nota de la melodía en la semicorchea siguiente, así que la melodía nunca va más rápido que una nota por semicorchea (5,3 por segundo a 80 bpm) y queda siempre a tiempo con el resto de la orquesta. Para no saltear tramos cuando el mouse va rápido, `demo.js` recorre de a un píxel el camino entre un cuadro de animación y el siguiente. Si en una misma semicorchea se cruzan varios tramos suena una sola nota que los resume, con el promedio del ancho y del nivel y el máximo de la pendiente y la amplitud, para que un pico no se pierda. Mientras el cuadrado sigue dentro del mismo tramo, la melodía toca el motivo del tramo en corcheas. La forma de resumir cada característica es `RESUMEN` en `sonido.js`.

El volumen cae en forma logarítmica con la distancia al río, como un sonido real que se aleja. Fuera del cuadrado, cada vez que se duplica la distancia (más 30 px de referencia) el volumen baja 10 dB, y a partir de -36 dB, unos 330 px, ya no suena. Se ajusta con `REFERENCIA_PX`, `DB_POR_DUPLICACION` y `PISO_DB` en `demo.js`. La barra de cercanía muestra esos decibeles llevados a una escala de 0 a 1.

La distancia al río, además de bajar el volumen, apaga los agudos y suma sala, como escuchar el ensayo desde el pasillo. Esto sigue la cercanía en decibeles, así el timbre cambia parejo.

Si el cuadrado queda quieto más de 350 ms, la orquesta hace una fermata sobre el acorde que estaba sonando. Las cuerdas sostienen el acorde, la madera del nivel y el arpa tocan la nota del nivel, y el contrabajo y un corno la fundamental. Cada nota suena hasta que su grabación se apaga del todo y ahí se vuelve a disparar, en bucle. Al volver a moverlo vuelve la música. El tiempo de espera es `ESPERA_QUIETO_MS` en `demo.js`.

Lo que está en gris en el mapa tiene valores interpolados y suena igual que lo medido. La geometría es siempre la de SWORD, nunca se inventa. En el Paraná son 65 tramos.

En el Paraná, los huecos del cauce principal se cierran con tramos reales de SWORD que no se llaman Paraná (figuran como no_data) y cuyas respuestas de Hydrocron están en `datos/crudo_huecos`. Para cada hueco, `preparar_demo.py` busca el camino más corto de tramos que se tocan entre las dos puntas. Si no hay camino, el hueco queda abierto. Hoy son 8 huecos y se cierran todos, con 72 tramos que en su mayoría son de embalse. Los más grandes son los de Itaipú (188 km entre Foz do Iguaçu y Guaíra) y Porto Primavera (221 km aguas arriba). Los brazos del Delta (topología dudosa) no se unen.

Los tramos sin pasadas buenas toman sus valores interpolando linealmente entre los tramos con datos de aguas arriba y aguas abajo, según la distancia a la desembocadura. Son 22 de los tramos llamados Paraná (casi todos en los embalses de Yacyretá e Itaipú) y 43 de los que cierran huecos.

Un tramo sin ningún dato no suena, pero con la interpolación ya no queda ninguno.

## Archivos

```
index.html, estilos.css   interfaz, las tres vistas
app.js                    navegación entre vistas, bienvenida y menú de ríos sobre el planisferio
rios.js                   orden y nombres en inglés de los ríos del menú, y nombres en inglés de algunas ciudades
mundo.js                  contorno del planisferio y punto de cada río (lo genera scripts/generar_mundo.py)
datos/                    un .json por río más indice.json (lo genera el pipeline de scripts/)
pruebas/                  datos de prueba, con el mismo formato (los genera pruebas/generar_pruebas.py), y experimentos_sonido.js
tramos.js                 formato viejo del Paraná, la demo ya no lo usa
mapa.js                   proyección, zoom, minimapa, dibujo y campo de distancias al río (Mapa.cargar arma todo para un río)
sonido.js                 sampler y orquesta con Web Audio
locucion.js               presentación hablada de cada río, con fallback a la voz del navegador y ducking de la orquesta
audios/                   locuciones es/ y en/ y textos.js (lo genera scripts/generar_voces.py), la interfaz usa en/
demo.js                   tablero del río: carga, selectores de río y estación, normalización, música, zoom, cuadrado, panel y teclado
manos.js, manos.css       control con las manos por la cámara (MediaPipe en el navegador), y su cuadro en el pie del panel
muestras/                 grabaciones de VSCO 2 CE e índice (lo genera scripts/preparar_muestras.py)
fuentes/                  Archivo, copiada de app_video/fuentes
```

## Cómo regenerar el planisferio

```bash
cd scripts
python generar_mundo.py <ruta a land-50m.json>
```

`land-50m.json` es el TopoJSON de tierras de Natural Earth (dominio público) del paquete world-atlas, en https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json. El script proyecta con Miller, saca la Antártida, simplifica el contorno y escribe `mundo.js` (unos 160 KB) con el punto medio del cauce de cada río de `datos/indice.json`. Hay que volver a correrlo al agregar un río, para que tenga su etiqueta en el menú.

## Cómo regenerar los datos

Los archivos de `datos/` los genera el pipeline de `scripts/`, uno por río. Hasta que ese pipeline escriba el formato nuevo, `scripts/preparar_demo.py` sigue generando `tramos.js` con el formato viejo, que la demo ya no lee.

Los datos de prueba se rehacen con

```bash
cd pruebas
python generar_pruebas.py
```

`pruebas/parana.json` es el `tramos.js` de siempre pasado al formato nuevo, con `normas.propia` igual a la normalización original. Su `normas.global` sale de unos rangos inventados (`ESCALAS_PRUEBA` en el script), pensados solo para que el cambio se escuche. `pruebas/sintetico.json` es un río inventado, con un embalse interpolado, un tramo que cierra un hueco, un valor suavizado y un tramo sin datos, para probar el cambio de río y los campos opcionales.

Para el Paraná, `preparar_demo.py` lee `datos/tramos.geojson` y `datos/crudo_huecos`, cierra los huecos del cauce con tramos de SWORD, simplifica la geometría, corrige 15 valores físicamente raros (anchos menores a 300 m en pleno cauce, pendientes de más de 30 cm/km al pie de las represas, amplitudes de más de 20 m) con la mediana de los vecinos, interpola los tramos sin datos y normaliza cada métrica entre 0 y 1 (percentiles 5 y 95 de los valores medidos, en escala logarítmica para ancho, nivel y amplitud). En el panel los valores corregidos aparecen como suavizados, junto con lo que midió SWOT.

## Cómo funciona el sampler

Cada instrumento está grabado cada tres o cuatro semitonos. Para tocar una nota, `sonido.js` busca la grabación más cercana y la reproduce más rápido o más lento hasta llegar a la altura justa, 2^(1/12) veces por semitono. Las grabaciones son de la capa de dinámica suave de cada instrumento.

## Cómo regenerar las muestras

```bash
cd scripts
python preparar_muestras.py
```

Necesita git y ffmpeg. Baja del repo de [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) (Versilian Studios, licencia CC0) solo los archivos que usa la demo, lee de los SFZ qué nota es cada grabación, recorta el silencio inicial, limita cada grabación a 9 segundos con un fundido final, empareja el volumen de los instrumentos y escribe los mp3 en `muestras/` junto con `muestras/indice.js`. Pesan unos 12 MB. Los instrumentos y sus rangos se cambian en `INSTRUMENTOS`, al principio del script.
