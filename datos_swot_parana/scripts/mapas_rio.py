"""
Mapas del río Paraná (o de cualquier río de SWORD) con datos de SWOT bajados de Hydrocron.

Genera, para cada variable pedida, un mapa interactivo (HTML con folium) y uno estático (PNG con matplotlib).
Usa la misma carpeta de caché que el notebook, así que si ya lo corriste no vuelve a consultar la API.

Ejemplos
    python mapas_rio.py
    python mapas_rio.py --variables amplitud ancho_mediano pendiente
    python mapas_rio.py --variables anomalia --desde 2024-08-01 --hasta 2024-10-31
    python mapas_rio.py --nombre "Uruguay" --salida mapas_uruguay
    python mapas_rio.py --listar

Dependencias
    pip install requests pandas numpy matplotlib folium
    (opcional, para fondo de mapa en los PNG) pip install contextily
"""
import argparse
import hashlib
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.colors import Normalize, TwoSlopeNorm

import folium
import branca.colormap as cm

URL_HYDROCRON = "https://soto.podaac.earthdatacloud.nasa.gov/hydrocron/v1/timeseries"
URL_INDICE_SWORD = "https://pub-ceb2c39205d5401cac3cf448cff9518d.r2.dev/tiles/reach_search_index.json"
CARPETA_CACHE = Path("cache_hydrocron")
INICIO = "2023-07-15T00:00:00Z"  # después de la fase de calibración de órbita diaria
FIN = pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%dT00:00:00Z")
VALOR_RELLENO = -999999999999.0
HILOS = 4

TIPOS = {"1": "río", "3": "lago o embalse", "4": "presa", "5": "topología dudosa", "6": "fantasma"}

# Tramos llamados "Parana" o "Parana River" en SWORD, del Delta a Brasil
IDS_PARANA = """
64212000075 64212000085 64212000095 64212000105 64212000115 64212000125 64212000135 64212000145
64212000155 64212000165 64217000015 64217000025 64217000035 64217000045 64217000055 64217000065
64217000075 64217000085 64217000091 64217000103 64217000111 64217000123 64219000011 64219000023
64219000031 64219000041 64219000051 64219000061 64219000071 64219000091 64219000101 64219000111
64219000121 64219000131 64219000143 64219000151 64219000161 64219000171 64221000011 64231000011
64231000021 64231000031 64231000041 64231000051 64231000061 64231000071 64231000083 64231000091
64231000101 64231000111 64231000121 64231000131 64231000141 64231000151 64231000161 64231000171
64231000651 64231000251 64231000261 64231000271 64231000281 64233000011 64233000021 64233000031
64233000041 64233000051 64233000061 64233000071 64233000081 64233000093 64233000101 64233000111
64233000121 64233000131 64233000141 64235300011 64235300021 64235300031 64235300041 64235300051
64235300061 64235300071 64235300083 64235300091 64235700011 64235700021 64235700031 64235700041
64235700051 64235700061 64235700071 64236000011 64251100011 64251100021 64251100031 64251100041
64251100051 64251100061 64251100071 64251100081 64251100091 64251100101 64251100111 64251100121
64251100131 64251100143 64251100151 64251100161 64251100171 64251100181 64251100191 64251100201
64251100211 64251100221 64251100233 64251100241 64251100253 64251100261 64251100271 64251100283
64251100291 64251100303 64251100313 64251100323 64251100333 64251100343 64251100353 64251300013
64251300023 64251300033 64251300043 64251300053 64251300063 64251300073 64251300081 64251300091
64251300101 64251300111 64251300121 64251300131 64251300141 64251300151 64251300161 64251300171
64251300181 64251300191 64251300201 64251300211 64251300221 64251300231 64251300241 64251300251
64251300261 64251300271 64251300281 64251500011 64251500021 64251700011 64251700021 64251700031
64251700041 64251900011 64255000041 64255000051 64255000061 64255000071 64255000081 64255000091
64257000011 64259000051 64259000061 64259000071 64275000031 64275000041 64277000014 64277000023
""".split()

CIUDADES_PARANA = {
    "Buenos Aires": (-34.60, -58.38), "Rosario": (-32.95, -60.64), "Santa Fe": (-31.63, -60.70),
    "Paraná": (-31.73, -60.52), "Goya": (-29.14, -59.26), "Corrientes": (-27.47, -58.83),
    "Posadas": (-27.37, -55.90), "Foz do Iguaçu": (-25.55, -54.59), "Guaíra": (-24.08, -54.26),
}

