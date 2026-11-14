# Demo del mapa sonoro del Paraná

Prototipo para "leer" el río con el mouse. Un cuadrado sigue al mouse sobre el mapa. Si toca el río suena fuerte, a medida que se aleja baja el volumen, y el paneo estéreo indica hacia qué lado quedó el río. Es la base para después reemplazar el mouse por la mano.

## Cómo abrirla

La demo lee las muestras de la orquesta con `fetch`, y el navegador no lo permite desde una dirección `file://`. Por eso hay que abrirla desde un servidor local. En esta carpeta corré

```bash
python -m http.server
```

y entrá a http://localhost:8000 con Chrome o Edge. No necesita internet. La portada muestra el avance mientras se cargan los instrumentos, y el primer clic o tecla habilita el audio. Con auriculares se nota mucho mejor el paneo.

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

Lo que está en gris en el mapa es interpolado y suena igual que lo medido. Son dos casos.

Los 22 tramos sin pasadas buenas (casi todos en los embalses de Yacyretá e Itaipú) toman sus valores interpolando linealmente entre los tramos con datos de aguas arriba y aguas abajo, según la distancia a la desembocadura.

Los huecos de geometría entre tramos consecutivos del cauce principal se cierran con puentes rectos partidos en pedazos de unos 10 km, cuyos valores van cambiando linealmente de una punta a la otra. Son 8 huecos. Los más grandes (188 km entre Foz do Iguaçu y Guaíra, y 221 km aguas arriba, en Porto Primavera) corresponden a embalses donde SWORD no tiene tramos con el nombre Paraná. Ahí el río va casi derecho, pero igual es una aproximación. Los brazos del Delta (topología dudosa) no se unen.

Un tramo sin ningún dato no suena, pero con la interpolación ya no queda ninguno.

## Archivos

```
index.html, estilos.css   interfaz
tramos.js                 datos ya preparados (lo genera scripts/preparar_demo.py)
mapa.js                   proyección, dibujo y campo de distancias al río
sonido.js                 sampler y orquesta con Web Audio
demo.js                   cuadrado, panel y teclado
muestras/                 grabaciones de VSCO 2 CE e índice (lo genera scripts/preparar_muestras.py)
fuentes/                  Archivo, copiada de app/fuentes
```

## Cómo regenerar los datos

```bash
cd scripts
python preparar_demo.py
```

Lee `datos/tramos.geojson`, simplifica la geometría, interpola los tramos sin datos, cierra los huecos con puentes, normaliza cada métrica entre 0 y 1 (percentiles 5 y 95 de los valores medidos, en escala logarítmica para ancho, nivel y amplitud) y corrige 12 valores físicamente raros (anchos menores a 300 m en pleno cauce, pendientes de más de 30 cm/km al pie de Itaipú, una amplitud de 29 m) con la mediana de los vecinos. En el panel esos valores aparecen como suavizados, junto con lo que midió SWOT.

## Cómo funciona el sampler

Cada instrumento está grabado cada tres o cuatro semitonos. Para tocar una nota, `sonido.js` busca la grabación más cercana y la reproduce más rápido o más lento hasta llegar a la altura justa, 2^(1/12) veces por semitono. Las grabaciones son de la capa de dinámica suave de cada instrumento.

## Cómo regenerar las muestras

```bash
cd scripts
python preparar_muestras.py
```

Necesita git y ffmpeg. Baja del repo de [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) (Versilian Studios, licencia CC0) solo los archivos que usa la demo, lee de los SFZ qué nota es cada grabación, recorta el silencio inicial, limita cada grabación a 9 segundos con un fundido final, empareja el volumen de los instrumentos y escribe los mp3 en `muestras/` junto con `muestras/indice.js`. Pesan unos 12 MB. Los instrumentos y sus rangos se cambian en `INSTRUMENTOS`, al principio del script.
