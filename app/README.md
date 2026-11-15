# Datos SWOT de ríos de SWORD

Niveles, anchos, superficies y pendientes de ríos medidos por el satélite SWOT, bajados de la API [Hydrocron](https://podaac.github.io/hydrocron/) de PO.DAAC (NASA), con mapas y los datos de la demo del mapa sonoro. Cualquier río de SWORD se procesa con un solo comando a partir de un archivo de configuración. Hoy hay diez ríos, elegidos con el criterio que se explica en [Qué ríos hay y por qué](#qué-ríos-hay-y-por-qué). Qué significa cada archivo y cada columna está en [GLOSARIO.md](GLOSARIO.md).

Se procesa solo el cauce principal, sin afluentes, y la geometría es siempre la de SWORD.

## Qué ríos hay y por qué

Son, aproximadamente, los diez ríos de mayor caudal medio del mundo. Se cuentan los ríos que desembocan en el mar y se dejan afuera los afluentes, como el Madeira o el Negro, que tienen más caudal que varios de esta lista pero desembocan en el Amazonas.

| Río | Caudal medio aproximado (m³/s) | Tramos descargados |
| --- | ---: | ---: |
| Amazonas | 209.000 | 424 |
| Congo | 41.000 | 216 |
| Ganges | 38.000 (junto con el Brahmaputra) | 277 |
| Orinoco | 33.000 | 161 |
| Yangtsé | 30.000 | 226 |
| Yenisei | 19.600 | 69 |
| Paraná | 17.000 a 18.000 | 262 |
| Lena | 17.000 | 426 |
| Mississippi | 16.800 | 489 |
| Mekong | 16.000 | 213 |

Los caudales son órdenes de magnitud y sirven solo para ordenar la lista. Cambian según la fuente y el período medido, y del Yenisei para abajo las diferencias son tan chicas que el orden entre esos ríos depende de la fuente que se use. Hay dos salvedades.

- **Ganges.** Los 38.000 m³/s son del sistema Ganges-Brahmaputra, que desemboca en un delta común. Si se contara el Brahmaputra como río aparte (unos 20.000 m³/s), entraría en la lista antes que el Paraná. Acá se toma el sistema como uno solo y se procesa el cauce del Ganges.
- **Los que siguen.** Los siguientes en la lista son el Irrawaddy y el Ob, con unos 13.000 m³/s cada uno. Se agregan como cualquier otro río, siguiendo [Cómo agregar un río nuevo](#cómo-agregar-un-río-nuevo).

La cantidad de tramos depende del largo del cauce en SWORD y de cuántos tramos tiene Hydrocron, no del caudal.

## Cómo agregar un río nuevo

1. **Buscá el tramo de la desembocadura** con `python buscar_desembocadura.py "<nombre en SWORD>"` desde `scripts/` (por ejemplo `"Mississippi River"`). Parte del tramo con ese nombre más cercano al mar, baja por el vecino de mayor `facc` hasta el último tramo e imprime la línea de `seleccion` lista para copiar. Conviene mirar en un mapa que el punto sea la boca del río.
2. **Escribí `rios/<id>.json`.** Alcanza con esto:

   ```json
   {
     "id": "mississippi",
     "nombre": "Mississippi",
     "seleccion": {"modo": "topologia", "desembocadura": "74300100016"},
     "ciudades": [["Nueva Orleans", 29.95, -90.07], ["San Luis", 38.63, -90.2]],
     "criterios": {"modo": "relativos"}
   }
   ```

   El `id` tiene que coincidir con el nombre del archivo. `etiquetas_a_la_izquierda` y `ciudades_solo_mapas` son opcionales, y si no ponés `criterios` se usan los relativos. Ese es, recortado, el `rios/mississippi.json` real.
3. **Corré `python procesar_rio.py <id>`** desde `scripts/`. Baja lo que haga falta, deja los datos en `datos/<id>/`, los mapas en `mapas/<id>/`, la demo en `demo/datos/<id>.json` y suma el río a `demo/datos/indice.json`.

La primera vez que se procesa un río de un continente se baja una sola vez el GeoPackage de tramos de SWORD v17b de ese continente (de 130 a 330 MB comprimido, según el continente). Si alguno pesara más de 1 GB, el proceso para y avisa sin bajarlo.

## Estructura

```
rios/
  <id>.json               configuración de cada río
  escalas_globales.json   rangos fijos de la normalización global, iguales para todos los ríos
datos/
  <id>/crudo/<reach_id>.json   respuesta original de Hydrocron por tramo (caché)
  <id>/seleccion.json          tramos del cauce, candidatos para cerrar huecos y tramos que solo están en SWORD
  <id>/observaciones.csv       una fila por tramo y pasada
  <id>/metricas.csv            una fila por tramo con las métricas de los mapas
  <id>/tramos.geojson          geometría de los tramos con sus métricas
  cache_sword/                 índice de SWORD Explorer y GeoPackages de SWORD v17b (fuera de git)
  crudo_huecos/                copia histórica de los tramos que cierran los huecos del Paraná (ya están en datos/parana/crudo)
mapas/<id>/               nivel_mediano, amplitud, ancho_mediano, superficie_mediana y pendiente, en .html y .png
demo/                     mapa sonoro (abrir demo/index.html), lee demo/datos/<id>.json
demo/datos/estaciones/    <id>.json, los datos de la demo por estación del año (paso estaciones)
scripts/
  procesar_rio.py         punto de entrada, procesar_rio.py <id> [--pasos bajar exportar mapas demo] [--actualizar]
  exportar_datos.py       solo el paso exportar
  generar_mapas.py        solo el paso mapas, con --variables y --sin-png
  preparar_demo.py        solo el paso demo
  mapas_rio.py            mapas de cualquier variable, incluidas las anomalías de un período (--desde, --hasta)
  buscar_desembocadura.py tramo de desembocadura de un río, por nombre
  probar_regresion.py     comprueba que el Paraná da lo mismo que antes de la reorganización
  preparar_muestras.py    muestras orquestales de la demo
  swot/                   paquete con la lógica, módulos hydrocron, sword, metricas, mapas, demo y pasos
```

## Cómo se procesa

Necesita Python 3.9 o más y `pip install requests pandas numpy matplotlib folium`.

```bash
cd scripts
python procesar_rio.py parana                    # los cuatro pasos
python procesar_rio.py parana --pasos demo       # solo la demo, sin red
python procesar_rio.py mississippi --pasos estaciones  # la demo por estación del año, sin red
python procesar_rio.py parana --actualizar       # vuelve a bajar todo de Hydrocron con las pasadas nuevas
python probar_regresion.py                       # verifica el Paraná contra el commit 9fe5bb5
```

**bajar.** Elige los tramos del cauce y los baja a `datos/<id>/crudo/<reach_id>.json`. La clave de la caché es solo el `reach_id`, sin la fecha de fin, así que lo que ya está no se vuelve a pedir salvo con `--actualizar`. La selección tiene dos modos.

- `{"modo": "ids", "ids": [...], "ids_huecos": [...]}` usa exactamente esa lista. Es el modo del Paraná, con los 176 tramos que SWORD llama Parana y los 86 que cierran sus huecos.
- `{"modo": "topologia", "desembocadura": <reach_id>}` sube desde la desembocadura por el vecino aguas arriba (`rch_id_up`) de mayor área de aporte (`facc`) hasta la naciente. Los afluentes quedan afuera. El índice de SWORD Explorer no trae topología, por eso se usa el GeoPackage oficial de v17b. El `facc` de SWORD tiene errores puntuales, como brazos que salen del río con el `facc` del río entero o rachas de tramos del cauce con `facc` casi cero. Para que un valor aislado no desvíe el camino, el `facc` de cada vecino se toma como el percentil 75 de los `facc` de los próximos 20 tramos de su cadena aguas arriba, y los empates se resuelven con `path_freq`. Los tramos que Hydrocron no tiene se dibujan con su geometría de SWORD y sus valores se interpolan.

En los dos modos, si queda un hueco entre tramos consecutivos del cauce se cierra con el camino más corto (Dijkstra) de tramos reales de SWORD que se tocan. Los candidatos son los de `ids_huecos` o, si no se dan, los tramos de SWORD que caen cerca del hueco.

**exportar.** Escribe `observaciones.csv`, `metricas.csv` y `tramos.geojson` con las pasadas buenas (`reach_q` 0 o 1 y nivel válido).

**mapas.** Un `.html` interactivo y un `.png` por métrica.

**demo.** Corrige los valores raros con la mediana de los vecinos, interpola los tramos sin datos a lo largo del cauce según `dist_km`, normaliza y escribe `demo/datos/<id>.json`. Los criterios para decidir qué es raro son de dos tipos.

| | `absolutos` (Paraná) | `relativos` (por defecto) |
| --- | --- | --- |
| Ancho raro | fuera de `rangos.ancho` (el Paraná usa más de 300 m) | fuera de 0,3 a 3 veces `p_width` de SWORD |
| Pendiente y amplitud raras | fuera de `rangos` (±30 cm/km, hasta 20 m) | z robusto (con la MAD) mayor a 3,5 respecto de los 10 vecinos más cercanos a lo largo del cauce. La MAD tiene un piso de 1 cm/km y 0,25 m, del orden del ruido de SWOT |
| Vecinos para corregir | los 4 más cercanos en el mapa, a menos de 45 km | los 4 más cercanos a lo largo del cauce, a menos de 45 km |
| Escala del nivel | logarítmica | lineal |

Cada métrica se normaliza entre 0 y 1 de dos maneras, y la demo deja elegir con un botón. La `propia` usa los percentiles 5 y 95 de los valores medidos del río, en escala logarítmica para ancho y amplitud (y para nivel con criterios absolutos). La `global` usa los rangos fijos de `rios/escalas_globales.json`, así sumar un río no cambia cómo suenan los otros. Esos rangos (ancho de 100 m a 10 km, nivel de 1 a 2000 m, pendiente de 0 a 25 cm/km y amplitud de 0,5 a 15 m) son órdenes de magnitud de los ríos grandes elegidos a mano, no ajustados a ningún conjunto de datos, y el archivo explica de dónde sale cada uno.

**estaciones.** No corre por defecto, se pide con `--pasos estaciones`. Para cada estación toma solo las pasadas buenas de sus tres meses, de todos los años medidos (verano de junio a agosto, otoño de septiembre a noviembre, invierno de diciembre a febrero y primavera de marzo a mayo en el hemisferio norte, corridos seis meses si `rios/<id>.json` dice `"hemisferio": "sur"`, que por defecto es `"norte"`). Con esas pasadas calcula las mismas cuatro métricas y las pasa por lo mismo que el paso demo. La normalización propia no se recalcula por estación, se usa la del año entero, así las cuatro comparten la escala y suenan distinto. Escribe `demo/datos/estaciones/<id>.json` e imprime, por estación, las pasadas por tramo, cuántos tramos tienen datos, la mediana de cada métrica y cuánto se mueve la norma de cada tramo respecto del año.

## Contrato de demo/datos

```
indice.json  {"rios": [{"id": "parana", "nombre": "Paraná"}, ...]}
<id>.json    {"version": 1, "id", "nombre", "fuente", "unidades": {"ancho", "nivel", "pendiente", "amplitud"},
              "ciudades": [[nombre, lat, lon]],
              "tramos": [{"id", "tipo", "nombre", "de_hueco", "km", "pasadas", "valor",
                          "normas": {"propia": {...}, "global": {...}}, "corregido", "medido", "interpolado",
                          "linea": [[lon, lat]]}]}
estaciones/<id>.json  {"version": 1, "id", "hemisferio",
              "estaciones": {"verano" | "otono" | "invierno" | "primavera": {"meses": [m1, m2, m3],
                "tramos": {"<id del tramo>": {"pasadas", "valor", "normas", "corregido", "medido", "interpolado"}}}}}
```

El archivo de estaciones trae solo lo que cambia con la estación. La geometría y las ciudades están en `<id>.json` y los tramos se emparejan por id.

Los campos de cada tramo significan lo mismo que en el `demo/tramos.js` original. `normas.propia` y `normas.global` tienen las mismas claves que el antiguo `norma`, con valores entre 0 y 1.

## Fuente

Surface Water and Ocean Topography (SWOT), SWOT Level 2 River Single-Pass Vector Data Product, Version D, PO.DAAC, https://doi.org/10.5067/SWOT-RIVERSP-D, consultado vía Hydrocron el 14 de noviembre de 2026. Tramos y topología de SWORD v17b (Altenau y otros, https://doi.org/10.5281/zenodo.15299138).
