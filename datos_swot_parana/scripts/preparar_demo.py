"""Escribe demo/datos/<id>.json (y actualiza demo/datos/indice.json) para el mapa sonoro.

Uso, desde esta carpeta
    python preparar_demo.py <id>
Equivale a python procesar_rio.py <id> --pasos demo. Lo que hace está explicado en swot/demo.py.
"""
import argparse
import sys

from swot import cargar_rio
from swot.pasos import preparar_demo


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Prepara los datos de la demo de un río")
    parser.add_argument("id", help="río de rios/<id>.json")
    preparar_demo(cargar_rio(parser.parse_args().id))


if __name__ == "__main__":
    main()