ETIQUETAS_A_LA_IZQUIERDA = {"Santa Fe"}

CAMPOS_TRAMO = ["reach_id", "time_str", "wse", "wse_u", "width", "slope", "area_total", "reach_q",
                "dark_frac", "p_dist_out", "p_wse", "p_width", "p_lat", "p_lon", "river_name", "geometry"]

# Cada variable define cómo se calcula por tramo, su título, unidad, paleta y si es divergente
VARIABLES = {
    "nivel_mediano": dict(titulo="Nivel del agua mediano", unidad="m", paleta="viridis"),
    "amplitud": dict(titulo="Amplitud de nivel (p95 menos p05)", unidad="m", paleta="magma_r"),
    "anomalia": dict(titulo="Anomalía de nivel en el período elegido", unidad="m", paleta="RdBu", divergente=True),
    "ultima_anomalia": dict(titulo="Anomalía de nivel en la última pasada buena", unidad="m", paleta="RdBu", divergente=True),
    "ancho_mediano": dict(titulo="Ancho mediano", unidad="m", paleta="cividis", log=True),
    "ancho_relativo": dict(titulo="Ancho SWOT sobre ancho de referencia SWORD", unidad="", paleta="PuOr", divergente=True, centro=1.0),
    "superficie_mediana": dict(titulo="Superficie de agua mediana", unidad="km²", paleta="GnBu"),
    "pendiente": dict(titulo="Pendiente mediana del pelo de agua", unidad="cm/km", paleta="plasma"),
    "incertidumbre_nivel": dict(titulo="Incertidumbre mediana del nivel", unidad="m", paleta="YlOrRd"),
    "pasadas_buenas": dict(titulo="Cantidad de pasadas buenas", unidad="", paleta="Blues"),
    "fraccion_buenas": dict(titulo="Fracción de pasadas que pasan el filtro de calidad", unidad="%", paleta="RdYlGn"),
}
VARIABLES_POR_DEFECTO = ["nivel_mediano", "amplitud", "ultima_anomalia", "ancho_mediano",
                         "pendiente", "fraccion_buenas"]


# 1. Consultas a Hydrocron con caché en disco

sesion = requests.Session()


def ruta_cache(parametros):
    clave = hashlib.md5(json.dumps(parametros, sort_keys=True).encode()).hexdigest()[:12]
    return CARPETA_CACHE / f"{parametros['feature']}_{parametros['feature_id']}_{clave}.json"


def limpiar(tabla):
    tabla = tabla.drop(columns=[c for c in tabla.columns if c.endswith("_units")]).drop_duplicates()
    for columna in tabla.columns:
        if columna not in ("reach_id", "time_str", "river_name"):
            valores = pd.to_numeric(tabla[columna], errors="coerce")
            tabla[columna] = valores.where(valores > VALOR_RELLENO / 10)
    tabla["fecha"] = pd.to_datetime(tabla["time_str"].where(tabla["time_str"] != "no_data"), utc=True, errors="coerce")
    return tabla.reset_index(drop=True)


def consultar_tramo(id_tramo, reintentos=3):
    parametros = {"feature": "Reach", "feature_id": str(id_tramo), "start_time": INICIO, "end_time": FIN,
                  "output": "geojson", "compact": "true", "fields": ",".join(CAMPOS_TRAMO)}
    archivo = ruta_cache(parametros)
    if archivo.exists():
        respuesta = json.loads(archivo.read_text())
    else:
        respuesta = None
        for intento in range(reintentos):
            r = sesion.get(URL_HYDROCRON, params=parametros, timeout=90)
            if r.status_code == 200:
                respuesta = r.json()
                archivo.write_text(json.dumps(respuesta))
                break
            if r.status_code == 400:
                return id_tramo, pd.DataFrame(), None
            time.sleep(2 * (intento + 1))
        if respuesta is None:
            print(f"  no se pudo bajar {id_tramo} (código {r.status_code})")
            return id_tramo, pd.DataFrame(), None
    entidades = respuesta["results"]["geojson"]["features"]
    if not entidades:
        return id_tramo, pd.DataFrame(), None
    propiedades = {k: (v if isinstance(v, list) else [v]) for k, v in entidades[0]["properties"].items()}
    geometria = (entidades[0].get("geometry") or {}).get("coordinates")
    return id_tramo, limpiar(pd.DataFrame(propiedades)), geometria


