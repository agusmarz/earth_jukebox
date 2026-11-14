"""Arma demo/tramos.js a partir de datos/tramos.geojson para la demo del mapa sonoro.

Hace cinco cosas.
1. Cierra los huecos del cauce principal con tramos reales de SWORD. En esos huecos (embalses de
   Itaipú y Porto Primavera, brazos cerca de Goya y Corrientes) SWORD tiene tramos, pero no se
   llaman Parana sino casi todos NODATA. Sus respuestas de Hydrocron están en datos/crudo_huecos,
   con el mismo formato que datos/crudo. Para cada hueco se busca el camino más corto de tramos
   que se tocan entre las dos puntas. Si no hay camino, el hueco queda abierto (nunca se inventa
   geometría).
2. Simplifica la geometría de cada tramo (Ramer-Douglas-Peucker) para que la demo cargue liviana.
3. Corrige los valores de ancho, amplitud y pendiente que caen fuera de un rango físico razonable
   (anchos de 100 m en pleno Paraná, pendientes de cientos de cm/km al pie de una represa) con la
   mediana de los tramos vecinos que sí están en rango, y deja marcado qué valores se corrigieron.
4. Interpola a lo largo del río (por distancia a la desembocadura) los valores de los tramos sin
   pasadas buenas. Solo los valores, la geometría es siempre la de SWORD.
5. Normaliza cada métrica entre 0 y 1 (percentiles 5 y 95 de los valores medidos) para que el
   motor de sonido no tenga que saber nada de unidades.

Uso, desde esta carpeta
    python preparar_demo.py
"""

import heapq
import json
from pathlib import Path

import numpy as np
import pandas as pd

import mapas_rio as mr

CARPETA = Path(__file__).resolve().parent.parent
ENTRADA = CARPETA / "datos" / "tramos.geojson"
CARPETA_HUECOS = CARPETA / "datos" / "crudo_huecos"
SALIDA = CARPETA / "demo" / "tramos.js"

TOLERANCIA_GRADOS = 0.0012  # unos 120 m
VECINOS = 4
RADIO_VECINOS_KM = 45
HUECO_MINIMO_KM = 1.0  # extremos más separados que esto se consideran un hueco
# Dos tramos se consideran unidos si sus extremos están a menos de 1 km. Casi todos se tocan (menos de
# 200 m), el margen es para el tramo 64255000021 de Itaipú, que está en SWORD pero no en Hydrocron y
# deja un corte de 0,9 km. Ese corte queda vacío en el mapa, no se dibuja nada encima.
UNION_MAXIMA_KM = 1.0
PENALIDAD_SALTO = 20  # cada km de salto entre extremos cuesta como 20 km de río, así se prefieren los tramos que se tocan
COLUMNAS_METRICAS = ["nombre", "tipo", "dist_km", "lat", "lon", "p_width", "pasadas_observadas",
                     "pasadas_buenas", "nivel_mediano", "amplitud", "ancho_mediano", "superficie_mediana",
                     "pendiente"]

CIUDADES = [
    ("Rosario", -32.95, -60.64), ("Santa Fe", -31.63, -60.70), ("Paraná", -31.73, -60.52),
    ("Goya", -29.14, -59.26), ("Corrientes", -27.47, -58.83), ("Posadas", -27.37, -55.90),
    ("Foz do Iguaçu", -25.55, -54.59), ("Guaíra", -24.08, -54.26),
]

# Cómo se normaliza cada métrica y qué rango se considera físicamente razonable
METRICAS = {
    "ancho": {"campo": "ancho_mediano", "unidad": "m", "log": True, "rango": (300, np.inf)},
    "nivel": {"campo": "nivel_mediano", "unidad": "m", "log": True, "rango": (-np.inf, np.inf)},
    "pendiente": {"campo": "pendiente", "unidad": "cm/km", "log": False, "rango": (-30, 30)},
    "amplitud": {"campo": "amplitud", "unidad": "m", "log": True, "rango": (-np.inf, 20)},
}


def simplificar(puntos, tolerancia):
    puntos = np.asarray(puntos, dtype=float)
    if len(puntos) < 3:
        return puntos
    conservar = np.zeros(len(puntos), dtype=bool)
    conservar[0] = conservar[-1] = True
    pila = [(0, len(puntos) - 1)]
    while pila:
        inicio, fin = pila.pop()
        if fin - inicio < 2:
            continue
        a, b = puntos[inicio], puntos[fin]
        segmento = b - a
        largo = np.hypot(*segmento)
        tramo = puntos[inicio + 1:fin]
        if largo == 0:
            distancias = np.hypot(*(tramo - a).T)
        else:
            distancias = np.abs(segmento[0] * (tramo[:, 1] - a[1]) - segmento[1] * (tramo[:, 0] - a[0])) / largo
        mayor = int(np.argmax(distancias))
        if distancias[mayor] > tolerancia:
            medio = inicio + 1 + mayor
            conservar[medio] = True
            pila += [(inicio, medio), (medio, fin)]
    return puntos[conservar]


