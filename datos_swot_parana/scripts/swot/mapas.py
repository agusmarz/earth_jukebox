"""Mapas interactivos (folium) y estáticos (matplotlib) de una métrica por tramo.

Las ciudades se pasan como diccionario {nombre: (lat, lon)}.
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.collections import LineCollection
from matplotlib.colors import Normalize, TwoSlopeNorm

import branca.colormap as cm
import folium

from . import carpeta_mapas
from .metricas import VARIABLES


# 1. Escalas de color comunes a los dos tipos de mapa

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


# 2. Mapa interactivo

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


# 3. Mapa estático

def mapa_estatico(metricas, geometrias, variable, config, ciudades, archivo, subtitulo="",
                  etiquetas_a_la_izquierda=()):
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
            a_la_izquierda = nombre in etiquetas_a_la_izquierda
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


# 4. Todos los mapas de un río

def ciudades_de(rio):
    """Ciudades de los mapas: primero las que solo van en los mapas y después las de la demo."""
    return {nombre: (lat, lon) for nombre, lat, lon in rio["ciudades_solo_mapas"] + rio["ciudades"]}


def hacer_mapas(rio, metricas, geometrias, variables, subtitulo, carpeta=None, con_png=True):
    carpeta = carpeta or carpeta_mapas(rio["id"])
    carpeta.mkdir(parents=True, exist_ok=True)
    ciudades = ciudades_de(rio)
    for variable in variables:
        config = VARIABLES[variable]
        mapa_interactivo(metricas, geometrias, variable, config, ciudades, carpeta / f"{variable}.html", subtitulo)
        if con_png:
            mapa_estatico(metricas, geometrias, variable, config, ciudades, carpeta / f"{variable}.png", subtitulo,
                          rio["etiquetas_a_la_izquierda"])
        print(f"  {variable} listo ({metricas[variable].notna().sum()} tramos con valor)")
    return carpeta
