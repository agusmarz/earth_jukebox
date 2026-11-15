"""Limpieza de las respuestas de Hydrocron, métricas por tramo y archivos de datos/<id>/."""
import json

import numpy as np
import pandas as pd

from . import carpeta_datos, escribir_texto

VALOR_RELLENO = -999999999999.0
TIPOS = {"1": "río", "3": "lago o embalse", "4": "presa", "5": "topología dudosa", "6": "fantasma"}

# Cada variable define su título, unidad, paleta y si es divergente o logarítmica (la usan los mapas)
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
VARIABLES_MAPAS = ["nivel_mediano", "amplitud", "ancho_mediano", "superficie_mediana", "pendiente"]
COLUMNAS_METRICAS = ["nombre", "tipo", "dist_km", "lat", "lon", "p_width", "pasadas_observadas",
                     "pasadas_buenas"] + VARIABLES_MAPAS


# 1. Limpieza de una tabla de Hydrocron

def limpiar(tabla):
    tabla = tabla.drop(columns=[c for c in tabla.columns if c.endswith("_units")]).drop_duplicates()
    for columna in tabla.columns:
        if columna not in ("reach_id", "time_str", "river_name"):
            valores = pd.to_numeric(tabla[columna], errors="coerce")
            tabla[columna] = valores.where(valores > VALOR_RELLENO / 10)
    tabla["fecha"] = pd.to_datetime(tabla["time_str"].where(tabla["time_str"] != "no_data"), utc=True, errors="coerce")
    return tabla.reset_index(drop=True)


# 2. Métricas por tramo

def calcular_metricas(observaciones, desde=None, hasta=None, meses=None):
    """Métricas por tramo. Con meses (lista de 1 a 12) solo cuenta las pasadas de esos meses, de todos los años.
    Los tramos sin pasadas en esos meses quedan igual en la tabla, con las métricas vacías."""
    con_dato = observaciones.dropna(subset=["fecha"])
    if meses is not None:
        con_dato = con_dato[con_dato["fecha"].dt.month.isin(meses)]
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


def sumar_tramos_solo_sword(metricas, solo_sword):
    """Agrega los tramos que están en SWORD pero no en Hydrocron, sin pasadas y con las métricas vacías."""
    if not solo_sword:
        return metricas
    filas = pd.DataFrame([{
        "reach_id": id_tramo, "dist_km": ficha["dist_km"], "p_width": ficha["p_width"], "lat": ficha["lat"],
        "lon": ficha["lon"], "nombre": ficha["nombre"], "tipo": TIPOS.get(id_tramo[-1]),
        "pasadas_observadas": 0, "pasadas_buenas": 0,
    } for id_tramo, ficha in solo_sword.items() if id_tramo not in metricas.index]).set_index("reach_id")
    return pd.concat([metricas, filas]).sort_values("dist_km")


# 3. Archivos de datos/<id>/

def exportar(id_rio, observaciones, geometrias, solo_sword=None):
    """Escribe observaciones.csv, metricas.csv y tramos.geojson. Devuelve la tabla de métricas."""
    carpeta = carpeta_datos(id_rio)
    observaciones = observaciones.drop(columns=["fecha"])
    observaciones.insert(1, "tipo", observaciones["reach_id"].str[-1].map(TIPOS))
    escribir_texto(carpeta / "observaciones.csv", observaciones.to_csv(index=False, lineterminator="\n"))

    metricas = calcular_metricas(limpiar(observaciones.drop(columns=["tipo"])))
    metricas = sumar_tramos_solo_sword(metricas, solo_sword or {})
    metricas = metricas[COLUMNAS_METRICAS].round(4)
    escribir_texto(carpeta / "metricas.csv", metricas.to_csv(lineterminator="\n"))

    geometrias = dict(geometrias)
    for id_tramo, ficha in (solo_sword or {}).items():
        geometrias.setdefault(id_tramo, ficha["linea"])
    escribir_texto(carpeta / "tramos.geojson", json.dumps(
        {"type": "FeatureCollection", "features": entidades_geojson(metricas, geometrias)}, ensure_ascii=False))
    print(f"{len(observaciones)} observaciones de {observaciones.reach_id.nunique()} tramos, "
          f"{len(metricas)} tramos en metricas.csv")
    return metricas


def entidades_geojson(metricas, geometrias):
    entidades = []
    for id_tramo, fila in metricas.iterrows():
        if id_tramo not in geometrias:
            continue
        propiedades = {"reach_id": id_tramo}
        propiedades.update({k: (None if pd.isna(v) else v) for k, v in fila.items()})
        entidades.append({"type": "Feature", "properties": propiedades,
                          "geometry": {"type": "LineString", "coordinates": geometrias[id_tramo]}})
    return entidades


def leer_observaciones(id_rio):
    observaciones = pd.read_csv(carpeta_datos(id_rio) / "observaciones.csv", dtype={"reach_id": str})
    return limpiar(observaciones.drop(columns=["tipo"]))


def leer_tramos_geojson(id_rio):
    return json.loads((carpeta_datos(id_rio) / "tramos.geojson").read_text(encoding="utf-8"))["features"]
