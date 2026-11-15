"""Arma datos/<id>/observaciones.csv, metricas.csv y tramos.geojson desde datos/<id>/crudo.

Uso, desde esta carpeta
    python exportar_datos.py <id>
Equivale a python procesar_rio.py <id> --pasos exportar.
"""
import argparse
import sys

from swot import cargar_rio
from swot.pasos import exportar_datos


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Exporta los datos de un río desde las respuestas guardadas")
    parser.add_argument("id", help="río de rios/<id>.json")
    exportar_datos(cargar_rio(parser.parse_args().id))


if __name__ == "__main__":
    main()
