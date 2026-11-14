"""
Regenera los cinco mapas del Paraná a partir de los datos guardados, sin consultar la API.

Lee datos/observaciones.csv y datos/tramos.geojson y escribe en mapas/ un .html y un .png por variable.

Uso (desde la carpeta scripts)
    python generar_mapas.py
    python generar_mapas.py --variables amplitud pendiente
"""
import argparse
import json
from pathlib import Path

import pandas as pd

import mapas_rio as mr

RAIZ = Path(__file__).resolve().parent.parent
VARIABLES_MAPAS = ["nivel_mediano", "amplitud", "ancho_mediano", "superficie_mediana", "pendiente"]


def main():
    parser = argparse.ArgumentParser(description="Mapas del Paraná desde los datos guardados")
    parser.add_argument("--variables", nargs="+", default=VARIABLES_MAPAS, choices=VARIABLES_MAPAS)
    parser.add_argument("--sin-png", action="store_true")
    argumentos = parser.parse_args()

    observaciones = pd.read_csv(RAIZ / "datos" / "observaciones.csv", dtype={"reach_id": str})
    observaciones = mr.limpiar(observaciones.drop(columns=["tipo"]))
    metricas = mr.calcular_metricas(observaciones)

    tramos = json.loads((RAIZ / "datos" / "tramos.geojson").read_text())
    geometrias = {f["properties"]["reach_id"]: f["geometry"]["coordinates"] for f in tramos["features"]}

    inicio = observaciones["fecha"].min().strftime("%Y-%m-%d")
    fin = observaciones["fecha"].max().strftime("%Y-%m-%d")
    subtitulo = f"Río Paraná, SWOT {inicio} a {fin}, pasadas con reach_q 0 o 1"

    salida = RAIZ / "mapas"
    salida.mkdir(exist_ok=True)
    for variable in argumentos.variables:
        config = mr.VARIABLES[variable]
        mr.mapa_interactivo(metricas, geometrias, variable, config, mr.CIUDADES_PARANA,
                            salida / f"{variable}.html", subtitulo)
        if not argumentos.sin_png:
            mr.mapa_estatico(metricas, geometrias, variable, config, mr.CIUDADES_PARANA,
                             salida / f"{variable}.png", subtitulo)
        print(f"  {variable} listo")


if __name__ == "__main__":
    main()
