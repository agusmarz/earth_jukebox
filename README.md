# Earth Jukebox · The Melody of Water

Propuesta para el desafío The Earth Information Jukebox del NASA Space Apps Challenge 2026. The Melody of Water es una app web para escuchar ríos, pensada para personas ciegas o con baja visión. Usa las mediciones del satélite SWOT (NASA y CNES): cada característica del río la toca una familia de instrumentos de una orquesta. La persona recorre el cauce moviendo la mano frente a la cámara, cambia de estación del año girando el puño y maneja todo con la voz.

Hay diez ríos, que son aproximadamente los de mayor caudal medio del mundo sin contar afluentes: Amazonas, Congo, Ganges, Orinoco, Yangtsé, Yenisei, Paraná, Lena, Mississippi y Mekong. El criterio y sus salvedades están en [Qué ríos hay y por qué](app/README.md#qué-ríos-hay-y-por-qué).

## Demo publicada

https://agusmarz.github.io/earth_jukebox/ (Chrome o Edge, mejor con auriculares). Pide permiso para la cámara y el micrófono, y necesita internet para el control con las manos y el reconocimiento de voz.

Se publica con `.github/workflows/deploy-demo.yml` al pushear un tag `demo-v*`, por ejemplo `git tag -a demo-v3 -m "..." && git push origin demo-v3`. Solo se publica `app/demo/`, sin `pruebas/`, `README.md` ni `tramos.js`, y cada script y estilo lleva la versión del commit para que el navegador no mezcle archivos viejos con nuevos.

## Cómo se usa

La interfaz y las voces están en inglés. La app tiene cuatro vistas.

1. **Bienvenida.** La voz pide apretar la C para prender la cámara. Mientras carga, que tarda unos segundos, suena agua. Cuando la cámara está lista, la voz pide decir "next" con la barra espaciadora apretada. Sin la cámara prendida no se pasa de esta pantalla.
2. **Tutorial.** Enseña los gestos con el Paraná de ejemplo, entre Rosario y Santa Fe, con una nota de voz por pantalla. Cada pantalla reconoce el gesto que enseña y desde el paso del espacio la persona ya hace sonar el río. Se avanza con "next" o Enter, se repite con R y se saltea con Escape. También se abre desde el botón Tutorial del menú o diciendo "tutorial".
3. **Menú de ríos.** Un planisferio con los diez ríos, numerados de mayor a menor caudal. Se elige uno por voz ("go to the Paraná river", "el siete"), con las teclas 1 a 9 y 0 o con un clic.
4. **Tablero del río.** Al entrar, una voz neuronal presenta el río: dónde está, qué países recorre y cuánto mide. Después suena la orquesta.

### Gestos

- **Mano derecha.** Mueve un cuadrado sobre el mapa. Sobre el río suena fuerte, y al alejarse baja el volumen, se apagan los agudos y suma sala. El paneo estéreo indica hacia qué lado quedó el río.
- **Dedos de la mano derecha.** El pulgar, el índice, el medio y el anular prenden y apagan las cuatro capas de la orquesta. Dedo levantado, capa prendida.
- **Mano izquierda.** Con el puño cerrado, cada vuelta completa pasa a la estación siguiente (sentido horario) o a la anterior (antihorario). Una nota de voz dice la estación nueva.

Las manos se siguen con MediaPipe en el navegador. Para no confundir la izquierda con la derecha cuando el puño está cerrado, también corre el modelo de cuerpo, que sabe de qué brazo es cada muñeca.

### Voz y teclado

Se habla con la barra espaciadora apretada y al soltarla la app hace lo pedido y lo confirma en voz alta. Entiende frases en inglés y en castellano, por ejemplo "next", "winter", "width off", "global scale", "two octaves", "zoom in", "repeat", "status", "help" o "menu". Si no está segura del río pregunta ("Did you mean the Ganges? Say yes or no").

Sin cámara, el mouse y las flechas mueven el cuadrado. En el tablero, 1 a 4 prenden y apagan las capas, R repite la presentación, N cambia la normalización, M la lógica musical, + y − hacen zoom, 0 vuelve al río entero y Escape vuelve al menú.

## Qué suena

Cada característica del tramo más cercano al cuadrado maneja una familia de instrumentos. Todos tocan a 80 bpm sobre la misma progresión en re menor, así el conjunto siempre suena musical. Las grabaciones son de VSCO 2 Community Edition.

| Dedo | Característica | Instrumentos |
| --- | --- | --- |
| Pulgar | Ancho del río | Chelos, violas y violines |
| Índice | Nivel del agua sobre el mar | Fagot, clarinete, oboe y flauta |
| Medio | Pendiente | Arpa y timbal |
| Anular | Amplitud (cuánto sube y baja el agua en el año) | Contrabajo y cornos |

Hay tres lógicas musicales (original, dos octavas y relieve) y dos normalizaciones. La propia usa todo el rango sonoro en cada río y la global usa rangos fijos para comparar un río con otro. Las estaciones cambian los valores de cada tramo por los medidos solo en esos tres meses. Los detalles están en [app/demo/README.md](app/demo/README.md#qué-suena).

## Cómo correrla

Solo necesita Python como servidor local, porque el navegador no deja cargar las muestras ni usar la cámara desde un archivo abierto con doble clic.

```bash
cd app/demo
python -m http.server 8000
```

Después abrí http://localhost:8000 en Chrome o Edge. El primer clic o tecla habilita el audio. Firefox no reconoce voz y avisa que se use el teclado.

## Datos

Los niveles, anchos y pendientes por tramo de río salen de la API [Hydrocron](https://podaac.github.io/hydrocron/) de PO.DAAC, con la geometría y la topología de SWORD v17b. Se procesa solo el cauce principal, sin afluentes, y los tramos sin pasadas buenas se interpolan a lo largo del cauce. Cualquier río de SWORD se agrega con un archivo de configuración y un comando.

```bash
cd app/scripts
python procesar_rio.py <id>
```

Eso baja los datos, genera los mapas, los datos de la demo y sus estaciones del año, y suma el río al menú. El paso a paso, los criterios de limpieza y el formato de los archivos están en [app/README.md](app/README.md), y qué significa cada columna en [app/GLOSARIO.md](app/GLOSARIO.md).

## Estructura

```
app/
  demo/               la app web, The Melody of Water (ver su README)
  scripts/            pipeline de datos, muestras orquestales, locuciones y planisferio
  rios/               configuración de cada río y escalas de la normalización global
  datos/              datos SWOT por río (crudo de Hydrocron, observaciones, métricas, geometría)
  mapas/              mapas de cada métrica por río, en .html y .png
app_video/            primer prototipo, con los tramos del video de la NASA
preprocesamiento/     scripts que recortan el video para app_video
manos/                prototipo en Python del control con las manos (MediaPipe), del que sale manos.js
analisis/             notebook con estadísticas de los ríos
```

## Primer prototipo con el video de la NASA

`app_video/` es la primera versión, hecha a partir de la visualización [SWOT Mission Unlocks a New View of Our Waterways](https://svs.gsfc.nasa.gov/14990/) del Scientific Visualization Studio. Muestra un mapa con cinco pines (Mississippi, Amazonas, Congo, Ganges y Yangtsé), la persona elige un río con la voz o el teclado y la app reproduce el tramo del video que corresponde. Su sonificación quedó provisoria y la reemplazó la orquesta de `app/demo/`.

```bash
cd app_video
python -m http.server 8000
```

Sin clips locales reproduce cada tramo directo desde el video 4K de la NASA. Para generarlos hace falta ffmpeg y correr, desde `preprocesamiento/`, `descargar_video.py`, `hoja_de_contactos.py` y `recortar_rios.py`.

## Pendiente

- Probar la app con personas ciegas.
- Sumar la interfaz en castellano. Las locuciones en castellano ya están generadas en `app/demo/audios/es/`, pero la interfaz usa solo las de inglés.
- Revisar los textos de las pantallas 3 y 4 del tutorial, marcados PENDIENTE en `app/scripts/textos_ui.py`.

## Créditos

Datos de la misión SWOT (NASA y CNES), SWOT Level 2 River Single-Pass Vector Data Product, versión D, vía Hydrocron de PO.DAAC. Tramos y topología de SWORD v17b (Altenau y otros). Visualización del primer prototipo de NASA Scientific Visualization Studio. Muestras orquestales de VSCO 2 Community Edition (Versilian Studios, CC0). Seguimiento de manos y cuerpo con MediaPipe (Google). Voces neuronales de Microsoft vía edge-tts. Planisferio de Natural Earth vía world-atlas. Tipografía Archivo bajo licencia SIL Open Font License.
