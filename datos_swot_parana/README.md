# Datos SWOT del río Paraná

Niveles, anchos, superficies y pendientes del Paraná medidos por el satélite SWOT, bajados de la API [Hydrocron](https://podaac.github.io/hydrocron/) de PO.DAAC (NASA), con cinco mapas hechos a partir de ellos. Qué significa cada archivo y cada columna está en [GLOSARIO.md](GLOSARIO.md).

## Estructura

```
datos/
  crudo/<reach_id>.json   respuesta original de Hydrocron por tramo (176 tramos)
  crudo_huecos/           86 tramos de SWORD sin nombre que cierran los huecos del cauce (los usa solo la demo)
  observaciones.csv       una fila por tramo y pasada
  metricas.csv            una fila por tramo con las métricas de los mapas
  tramos.geojson          geometría de los tramos con sus métricas
demo/                     mapa sonoro para recorrer el río con el mouse (abrir demo/index.html)
mapas/                    nivel_mediano, amplitud, ancho_mediano, superficie_mediana y pendiente, en .html y .png
scripts/
  mapas_rio.py            baja los datos de Hydrocron y hace los mapas (necesita internet)
  exportar_datos.py       arma los .csv y el .geojson a partir de datos/crudo
  generar_mapas.py        rehace los cinco mapas desde datos/, sin internet
  preparar_demo.py        arma demo/tramos.js con datos/tramos.geojson y datos/crudo_huecos
```

## Cómo regenerar

Necesita Python 3.9 o más y `pip install requests pandas numpy matplotlib folium`.

```bash
cd scripts
python exportar_datos.py
python generar_mapas.py
```

Para actualizar con pasadas nuevas hay que volver a consultar la API con `python mapas_rio.py --variables nivel_mediano amplitud ancho_mediano superficie_mediana pendiente`. Ese script guarda su caché en `scripts/cache_hydrocron` y deja los mapas en `scripts/mapas`. Para que el resto use los datos nuevos, copiá esas respuestas a `datos/crudo` con el nombre `<reach_id>.json`.

## Fuente

Surface Water and Ocean Topography (SWOT), SWOT Level 2 River Single-Pass Vector Data Product, Version D, PO.DAAC, https://doi.org/10.5067/SWOT-RIVERSP-D, consultado vía Hydrocron el 14 de noviembre de 2026. Tramos definidos por SWORD v17b.
