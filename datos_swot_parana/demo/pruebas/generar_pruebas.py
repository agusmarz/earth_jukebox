"""Arma los datos de prueba de la demo en esta carpeta, con el mismo formato que demo/datos/.

Escribe tres archivos.
    indice.json      lista de ríos de prueba
    parana.json      el demo/tramos.js de siempre pasado al formato nuevo. normas.propia es el
                     norma original y normas.global sale de ESCALAS_PRUEBA, unos rangos inventados
                     solo para que el cambio de normalización se escuche
    sintetico.json   un río inventado, más chico y en otro lugar del mapa, para probar el cambio
                     de río y los campos opcionales que faltan

Los valores de normas.global de estos archivos no son los reales. Los reales los genera el
pipeline de scripts/ en demo/datos/.

Uso, desde esta carpeta
    python generar_pruebas.py
"""

import json
import math
import random
from pathlib import Path

CARPETA = Path(__file__).resolve().parent
TRAMOS_JS = CARPETA.parent / "tramos.js"
METRICAS = ["ancho", "nivel", "pendiente", "amplitud"]

# Rangos inventados para la normalización global de prueba, iguales para los dos ríos
ESCALAS_PRUEBA = {
    "ancho": {"log": True, "minimo": 100, "maximo": 50000},
    "nivel": {"log": False, "minimo": 0, "maximo": 600},
    "pendiente": {"log": False, "minimo": 0, "maximo": 40},
    "amplitud": {"log": False, "minimo": 0, "maximo": 15},
}


def normalizar_global(nombre, valor):
    if valor is None:
        return None
    escala = ESCALAS_PRUEBA[nombre]
    if escala["log"]:
        u = math.log(max(valor, 1e-3) / escala["minimo"]) / math.log(escala["maximo"] / escala["minimo"])
    else:
        u = (valor - escala["minimo"]) / (escala["maximo"] - escala["minimo"])
    return round(min(1.0, max(0.0, u)), 3)


def percentil(valores, p):
    ordenados = sorted(valores)
    posicion = (len(ordenados) - 1) * p / 100
    abajo = math.floor(posicion)
    arriba = min(abajo + 1, len(ordenados) - 1)
    return ordenados[abajo] + (ordenados[arriba] - ordenados[abajo]) * (posicion - abajo)


def normalizar_propia(tramos, nombre, log):
    """Percentiles 5 y 95 del propio río, como hace scripts/preparar_demo.py."""
    base = lambda v: math.log(max(v, 1e-3)) if log else max(v, 0) if nombre == "pendiente" else v
    medidos = [base(t["valor"][nombre]) for t in tramos if t["valor"][nombre] is not None]
    bajo, alto = percentil(medidos, 5), percentil(medidos, 95)
    for tramo in tramos:
        valor = tramo["valor"][nombre]
        u = None if valor is None else round(min(1.0, max(0.0, (base(valor) - bajo) / (alto - bajo))), 3)
        tramo["normas"]["propia"][nombre] = u


# 1. Paraná desde demo/tramos.js
def armar_parana():
    texto = TRAMOS_JS.read_text(encoding="utf-8")
    datos = json.loads(texto[texto.index("=") + 1:].strip().rstrip(";"))
    tramos = []
    for tramo in datos["tramos"]:
        nuevo = {clave: valor for clave, valor in tramo.items() if clave != "norma"}
        nuevo["normas"] = {
            "propia": tramo["norma"],
            "global": {nombre: normalizar_global(nombre, tramo["valor"][nombre]) for nombre in METRICAS},
        }
        tramos.append(nuevo)
    return {
        "version": 1, "id": "parana", "nombre": "Paraná", "fuente": datos["fuente"],
        "unidades": datos["unidades"], "ciudades": datos["ciudades"], "tramos": tramos,
    }


