"""Mapas de cualquier variable de un río, con la opción de anomalías en un período.

Baja lo que falte de Hydrocron (usa la caché de datos/<id>/crudo), calcula las métricas y deja un mapa
interactivo (.html) y uno estático (.png) por variable en mapas/<id>/, o en --salida.

Ejemplos, desde esta carpeta
    python mapas_rio.py <id>
    python mapas_rio.py <id> --variables amplitud ancho_mediano pendiente
    python mapas_rio.py <id> --variables anomalia --desde 2024-08-01 --hasta 2024-10-31
    python mapas_rio.py --listar

Dependencias
    pip install requests pandas numpy matplotlib folium
    (opcional, para fondo de mapa en los PNG) pip install contextily
"""
import argparse
import sys
from pathlib import Path

from swot import cargar_rio, carpeta_mapas
from swot import mapas
from swot.hydrocron import INICIO, fecha_fin
from swot.metricas import VARIABLES
from swot.pasos import bajar, exportar_datos, metricas_y_geometrias

VARIABLES_POR_DEFECTO = ["nivel_mediano", "amplitud", "ultima_anomalia", "ancho_mediano", "pendiente",
                         "fraccion_buenas"]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Mapas de un río con datos SWOT de Hydrocron")
    parser.add_argument("id", nargs="?", help="río de rios/<id>.json")
    parser.add_argument("--variables", nargs="+", default=VARIABLES_POR_DEFECTO, choices=list(VARIABLES),
                        help="variables a mapear (por defecto " + " ".join(VARIABLES_POR_DEFECTO) + ")")
    parser.add_argument("--desde", help="inicio del período para la variable anomalia (AAAA-MM-DD)")
    parser.add_argument("--hasta", help="fin del período para la variable anomalia (AAAA-MM-DD)")
    parser.add_argument("--salida", help="carpeta de los mapas (por defecto mapas/<id>)")
    parser.add_argument("--sin-png", action="store_true", help="no generar los mapas estáticos")
    parser.add_argument("--actualizar", action="store_true", help="volver a bajar de Hydrocron")
    parser.add_argument("--listar", action="store_true", help="mostrar las variables disponibles y salir")
    argumentos = parser.parse_args()

    if argumentos.listar:
        for clave, config in VARIABLES.items():
            print(f"{clave:22s} {config['titulo']} ({config['unidad'] or 'sin unidad'})")
        return
    if not argumentos.id:
        parser.error("falta el id del río")
    variables = list(dict.fromkeys(argumentos.variables))
    if "anomalia" in variables and not (argumentos.desde or argumentos.hasta):
        raise SystemExit("Para la variable anomalia indicá --desde y/o --hasta")

    rio = cargar_rio(argumentos.id)
    bajar(rio, argumentos.actualizar)
    exportar_datos(rio)
    _, metricas, geometrias = metricas_y_geometrias(rio, argumentos.desde, argumentos.hasta)

    salida = Path(argumentos.salida) if argumentos.salida else carpeta_mapas(rio["id"])
    salida.mkdir(parents=True, exist_ok=True)
    metricas.to_csv(salida / "metricas_por_tramo.csv")
    periodo = f"SWOT {INICIO[:10]} a {fecha_fin()[:10]}, pasadas con reach_q 0 o 1"
    for variable in variables:
        subtitulo = f"Río {rio['nombre']}, {periodo}"
        if variable == "anomalia":
            subtitulo = (f"Río {rio['nombre']}, mediana entre {argumentos.desde or 'el inicio'} y "
                         f"{argumentos.hasta or 'hoy'} menos mediana total")
        mapas.hacer_mapas(rio, metricas, geometrias, [variable], subtitulo, salida, not argumentos.sin_png)
    print(f"Mapas y tabla en {salida.resolve()}")


if __name__ == "__main__":
    main()