def distancias_km(lat, lon):
    lat0 = np.radians(np.mean(lat))
    x = np.radians(lon) * np.cos(lat0) * 6371
    y = np.radians(lat) * 6371
    return np.hypot(x[:, None] - x[None, :], y[:, None] - y[None, :])


def corregir_outliers(valores, distancias, config):
    minimo, maximo = config["rango"]
    corregidos = valores.copy()
    con_dato = ~np.isnan(valores)
    en_rango = con_dato & (valores >= minimo) & (valores <= maximo)
    marcados = con_dato & ~en_rango
    for i in np.where(marcados)[0]:
        orden = np.argsort(distancias[i])
        vecinos = [j for j in orden[1:] if en_rango[j] and distancias[i, j] <= RADIO_VECINOS_KM][:VECINOS]
        if vecinos:
            corregidos[i] = float(np.median(valores[vecinos]))
        else:
            corregidos[i] = np.clip(valores[i], minimo, maximo)
    return corregidos, marcados


def interpolar_faltantes(valores, km):
    """Completa los tramos sin dato interpolando linealmente por distancia a la desembocadura."""
    faltan = np.isnan(valores)
    completos = valores.copy()
    if faltan.any() and (~faltan).sum() >= 2:
        orden = np.argsort(km[~faltan])
        completos[faltan] = np.interp(km[faltan], km[~faltan][orden], valores[~faltan][orden])
    return completos, faltan


def leer_huecos():
    """Lee datos/crudo_huecos igual que exportar_datos.py lee datos/crudo y calcula las mismas métricas."""
    tablas, geometrias = [], {}
    for archivo in sorted(CARPETA_HUECOS.glob("*.json")):
        entidad = json.loads(archivo.read_text())["results"]["geojson"]["features"][0]
        propiedades = {k: (v if isinstance(v, list) else [v]) for k, v in entidad["properties"].items()}
        tablas.append(mr.limpiar(pd.DataFrame(propiedades)))
        if entidad.get("geometry"):
            geometrias[archivo.stem] = entidad["geometry"]["coordinates"]
    if not tablas:
        return []
    metricas = mr.calcular_metricas(pd.concat(tablas, ignore_index=True))[COLUMNAS_METRICAS].round(4)
    tramos = []
    for id_tramo, fila in metricas.iterrows():
        if id_tramo in geometrias:
            propiedades = {"reach_id": id_tramo}
            propiedades.update({k: (None if pd.isna(v) else v) for k, v in fila.items()})
            tramos.append({"properties": propiedades, "geometry": {"coordinates": geometrias[id_tramo]}})
    return tramos


def separacion_km(a, b, coseno):
    return float(np.hypot((a[0] - b[0]) * coseno * 111.2, (a[1] - b[1]) * 111.2))


def extremos(tramo):
    linea = tramo["geometry"]["coordinates"]
    return linea[0], linea[-1]


def largo_km(tramo, coseno):
    linea = tramo["geometry"]["coordinates"]
    return sum(separacion_km(a, b, coseno) for a, b in zip(linea, linea[1:]))


def cerrar_huecos(tramos, candidatos):
    """Busca, para cada hueco del cauce principal, el camino más corto de tramos candidatos que se tocan.

    Devuelve los candidatos usados y la lista de huecos con el resultado de cada uno.
    """
    coseno = np.cos(np.radians(np.mean([t["properties"]["lat"] for t in tramos])))
    todos = tramos + candidatos
    cantidad_tramos = len(tramos)

    # Grafo de contacto, dos tramos están unidos si algún par de extremos está a menos de UNION_MAXIMA_KM
    vecinos = {i: [] for i in range(len(todos))}
    puntas = [extremos(t) for t in todos]
    for i in range(len(todos)):
        for j in range(i + 1, len(todos)):
            salto = min(separacion_km(x, y, coseno) for x in puntas[i] for y in puntas[j])
            if salto <= UNION_MAXIMA_KM:
                vecinos[i].append((j, salto))
                vecinos[j].append((i, salto))
    largos = [largo_km(t, coseno) for t in todos]

    def camino(origen, destino):
        # Dijkstra pasando solo por candidatos, el costo es el largo de cada tramo intermedio más los saltos
        distancias = {origen: 0.0}
        previo = {}
        cola = [(0.0, origen)]
        while cola:
            costo, nodo = heapq.heappop(cola)
            if nodo == destino:
                recorrido = []
                while nodo in previo:
                    nodo = previo[nodo]
                    if nodo != origen:
                        recorrido.append(nodo)
                return recorrido[::-1]
            if costo > distancias.get(nodo, np.inf):
                continue
            for vecino, salto in vecinos[nodo]:
                if vecino != destino and vecino < cantidad_tramos:
                    continue
                nuevo = costo + PENALIDAD_SALTO * salto + (largos[vecino] if vecino != destino else 0)
                if nuevo < distancias.get(vecino, np.inf):
                    distancias[vecino] = nuevo
                    previo[vecino] = nodo
                    heapq.heappush(cola, (nuevo, vecino))
        return None

    cauce = sorted((i for i, t in enumerate(tramos) if t["properties"]["tipo"] != "topología dudosa"),
                   key=lambda i: tramos[i]["properties"]["dist_km"])
    usados, informe = set(), []
    for a, b in zip(cauce, cauce[1:]):
        hueco = min(separacion_km(x, y, coseno) for x in puntas[a] for y in puntas[b])
        if hueco <= HUECO_MINIMO_KM:
            continue
        recorrido = camino(a, b)
        ids = (tramos[a]["properties"]["reach_id"], tramos[b]["properties"]["reach_id"])
        if recorrido is None:
            informe.append((ids, hueco, None))
        else:
            usados.update(recorrido)
            informe.append((ids, hueco, [todos[k]["properties"]["reach_id"] for k in recorrido]))
    return [todos[k] for k in sorted(usados)], informe