def ids_por_nombre(nombre):
    print(f"Bajando el índice de SWORD Explorer para buscar '{nombre}' (unos 38 MB)...")
    indice = requests.get(URL_INDICE_SWORD, timeout=300).json()
    nombre = nombre.lower()
    return [r["reach_id"] for r in indice["records"]
            if r.get("river_name") and nombre in r["river_name"].lower()]


def bajar_rio(ids):
    CARPETA_CACHE.mkdir(exist_ok=True)
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=HILOS) as ejecutor:
        resultados = list(ejecutor.map(consultar_tramo, ids))
    print(f"{len(ids)} tramos consultados en {time.time() - t0:.0f} s")
    tablas = [t for _, t, _ in resultados if not t.empty]
    if not tablas:
        raise SystemExit("Hydrocron no devolvió datos para ningún tramo")
    observaciones = pd.concat(tablas, ignore_index=True)
    geometrias = {i: g for i, _, g in resultados if g}
    return observaciones, geometrias


# 2. Métricas por tramo

def calcular_metricas(observaciones, desde=None, hasta=None):
    con_dato = observaciones.dropna(subset=["fecha"])
    buenas = con_dato[(con_dato["reach_q"] <= 1) & con_dato["wse"].notna()].copy()
    grupos = buenas.groupby("reach_id")

    metricas = observaciones.groupby("reach_id").agg(
        dist_km=("p_dist_out", lambda s: s.dropna().iloc[0] / 1000 if s.notna().any() else np.nan),
        p_width=("p_width", "first"), lat=("p_lat", "first"), lon=("p_lon", "first"),
        nombre=("river_name", "first"))
    metricas["tipo"] = metricas.index.str[-1].map(TIPOS)
    metricas["pasadas_observadas"] = con_dato.groupby("reach_id").size()
    metricas["pasadas_buenas"] = grupos.size()
    metricas["pasadas_buenas"] = metricas["pasadas_buenas"].fillna(0).astype(int)
    metricas["fraccion_buenas"] = 100 * metricas["pasadas_buenas"] / metricas["pasadas_observadas"]

    mediana = grupos["wse"].median()
    metricas["nivel_mediano"] = mediana
    metricas["amplitud"] = grupos["wse"].quantile(0.95) - grupos["wse"].quantile(0.05)
    metricas["ancho_mediano"] = grupos["width"].median()
    metricas["ancho_relativo"] = metricas["ancho_mediano"] / metricas["p_width"]
    metricas["superficie_mediana"] = grupos["area_total"].median() / 1e6
    metricas["pendiente"] = grupos["slope"].median() * 1e5
    metricas["incertidumbre_nivel"] = grupos["wse_u"].median()

    ultima = buenas.sort_values("fecha").groupby("reach_id").last()
    metricas["ultima_anomalia"] = ultima["wse"] - mediana
    metricas["fecha_ultima"] = ultima["fecha"].dt.strftime("%Y-%m-%d")

    if desde or hasta:
        en_periodo = buenas
        if desde:
            en_periodo = en_periodo[en_periodo["fecha"] >= pd.Timestamp(desde, tz="UTC")]
        if hasta:
            en_periodo = en_periodo[en_periodo["fecha"] <= pd.Timestamp(hasta, tz="UTC") + pd.Timedelta(days=1)]
        metricas["anomalia"] = en_periodo.groupby("reach_id")["wse"].median() - mediana
        metricas["pasadas_periodo"] = en_periodo.groupby("reach_id").size()
    return metricas.sort_values("dist_km")


# 3. Escalas de color comunes a los dos tipos de mapa

def armar_escala(valores, config):
    valores = valores.dropna()
    if config.get("divergente"):
        centro = config.get("centro", 0.0)
        radio = np.nanpercentile(np.abs(valores - centro), 95) if len(valores) else 1.0
        radio = radio or 1.0
        return centro - radio, centro + radio, TwoSlopeNorm(centro, centro - radio, centro + radio)
    minimo, maximo = np.nanpercentile(valores, [2, 98]) if len(valores) else (0, 1)
    if config.get("log"):
        minimo = max(minimo, 1)
        from matplotlib.colors import LogNorm
        return minimo, maximo, LogNorm(minimo, maximo)
    if maximo == minimo:
        maximo = minimo + 1
    return minimo, maximo, Normalize(minimo, maximo)


def formato(valor, unidad):
    if pd.isna(valor):
        return "sin dato"
    decimales = 0 if abs(valor) >= 100 else 2
    return f"{valor:,.{decimales}f} {unidad}".replace(",", ".").strip()


