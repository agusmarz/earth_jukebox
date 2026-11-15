"""Rehace los mapas de un río desde datos/<id>/, sin consultar la API.

Uso, desde esta carpeta
    python generar_mapas.py <id>
    python generar_mapas.py <id> --variables amplitud pendiente
"""
import argparse
import sys

from swot import cargar_rio
from swot.metricas import VARIABLES_MAPAS
from swot.pasos import hacer_mapas


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Mapas de un río desde los datos guardados")
    parser.add_argument("id", help="río de rios/<id>.json")
    parser.add_argument("--variables", nargs="+", default=VARIABLES_MAPAS, choices=VARIABLES_MAPAS)
    parser.add_argument("--sin-png", action="store_true")
    argumentos = parser.parse_args()
    hacer_mapas(cargar_rio(argumentos.id), argumentos.variables, con_png=not argumentos.sin_png)


if __name__ == "__main__":
    main()
