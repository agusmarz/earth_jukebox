# Earth Jukebox

Propuesta para el desafío The Earth Information Jukebox del NASA Space Apps Challenge 2026. Es una app web pensada para que una persona ciega pueda elegir un río con la voz y escuchar cómo cambia su caudal, a partir de la visualización [SWOT Mission Unlocks a New View of Our Waterways](https://svs.gsfc.nasa.gov/14990/) del Scientific Visualization Studio de la NASA.

La app arranca con un mapa Mercator con cinco pines (Mississippi, Amazonas, Congo, Ganges y Yangtsé). La voz de la app enumera las opciones, el usuario dice el nombre o el número del río, y la app muestra el tramo del video correspondiente mientras suena la sonificación.

Los cinco pines son los ríos que recorre el video de la NASA. Aparte, en [datos_swot_parana](datos_swot_parana/README.md) están los datos SWOT de diez ríos, aproximadamente los de mayor caudal medio del mundo sin contar afluentes: Amazonas, Congo, Ganges, Orinoco, Yangtsé, Yenisei, Paraná, Lena, Mississippi y Mekong. El criterio y sus salvedades están en [Qué ríos hay y por qué](datos_swot_parana/README.md#qué-ríos-hay-y-por-qué). Esos datos alimentan la demo del mapa sonoro (`datos_swot_parana/demo/`) y todavía no están conectados a la app.

## Demo publicada

El mapa sonoro de ríos está publicado en https://agusmarz.github.io/earth_jukebox/ (Chrome o Edge, mejor con auriculares). Se publica con `.github/workflows/deploy-demo.yml` al pushear un tag `demo-v*`, por ejemplo `git tag -a demo-v2 -m "..." && git push origin demo-v2`. Solo se publica `datos_swot_parana/demo/`, sin `pruebas/`, `README.md` ni `tramos.js`.

## Cómo correrla

No necesita instalar nada más que Python, que se usa como servidor local. Hace falta un servidor porque los navegadores no dejan usar el micrófono ni cargar módulos desde un archivo abierto con doble clic.

```bash
cd app
python -m http.server 8000
```

Después abrí http://localhost:8000 en Chrome o Edge. Safari también reconoce voz, Firefox no por defecto. La primera tecla que apretes habilita el audio y el navegador te va a pedir permiso para el micrófono.

Sin clips locales la app reproduce cada tramo directo desde el video 4K de la NASA, así que necesita internet y puede tardar un poco en arrancar. Para que ande fluido conviene generar los clips (ver Preprocesamiento).

## Cómo se usa

Con la voz se puede decir el nombre o el número de un río, y también pausa, seguir, repetir, describir, opciones y volver. En el mapa la app escucha sola después de hablar. Mientras suena un río el micrófono se abre solo con la barra espaciadora, para que la música no se confunda con lo que decís.

Todo se puede hacer también con el teclado. Barra espaciadora para hablar, flechas para recorrer los ríos y Enter para elegir, números del 1 al 5 para ir directo, P para pausar o seguir, R para repetir, D para la descripción, Escape para volver al mapa, H para la ayuda y V para apagar la voz de la app si preferís usar tu lector de pantalla (en ese modo los anuncios van a una región aria-live).

## Estructura

```
app/
  index.html, estilos.css     pantalla en blanco y negro, tipografía Archivo
  mapa/tierra.svg             tierra en Mercator, generada con preprocesamiento/generar_mapa.mjs
  rios/                       clips recortados de cada río (los genera el preprocesamiento)
  src/
    datos/rios.json           única fuente de verdad, tiempos, coordenadas, alias y descripciones
    estado/maquina.js         flujo de la app y comandos
    voz/hablar.js             síntesis de voz, nunca habla con el micrófono abierto
    voz/escuchar.js           reconocimiento de voz (Web Speech API)
    voz/interpretar.js        texto reconocido a río o comando, tolera errores
    mapa/                     mapa y pines accesibles con teclado
    reproductor/video.js      reproduce el tramo, local o remoto
    sonificacion/motor.js     motor de sonido, por ahora PROVISORIO
    accesibilidad/teclado.js  atajos
preprocesamiento/
  descargar_video.py          baja el video fuente (160 MB)
  hoja_de_contactos.py        grilla de cuadros por río para revisar el material
  recortar_rios.py            genera app/rios/<id>.webm
  generar_mapa.mjs            regenera el mapa si cambia la proyección
```

## Preprocesamiento

Necesita Python 3.9 o más y ffmpeg (en Windows `winget install ffmpeg` o `scoop install ffmpeg`).

```bash
cd preprocesamiento
python descargar_video.py
python hoja_de_contactos.py
python recortar_rios.py
```

Los tiempos de cada río en `rios.json` se ajustaron mirando el video cuadro por cuadro, para que cada clip arranque cuando la cámara ya quedó quieta sobre el río y termine antes de que empiece a moverse hacia el siguiente. Los cinco tramos son solo visualización de datos SWOT. Las imágenes de terceros que la NASA aclara que no se pueden recortar ni remixar no aparecen en esos tramos. Cada tramo recorre en bucle el año hidrológico de octubre de 2023 a septiembre de 2024, con la fecha abajo a la izquierda y la escala de volumen del río abajo a la derecha (blanco es más bajo, azul es más alto). Por eso no hizo falta recortar el cuadro, y el campo `recorte` queda en null.

Si el video está en Descargas con su nombre original, los scripts lo encuentran solos y no hace falta volver a bajarlo.

## Pendiente

Definir la sonificación y reemplazar el motor provisorio, que hoy solo suena un colchón con una tónica distinta por río. La app ya le pasa al motor el tiempo y el progreso de cada cuadro, así que el cambio queda encerrado en `sonificacion/motor.js`. También falta sumar una versión en inglés y probar con usuarios ciegos.

## Créditos

Visualización y datos de NASA Scientific Visualization Studio y la misión SWOT (NASA y CNES). Mapa base de Natural Earth vía world-atlas. Tipografía Archivo bajo licencia SIL Open Font License.