# 2. Río sintético, un cauce que serpentea de noreste a suroeste con la desembocadura al sur
def armar_sintetico():
    azar = random.Random(7)
    cantidad = 44
    tramos = []
    lon, lat = 26.0, 3.0
    rumbo = math.radians(225)
    largo_tramo_km = 24
    km = cantidad * largo_tramo_km
    for k in range(cantidad):
        linea = [[round(lon, 4), round(lat, 4)]]
        for _ in range(6):
            rumbo += azar.uniform(-0.35, 0.35)
            rumbo = 0.85 * rumbo + 0.15 * math.radians(225)
            paso_km = largo_tramo_km / 6
            lat += paso_km * math.cos(rumbo) / 111.2
            lon += paso_km * math.sin(rumbo) / (111.2 * math.cos(math.radians(lat)))
            linea.append([round(lon, 4), round(lat, 4)])
        avance = k / (cantidad - 1)  # 0 en la naciente, 1 en la desembocadura
        valor = {
            "ancho": round(180 * (4500 / 180) ** avance * azar.uniform(0.8, 1.25), 2),
            "nivel": round(420 * (1 - avance) ** 1.6 + 6 + azar.uniform(-2, 2), 2),
            "pendiente": round(max(0.2, 32 * (1 - avance) ** 2 + azar.uniform(-1.5, 1.5)), 2),
            "amplitud": round(1.5 + 6 * math.sin(math.pi * avance) + azar.uniform(-0.8, 0.8), 2),
        }
        tramo = {
            "id": f"9{10000000 + k * 10 + 1:010d}",
            "tipo": "río", "nombre": "Sintetico",
            "km": round(km), "pasadas": azar.randint(30, 110),
            "valor": valor, "normas": {"propia": {}, "global": {}},
            "linea": linea,
        }
        tramos.append(tramo)
        km -= largo_tramo_km

    # Un embalse sin pasadas buenas con valores interpolados
    for k in (14, 15):
        tramos[k].update({"tipo": "lago o embalse", "pasadas": 0,
                          "interpolado": {nombre: True for nombre in METRICAS}})
    # Un tramo que cierra un hueco, y uno con un valor suavizado
    tramos[20]["de_hueco"] = True
    tramos[20]["nombre"] = "no_data"
    tramos[28].update({"corregido": {"ancho": True}, "medido": {"ancho": 95.0}})
    # Un tramo sin ningún dato, que no suena
    tramos[35]["valor"] = {nombre: None for nombre in METRICAS}
    tramos[35]["pasadas"] = 0

    for nombre in METRICAS:
        normalizar_propia(tramos, nombre, log=nombre in ("ancho", "nivel", "amplitud"))
    for tramo in tramos:
        tramo["normas"]["global"] = {nombre: normalizar_global(nombre, tramo["valor"][nombre]) for nombre in METRICAS}

    # Ciudades inventadas. Las dos primeras están juntas para probar que las etiquetas no se pisen
    medio = tramos[22]["linea"][3]
    ciudades = [
        ["Puerto Oeste", round(medio[1] + 0.05, 2), round(medio[0] - 0.25, 2)],
        ["Puerto Este", round(medio[1] - 0.05, 2), round(medio[0] + 0.2, 2)],
        ["Naciente", round(tramos[0]["linea"][0][1] + 0.1, 2), round(tramos[0]["linea"][0][0] + 0.3, 2)],
        ["Boca", round(tramos[-1]["linea"][-1][1] - 0.1, 2), round(tramos[-1]["linea"][-1][0] - 0.3, 2)],
    ]
    return {
        "version": 1, "id": "sintetico", "nombre": "Sintético",
        "fuente": "Río inventado para probar la demo, sin datos reales",
        "unidades": {"ancho": "m", "nivel": "m", "pendiente": "cm/km", "amplitud": "m"},
        "ciudades": ciudades, "tramos": tramos,
    }


# 3. Escritura
def main():
    rios = [armar_parana(), armar_sintetico()]
    for rio in rios:
        archivo = CARPETA / f"{rio['id']}.json"
        archivo.write_text(json.dumps(rio, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{archivo.name}, {len(rio['tramos'])} tramos, {archivo.stat().st_size / 1024:.0f} KB")
    indice = {"rios": [{"id": rio["id"], "nombre": rio["nombre"]} for rio in rios]}
    (CARPETA / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
