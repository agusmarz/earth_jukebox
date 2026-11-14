"""
Pasa las respuestas crudas de Hydrocron (datos/crudo/<reach_id>.json) a archivos fáciles de usar.

Genera en datos/
    observaciones.csv   una fila por tramo y pasada de SWOT, con todos los campos descargados
    metricas.csv        una fila por tramo con las cinco métricas de los mapas
    tramos.geojson      la geometría de cada tramo con sus métricas como propiedades

Uso (desde la carpeta scripts)
    python exportar_datos.py
"""
import json
from pathlib import Path

import pandas as pd

import mapas_rio as mr

RAIZ = Path(__file__).resolve().parent.parent
CARPETA_CRUDO = RAIZ / "datos" / "crudo"
CARPETA_DATOS = RAIZ / "datos"
VARIABLES_MAPAS = ["nivel_mediano", "amplitud", "ancho_mediano", "superficie_mediana", "pendiente"]


def leer_crudo():
    tablas, geometrias = [], {}
    for archivo in sorted(CARPETA_CRUDO.glob("*.json")):
        respuesta = json.loads(archivo.read_text())
        entidad = respuesta["results"]["geojson"]["features"][0]
        propiedades = {k: (v if isinstance(v, list) else [v]) for k, v in entidad["properties"].items()}
        tablas.append(mr.limpiar(pd.DataFrame(propiedades)))
        if entidad.get("geometry"):
            geometrias[archivo.stem] = entidad["geometry"]["coordinates"]
    return pd.concat(tablas, ignore_index=True), geometrias


def main():
    observaciones, geometrias = leer_crudo()
    observaciones = observaciones.drop(columns=["fecha"])
    observaciones.insert(1, "tipo", observaciones["reach_id"].str[-1].map(mr.TIPOS))
    observaciones.to_csv(CARPETA_DATOS / "observaciones.csv", index=False)

    metricas = mr.calcular_metricas(mr.limpiar(observaciones.drop(columns=["tipo"])))
    columnas = ["nombre", "tipo", "dist_km", "lat", "lon", "p_width", "pasadas_observadas", "pasadas_buenas"] + VARIABLES_MAPAS
    metricas = metricas[columnas].round(4)
    metricas.to_csv(CARPETA_DATOS / "metricas.csv")

    entidades = []
    for id_tramo, fila in metricas.iterrows():
        if id_tramo not in geometrias:
            continue
        propiedades = {"reach_id": id_tramo}
        propiedades.update({k: (None if pd.isna(v) else v) for k, v in fila.items()})
        entidades.append({"type": "Feature", "properties": propiedades,
                          "geometry": {"type": "LineString", "coordinates": geometrias[id_tramo]}})
    (CARPETA_DATOS / "tramos.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": entidades}, ensure_ascii=False))

    print(f"{len(observaciones)} observaciones de {observaciones.reach_id.nunique()} tramos")
    print(f"{len(entidades)} tramos con geometría en tramos.geojson")


if __name__ == "__main__":
    main()