# 4. Mapa interactivo

def mapa_interactivo(metricas, geometrias, variable, config, ciudades, archivo, subtitulo=""):
    minimo, maximo, norma = armar_escala(metricas[variable], config)
    cmap = plt.get_cmap(config["paleta"])
    a_color = lambda v: matplotlib.colors.to_hex(cmap(norma(v)))
    muestras = np.linspace(minimo, maximo, 9)
    leyenda = cm.LinearColormap([a_color(v) for v in muestras], index=list(muestras), vmin=minimo, vmax=maximo,
                                caption=f"{config['titulo']} ({config['unidad']})" if config["unidad"] else config["titulo"])

    centro = [metricas["lat"].mean(), metricas["lon"].mean()]
    mapa = folium.Map(location=centro, zoom_start=6, tiles=None)
    folium.TileLayer("OpenStreetMap", name="Calles").add_to(mapa)
    folium.TileLayer(tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                     attr="Esri World Imagery", name="Satélite").add_to(mapa)
    capa = folium.FeatureGroup(name=config["titulo"]).add_to(mapa)

    for id_tramo, fila in metricas.iterrows():
        if id_tramo not in geometrias:
            continue
        valor = fila[variable]
        color = "#9e9e9e" if pd.isna(valor) else a_color(valor)
        texto = (f"<b>{id_tramo}</b> ({fila['tipo']})<br>"
                 f"{config['titulo']}: <b>{formato(valor, config['unidad'])}</b><br>"
                 f"a {fila['dist_km']:.0f} km de la desembocadura<br>"
                 f"{fila['pasadas_buenas']} pasadas buenas<br>"
                 f"nivel mediano {formato(fila['nivel_mediano'], 'm')}, ancho mediano {formato(fila['ancho_mediano'], 'm')}")
        if variable == "ultima_anomalia" and isinstance(fila.get("fecha_ultima"), str):
            texto += f"<br>última pasada buena {fila['fecha_ultima']}"
        folium.PolyLine([(lat, lon) for lon, lat in geometrias[id_tramo]], color=color, weight=6, opacity=0.9,
                        tooltip=folium.Tooltip(texto)).add_to(capa)

    for nombre, (lat, lon) in ciudades.items():
        folium.CircleMarker([lat, lon], radius=4, color="#222", fill=True, fill_opacity=1, tooltip=nombre).add_to(mapa)

    titulo_html = f"<h4 style='position:fixed;top:10px;left:60px;z-index:9999;background:white;padding:6px 10px;" \
                  f"margin:0;font-family:sans-serif'>{config['titulo']}<br><small>{subtitulo}</small></h4>"
    mapa.get_root().html.add_child(folium.Element(titulo_html))
    leyenda.add_to(mapa)
    folium.LayerControl().add_to(mapa)
    mapa.fit_bounds([[metricas["lat"].min(), metricas["lon"].min()], [metricas["lat"].max(), metricas["lon"].max()]])
    mapa.save(archivo)


# 5. Mapa estático

def mapa_estatico(metricas, geometrias, variable, config, ciudades, archivo, subtitulo=""):
    _, _, norma = armar_escala(metricas[variable], config)
    cmap = plt.get_cmap(config["paleta"])
    lineas, valores = [], []
    for id_tramo, fila in metricas.iterrows():
        if id_tramo in geometrias:
            lineas.append(np.array(geometrias[id_tramo]))
            valores.append(fila[variable])
    valores = np.array(valores, dtype=float)
    sin_dato = np.isnan(valores)

    fig, eje = plt.subplots(figsize=(8, 10))
    eje.add_collection(LineCollection([l for l, s in zip(lineas, sin_dato) if s], colors="#bdbdbd", linewidths=2.5))
    coleccion = LineCollection([l for l, s in zip(lineas, sin_dato) if not s], cmap=cmap, norm=norma, linewidths=3.5)
    coleccion.set_array(valores[~sin_dato])
    eje.add_collection(coleccion)

    todos = np.vstack(lineas)
    margen = 0.6
    eje.set_xlim(todos[:, 0].min() - margen, todos[:, 0].max() + margen)
    eje.set_ylim(todos[:, 1].min() - margen, todos[:, 1].max() + margen)
    eje.set_aspect(1 / np.cos(np.radians(todos[:, 1].mean())))

    try:
        import contextily as ctx
        ctx.add_basemap(eje, crs="EPSG:4326", source=ctx.providers.CartoDB.Positron, attribution_size=6)
    except Exception:
        eje.set_facecolor("#f4f1ea")
        eje.grid(alpha=0.3)

    for nombre, (lat, lon) in ciudades.items():
        if eje.get_xlim()[0] < lon < eje.get_xlim()[1] and eje.get_ylim()[0] < lat < eje.get_ylim()[1]:
            eje.plot(lon, lat, "o", color="#222", ms=4)
            a_la_izquierda = nombre in ETIQUETAS_A_LA_IZQUIERDA
            eje.annotate(nombre, (lon, lat), xytext=(-6 if a_la_izquierda else 6, 2), textcoords="offset points",
                         fontsize=8, ha="right" if a_la_izquierda else "left")

    barra = fig.colorbar(coleccion, ax=eje, shrink=0.6, pad=0.02)
    barra.set_label(f"{config['titulo']} ({config['unidad']})" if config["unidad"] else config["titulo"])
    eje.set_title(f"{config['titulo']}\n{subtitulo}", fontsize=11)
    eje.set_xlabel("Longitud")
    eje.set_ylabel("Latitud")
    fig.tight_layout()
    fig.savefig(archivo, dpi=160)
    plt.close(fig)


