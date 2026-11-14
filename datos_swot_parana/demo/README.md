# Demo del mapa sonoro de ríos

Prototipo para "leer" un río con el mouse. Sirve para cualquier río que tenga sus datos en `datos/`, sin tocar código. Un cuadrado sigue al mouse sobre el mapa. Si toca el río suena fuerte, a medida que se aleja baja el volumen, y el paneo estéreo indica hacia qué lado quedó el río. Es la base para después reemplazar el mouse por la mano.

## Cómo abrirla

La demo lee las muestras de la orquesta con `fetch`, y el navegador no lo permite desde una dirección `file://`. Por eso hay que abrirla desde un servidor local. En esta carpeta corré

```bash
python -m http.server
```

y entrá a http://localhost:8000 con Chrome o Edge. No necesita internet. La portada muestra el avance mientras se cargan los instrumentos, y el primer clic o tecla habilita el audio. Con auriculares se nota mucho mejor el paneo.

La dirección acepta tres parámetros, y se pueden combinar.

| Parámetro | Qué hace |
| --- | --- |
| `?rio=<id>` | Abre ese río. Sin el parámetro abre el primero del índice |
| `?normalizacion=global` | Arranca con la normalización global. Sin el parámetro arranca con la propia |
| `?carpeta=pruebas` | Lee los datos de `pruebas/` en lugar de `datos/` |

Por ejemplo http://localhost:8000/?carpeta=pruebas&rio=sintetico&normalizacion=global. La dirección se actualiza sola al cambiar de río o de normalización, así se puede copiar y compartir.

Si `datos/` todavía no tiene datos, la portada lo avisa. Mientras tanto se puede probar con `?carpeta=pruebas`.

## Ríos y datos

El selector de río, debajo del título, lista los ríos de `datos/indice.json`. Se maneja con el mouse o con el teclado (Tab hasta el selector y flechas), y al cambiar de río se anuncia para lectores de pantalla. Al cambiar, se corta lo que estaba sonando y la orquesta arranca de nuevo con el río nuevo. Las capas prendidas y apagadas y la normalización elegida se mantienen.

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

## Normalización

El botón N del panel (o la tecla N) alterna entre dos formas de llevar cada característica a 0 a 1, que es lo que maneja el sonido y el grosor del río en el mapa.

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
| 5 | Tramos cruzados | Triángulo | Suena un golpe cada 10 tramos cruzados, en la semicorchea siguiente. La barra del panel se llena a medida que cruzás tramos |

Cada tramo que cruza el cuadrado dispara una nota de la melodía en la semicorchea siguiente, así que la melodía nunca va más rápido que una nota por semicorchea (5,3 por segundo a 80 bpm) y queda siempre a tiempo con el resto de la orquesta. Para no saltear tramos cuando el mouse va rápido, `demo.js` recorre de a un píxel el camino entre un cuadro de animación y el siguiente. Si en una misma semicorchea se cruzan varios tramos suena una sola nota que los resume, con el promedio del ancho y del nivel y el máximo de la pendiente y la amplitud, para que un pico no se pierda. Mientras el cuadrado sigue dentro del mismo tramo, la melodía toca el motivo del tramo en corcheas. La forma de resumir cada característica es `RESUMEN` en `sonido.js`.

El triángulo no usa grabaciones, se sintetiza con los cuatro primeros modos de vibración de una barra metálica, cada uno con su decaimiento y un batido leve, más un golpe corto de ruido. Cada cuántos tramos suena es `TRIANGULO_CADA` y su volumen `TRIANGULO_NIVEL`, los dos en `sonido.js`. Si en una semicorchea se completan los tramos de más de un golpe, suena uno solo.

El volumen cae en forma logarítmica con la distancia al río, como un sonido real que se aleja. Fuera del cuadrado, cada vez que se duplica la distancia (más 30 px de referencia) el volumen baja 10 dB, y a partir de -36 dB, unos 330 px, ya no suena. Se ajusta con `REFERENCIA_PX`, `DB_POR_DUPLICACION` y `PISO_DB` en `demo.js`. La barra de cercanía muestra esos decibeles llevados a una escala de 0 a 1.

La distancia al río, además de bajar el volumen, apaga los agudos y suma sala, como escuchar el ensayo desde el pasillo. Esto sigue la cercanía en decibeles, así el timbre cambia parejo.

Si el cuadrado queda quieto más de 350 ms, la orquesta hace una fermata sobre el acorde que estaba sonando. Las cuerdas sostienen el acorde, la madera del nivel y el arpa tocan la nota del nivel, y el contrabajo y un corno la fundamental. Cada nota suena hasta que su grabación se apaga del todo y ahí se vuelve a disparar, en bucle. Al volver a moverlo vuelve la música. El tiempo de espera es `ESPERA_QUIETO_MS` en `demo.js`.

Lo que está en gris en el mapa tiene valores interpolados y suena igual que lo medido. La geometría es siempre la de SWORD, nunca se inventa. En el Paraná son 65 tramos.

En el Paraná, los huecos del cauce principal se cierran con tramos reales de SWORD que no se llaman Paraná (figuran como no_data) y cuyas respuestas de Hydrocron están en `datos/crudo_huecos`. Para cada hueco, `preparar_demo.py` busca el camino más corto de tramos que se tocan entre las dos puntas. Si no hay camino, el hueco queda abierto. Hoy son 8 huecos y se cierran todos, con 72 tramos que en su mayoría son de embalse. Los más grandes son los de Itaipú (188 km entre Foz do Iguaçu y Guaíra) y Porto Primavera (221 km aguas arriba). Los brazos del Delta (topología dudosa) no se unen.

Los tramos sin pasadas buenas toman sus valores interpolando linealmente entre los tramos con datos de aguas arriba y aguas abajo, según la distancia a la desembocadura. Son 22 de los tramos llamados Paraná (casi todos en los embalses de Yacyretá e Itaipú) y 43 de los que cierran huecos.

Un tramo sin ningún dato no suena, pero con la interpolación ya no queda ninguno.

## Archivos

```
index.html, estilos.css   interfaz
datos/                    un .json por río más indice.json (lo genera el pipeline de scripts/)
pruebas/                  datos de prueba, con el mismo formato (los genera pruebas/generar_pruebas.py)
tramos.js                 formato viejo del Paraná, la demo ya no lo usa
mapa.js                   proyección, dibujo y campo de distancias al río (Mapa.cargar arma todo para un río)
sonido.js                 sampler y orquesta con Web Audio
demo.js                   carga de ríos, selector, normalización, cuadrado, panel y teclado
muestras/                 grabaciones de VSCO 2 CE e índice (lo genera scripts/preparar_muestras.py)
fuentes/                  Archivo, copiada de app/fuentes
```

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