def normalizador(valores_medidos, config):
    """Devuelve una función que lleva valores de la métrica a 0..1 según los percentiles 5 y 95."""
    def transformar(valores):
        base = np.asarray(valores, dtype=float)
        if config["log"]:
            base = np.log(np.clip(base, 1e-3, None))
        if not config["log"] and config["campo"] == "pendiente":
            base = np.clip(base, 0, None)
        return base

    base = transformar(valores_medidos)
    bajo, alto = np.percentile(base[~np.isnan(base)], [5, 95])
    return lambda valores: np.clip((transformar(valores) - bajo) / (alto - bajo), 0, 1)


def main():
    tramos = json.loads(ENTRADA.read_text(encoding="utf-8"))["features"]
    for tramo in tramos:
        tramo["properties"]["de_hueco"] = False
    agregados, informe = cerrar_huecos(tramos, leer_huecos())
    for tramo in agregados:
        tramo["properties"]["de_hueco"] = True
    for (desde, hasta), hueco, recorrido in informe:
        resultado = f"cerrado con {len(recorrido)} tramos" if recorrido is not None else "SIN CAMINO, queda abierto"
        print(f"hueco de {hueco:5.1f} km entre {desde} y {hasta}, {resultado}")
    tramos = tramos + agregados

    lat = np.array([t["properties"]["lat"] for t in tramos])
    lon = np.array([t["properties"]["lon"] for t in tramos])
    km = np.array([t["properties"]["dist_km"] for t in tramos])
    distancias = distancias_km(lat, lon)

    columnas = {}
    for nombre, config in METRICAS.items():
        crudos = np.array([np.nan if t["properties"][config["campo"]] is None else t["properties"][config["campo"]]
                           for t in tramos], dtype=float)
        corregidos, marcados = corregir_outliers(crudos, distancias, config)
        completos, interpolados = interpolar_faltantes(corregidos, km)
        a_cero_uno = normalizador(corregidos, config)
        columnas[nombre] = {
            "crudos": crudos, "completos": completos, "marcados": marcados, "interpolados": interpolados,
            "normalizados": a_cero_uno(completos),
        }
        print(f"{nombre:10s} {int(marcados.sum()):3d} corregidos, {int(interpolados.sum()):3d} interpolados")

    salida = []
    for i, tramo in enumerate(tramos):
        propiedades = tramo["properties"]
        geometria = simplificar(tramo["geometry"]["coordinates"], TOLERANCIA_GRADOS)
        registro = {
            "id": propiedades["reach_id"],
            "tipo": propiedades["tipo"],
            "nombre": propiedades["nombre"],
            "de_hueco": propiedades["de_hueco"],
            "km": round(propiedades["dist_km"]),
            "pasadas": propiedades["pasadas_buenas"],
            "valor": {}, "norma": {}, "corregido": {}, "medido": {}, "interpolado": {},
            "linea": [[round(x, 4), round(y, 4)] for x, y in geometria],
        }
        for nombre, columna in columnas.items():
            registro["valor"][nombre] = round(float(columna["completos"][i]), 2)
            registro["norma"][nombre] = round(float(columna["normalizados"][i]), 3)
            if columna["marcados"][i]:
                registro["corregido"][nombre] = True
                registro["medido"][nombre] = round(float(columna["crudos"][i]), 2)
            if columna["interpolados"][i]:
                registro["interpolado"][nombre] = True
        salida.append(registro)

    print(f"{len(agregados)} tramos de SWORD agregados para cerrar huecos")

    datos = {
        "fuente": "SWOT L2_HR_RiverSP versión D vía Hydrocron, pasadas con reach_q 0 o 1",
        "unidades": {nombre: config["unidad"] for nombre, config in METRICAS.items()},
        "ciudades": CIUDADES,
        "tramos": salida,
    }
    SALIDA.parent.mkdir(exist_ok=True)
    texto = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    SALIDA.write_text(f"window.DATOS_PARANA = {texto};\n", encoding="utf-8")
    puntos = sum(len(t["linea"]) for t in salida)
    print(f"{len(salida)} tramos, {puntos} puntos, {SALIDA.stat().st_size / 1024:.0f} KB en {SALIDA}")


if __name__ == "__main__":
    main()