# 6. Programa principal

def main():
    parser = argparse.ArgumentParser(description="Mapas de un río con datos SWOT de Hydrocron")
    parser.add_argument("--variables", nargs="+", default=VARIABLES_POR_DEFECTO, choices=list(VARIABLES),
                        help="variables a mapear (por defecto " + " ".join(VARIABLES_POR_DEFECTO) + ")")
    parser.add_argument("--nombre", help="nombre del río en SWORD; si se omite usa la lista del Paraná")
    parser.add_argument("--desde", help="inicio del período para la variable anomalia (AAAA-MM-DD)")
    parser.add_argument("--hasta", help="fin del período para la variable anomalia (AAAA-MM-DD)")
    parser.add_argument("--solo-rio", action="store_true", help="dejar afuera embalses, presas y tramos fantasma")
    parser.add_argument("--salida", default="mapas", help="carpeta donde se guardan los mapas")
    parser.add_argument("--sin-png", action="store_true", help="no generar los mapas estáticos")
    parser.add_argument("--listar", action="store_true", help="mostrar las variables disponibles y salir")
    argumentos = parser.parse_args()

    if argumentos.listar:
        for clave, config in VARIABLES.items():
            print(f"{clave:22s} {config['titulo']} ({config['unidad'] or 'sin unidad'})")
        return

    variables = list(dict.fromkeys(argumentos.variables))
    if "anomalia" in variables and not (argumentos.desde or argumentos.hasta):
        raise SystemExit("Para la variable anomalia indicá --desde y/o --hasta")

    ids = ids_por_nombre(argumentos.nombre) if argumentos.nombre else IDS_PARANA
    if not ids:
        raise SystemExit(f"No encontré tramos con el nombre '{argumentos.nombre}'")
    if argumentos.solo_rio:
        ids = [i for i in ids if i[-1] in ("1", "5")]
    nombre_rio = argumentos.nombre or "Paraná"
    ciudades = CIUDADES_PARANA if not argumentos.nombre else {}
    print(f"{len(ids)} tramos del río {nombre_rio}")

    observaciones, geometrias = bajar_rio(ids)
    metricas = calcular_metricas(observaciones, argumentos.desde, argumentos.hasta)

    salida = Path(argumentos.salida)
    salida.mkdir(parents=True, exist_ok=True)
    metricas.to_csv(salida / "metricas_por_tramo.csv")

    periodo = f"SWOT {INICIO[:10]} a {FIN[:10]}, pasadas con reach_q 0 o 1"
    for variable in variables:
        config = VARIABLES[variable]
        subtitulo = f"Río {nombre_rio}, {periodo}"
        if variable == "anomalia":
            subtitulo = f"Río {nombre_rio}, mediana entre {argumentos.desde or 'el inicio'} y {argumentos.hasta or 'hoy'} menos mediana total"
        con_valor = metricas[variable].notna().sum()
        mapa_interactivo(metricas, geometrias, variable, config, ciudades, salida / f"{variable}.html", subtitulo)
        if not argumentos.sin_png:
            mapa_estatico(metricas, geometrias, variable, config, ciudades, salida / f"{variable}.png", subtitulo)
        print(f"  {variable} listo ({con_valor} tramos con valor)")
    print(f"Mapas y tabla en la carpeta {salida.resolve()}")


if __name__ == "__main__":
    main()
