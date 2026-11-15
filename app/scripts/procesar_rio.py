"""Procesa un río de SWORD de punta a punta con su configuración de rios/<id>.json.

Uso, desde esta carpeta
    python procesar_rio.py <id>
    python procesar_rio.py <id> --pasos exportar demo
    python procesar_rio.py <id> --actualizar        vuelve a bajar todo de Hydrocron

Pasos, en este orden
    bajar     elige los tramos del cauce y los baja de Hydrocron a datos/<id>/crudo (usa la caché)
    exportar  datos/<id>/observaciones.csv, metricas.csv y tramos.geojson
    mapas     mapas/<id>/<variable>.html y .png
    demo      demo/datos/<id>.json y demo/datos/indice.json
    estaciones demo/datos/estaciones/<id>.json, una versión de la demo por estación del año (solo con --pasos)
"""
import argparse
import sys

from swot import cargar_rio
from swot.pasos import PASOS, PASOS_POR_DEFECTO, correr


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Procesa un río de SWORD con datos SWOT de Hydrocron")
    parser.add_argument("id", help="nombre del archivo de configuración en rios/, sin .json")
    parser.add_argument("--pasos", nargs="+", choices=PASOS, default=PASOS_POR_DEFECTO,
                        help="pasos a correr (por defecto todos menos estaciones)")
    parser.add_argument("--actualizar", action="store_true", help="volver a bajar de Hydrocron aunque esté en la caché")
    argumentos = parser.parse_args()
    correr(cargar_rio(argumentos.id), argumentos.pasos, argumentos.actualizar)


if __name__ == "__main__":
    main()
