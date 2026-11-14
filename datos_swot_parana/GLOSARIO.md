# Glosario de los datos del Paraná (SWOT vía Hydrocron)

Este glosario explica cada archivo de `datos/` y cada columna que contienen. Las definiciones de los campos de SWOT son traducciones de los metadatos oficiales del producto de ríos (SWOT L2_HR_RiverSP, versión D). El diccionario completo de todo lo que puede devolver la API está en el documento [Diccionario de datos de Hydrocron (SWOT)](https://claude.ai/artifact/4cbxPBgNhXRZox8T9QxZFQ).

## Conceptos

**Tramo (reach).** Segmento de río de unos 10 km definido en SWORD, la base de ríos que usa SWOT. Esta carpeta tiene los 176 tramos que SWORD llama Parana o Parana River, desde el Delta hasta Brasil.

**Pasada.** Cada vez que el satélite pasa sobre un tramo. La órbita repite cada 21 días, pero como las franjas se superponen un mismo tramo puede verse dos o tres veces por ciclo.

**Pasada buena.** Pasada con `reach_q` igual a 0 o 1 y nivel válido. Las métricas y los mapas usan solo estas.

**Tipo de tramo.** Lo indica el último dígito del `reach_id`. 1 río, 3 lago o embalse sobre el río, 4 presa, 5 río con topología dudosa, 6 tramo fantasma.

**Geoide.** Superficie de referencia de las alturas, parecida al nivel medio del mar. Todos los niveles están referidos a él.

## datos/crudo/

Una respuesta de Hydrocron por tramo, tal como la devolvió la API, con nombre `<reach_id>.json`. Es la fuente de todo lo demás. Viene en formato GeoJSON compacto, con cada campo como lista de valores (uno por pasada) y la geometría del tramo una sola vez. Los valores faltantes vienen como `-999999999999.0` y las pasadas sin observación tienen `time_str` igual a `no_data`.

Período descargado, del 15 de julio de 2023 al 14 de noviembre de 2026.

## datos/observaciones.csv

Una fila por tramo y pasada. Los faltantes ya están como celdas vacías.

| Columna | Unidad | Significado |
| --- | --- | --- |
| `reach_id` | | ID del tramo en SWORD, formato CBBBBBRRRRT (continente, cuenca, tramo, tipo). |
| `tipo` | | Tipo de tramo según el último dígito del ID. |
| `time_str` | | Fecha y hora UTC de la medición. `no_data` si en esa pasada no hubo observación. |
| `wse` | m | Nivel del pelo de agua del tramo sobre el geoide, con correcciones atmosféricas, de calibración y de mareas aplicadas. |
| `wse_u` | m | Incertidumbre total (1 sigma) de `wse`. |
| `width` | m | Ancho del río en el tramo. |
| `slope` | m/m | Pendiente del pelo de agua. Positiva cuando el nivel baja hacia aguas abajo. |
| `area_total` | m² | Superficie de agua del tramo, incluyendo agua oscura (agua que no devolvió señal pero que se completa con un mapa previo de probabilidad de agua). |
| `reach_q` | | Calidad resumen. 0 bueno, 1 sospechoso, 2 degradado, 3 malo. |
| `dark_frac` | 1 | Fracción del área cubierta por agua oscura. |
| `p_dist_out` | m | Distancia a lo largo del río desde el centro del tramo hasta la desembocadura, según SWORD. |
| `p_wse` | m | Nivel de referencia del tramo en SWORD. |
| `p_width` | m | Ancho de referencia del tramo en SWORD. |
| `p_lat`, `p_lon` | grados | Latitud y longitud del centro del tramo según SWORD. |
| `river_name` | | Nombre del río en SWORD. |

Las columnas que empiezan con `p_` no son mediciones de SWOT. Son atributos fijos de SWORD y se repiten igual en todas las filas de un tramo.

## datos/metricas.csv

Una fila por tramo con los valores que pintan los mapas. Se calculan sobre las pasadas buenas de `observaciones.csv`.

| Columna | Unidad | Significado |
| --- | --- | --- |
| `reach_id` | | ID del tramo. |
| `nombre` | | Nombre del río en SWORD. |
| `tipo` | | Tipo de tramo. |
| `dist_km` | km | Distancia a la desembocadura. |
| `lat`, `lon` | grados | Centro del tramo. |
| `p_width` | m | Ancho de referencia en SWORD. |
| `pasadas_observadas` | | Pasadas con fecha válida, de cualquier calidad. |
| `pasadas_buenas` | | Pasadas con `reach_q` 0 o 1 y nivel válido. |
| `nivel_mediano` | m | Mediana de `wse`. Mapa 1. |
| `amplitud` | m | Percentil 95 de `wse` menos percentil 5. Mide cuánto sube y baja el agua sin que pesen los valores extremos. Mapa 2. |
| `ancho_mediano` | m | Mediana de `width`. Mapa 5. |
| `superficie_mediana` | km² | Mediana de `area_total`, pasada de m² a km². Mapa 7. |
| `pendiente` | cm/km | Mediana de `slope`, pasada de m/m a cm/km (multiplicada por 100.000). Mapa 8. |

Las métricas quedan vacías en los tramos sin ninguna pasada buena (22 de 176, casi todos dentro de los embalses de Yacyretá e Itaipú).

## datos/tramos.geojson

La línea de cada tramo (coordenadas longitud, latitud en WGS84) con las columnas de `metricas.csv` como propiedades. Se puede abrir en QGIS, geojson.io o cargar directo en una app web.

## mapas/

Un `.html` interactivo y un `.png` por métrica (`nivel_mediano`, `amplitud`, `ancho_mediano`, `superficie_mediana`, `pendiente`). Los tramos en gris no tienen pasadas buenas. En el `.html`, al pasar el mouse por un tramo se ve su ID, tipo, distancia a la desembocadura, pasadas buenas, nivel y ancho medianos y el valor del mapa.
