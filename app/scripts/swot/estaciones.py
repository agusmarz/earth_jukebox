"""Datos de la demo por estación del año, en demo/datos/estaciones/<id>.json.

Cada estación junta las pasadas de sus tres meses de todos los años medidos y pasa por lo mismo que el
año entero en demo.preparar (cierre de huecos, corrección de raros, interpolación y normalización). Las
variables son las mismas cuatro de siempre. Lo único distinto es que la normalización propia no se
recalcula, se usa la del año entero, así las cuatro estaciones comparten la escala y suenan distinto.

El archivo trae solo lo que cambia con la estación. La geometría y las ciudades siguen en
demo/datos/<id>.json, y los tramos se emparejan por id.
"""
import json

import numpy as np

from . import CARPETA_DEMO_DATOS, escribir_texto
from .demo import METRICAS

VERSION = 1
# Estaciones meteorológicas del hemisferio norte. En el sur se corren seis meses.
MESES_NORTE = {
    "verano": [6, 7, 8],
    "otono": [9, 10, 11],
    "invierno": [12, 1, 2],
    "primavera": [3, 4, 5],
}
CAMPOS = ["pasadas", "valor", "normas", "corregido", "medido", "interpolado"]


def meses_por_estacion(hemisferio):
    if hemisferio == "norte":
        return MESES_NORTE
    return {estacion: [(mes + 5) % 12 + 1 for mes in meses] for estacion, meses in MESES_NORTE.items()}


def armar(rio, por_estacion, ids_anuales):
    """por_estacion es {estacion: (meses, datos, resumen)} con datos en el formato de demo/datos/<id>.json."""
    salida = {"version": VERSION, "id": rio["id"], "hemisferio": rio["hemisferio"], "estaciones": {}}
    for estacion, (meses, datos, _) in por_estacion.items():
        ids = [t["id"] for t in datos["tramos"]]
        if ids != ids_anuales:
            raise SystemExit(f"{estacion}: los tramos no coinciden con los del año entero, "
                             f"{len(ids)} contra {len(ids_anuales)}")
        salida["estaciones"][estacion] = {
            "meses": meses,
            "tramos": {t["id"]: {campo: t[campo] for campo in CAMPOS} for t in datos["tramos"]},
        }
    return salida


def escribir(salida):
    archivo = CARPETA_DEMO_DATOS / "estaciones" / f"{salida['id']}.json"
    escribir_texto(archivo, json.dumps(salida, ensure_ascii=False, separators=(",", ":")) + "\n")
    return archivo


def imprimir_resumen(por_estacion, anual):
    """Una fila por estación con pasadas, tramos medidos e interpolados, y la mediana de cada métrica."""
    filas = [("año", None, anual)] + [(e, m, d) for e, (m, d, _) in por_estacion.items()]
    encabezado = f"{'':10s} {'meses':10s} {'pasadas':>8s} {'medidos':>8s} {'interp.':>8s}"
    for nombre, config in METRICAS.items():
        encabezado += f" {nombre + ' (' + config['unidad'] + ')':>17s}"
    print(encabezado)
    for estacion, meses, datos in filas:
        tramos = datos["tramos"]
        con_pasadas = [t for t in tramos if t["pasadas"] and t["pasadas"] > 0]
        pasadas = np.median([t["pasadas"] for t in con_pasadas]) if con_pasadas else 0
        interpolados = sum(1 for t in tramos if t["interpolado"].get("nivel"))
        fila = (f"{estacion:10s} {','.join(map(str, meses)) if meses else 'todos':10s} {pasadas:8.0f} "
                f"{len(con_pasadas):8d} {interpolados:8d}")
        for nombre in METRICAS:
            valores = [t["valor"][nombre] for t in tramos if not t["interpolado"].get(nombre)]
            valores = [v for v in valores if v is not None and not np.isnan(v)]
            fila += f" {np.median(valores) if valores else float('nan'):17.2f}"
        print(fila)
    print("pasadas es la mediana por tramo medido, medidos los tramos con alguna pasada buena e interp. los "
          "tramos con el nivel interpolado. Las métricas son la mediana de los tramos medidos.")

    print("\nCuánto se mueve la norma propia de cada tramo respecto del año (mediana del valor absoluto, de 0 a 1)")
    for estacion, (_, datos, _) in por_estacion.items():
        fila = f"{estacion:10s}"
        for nombre in METRICAS:
            diferencias = [abs(t["normas"]["propia"][nombre] - a["normas"]["propia"][nombre])
                           for t, a in zip(datos["tramos"], anual["tramos"])]
            fila += f" {nombre} {np.median(diferencias):.3f}"
        print(fila)
