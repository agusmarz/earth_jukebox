"""Datos de un río para la demo del mapa sonoro, en demo/datos/<id>.json.

Hace cinco cosas.
1. Cierra los huecos del cauce principal con tramos reales de SWORD (los de seleccion.ids_huecos, o los
   que se encontraron cerca de cada hueco). Para cada hueco se busca el camino más corto de tramos que se
   tocan entre las dos puntas. Si no hay camino, el hueco queda abierto (nunca se inventa geometría).
2. Marca y corrige los valores raros con la mediana de los tramos vecinos que no están marcados. Con
   criterios "absolutos" un valor es raro si cae fuera de un rango fijo. Con criterios "relativos" un
   ancho es raro si está fuera de 0,3 a 3 veces el ancho de referencia de SWORD (p_width), y una
   pendiente o una amplitud si su z robusto (con la MAD) respecto de los vecinos a lo largo del cauce
   pasa de 3,5.
3. Interpola a lo largo del río (por distancia a la desembocadura) los valores de los tramos sin pasadas
   buenas. Solo los valores, la geometría es siempre la de SWORD.
4. Normaliza cada métrica entre 0 y 1 de dos maneras. "propia" usa los percentiles 5 y 95 de los valores
   medidos del río, con la escala de cada criterio. "global" usa los rangos fijos de
   rios/escalas_globales.json, iguales para todos los ríos.
5. Simplifica la geometría de cada tramo (Ramer-Douglas-Peucker) para que la demo cargue liviana.
"""
import heapq
import json

import numpy as np
import pandas as pd

from . import CARPETA_DEMO_DATOS, cargar_escalas_globales, escribir_texto
from .metricas import COLUMNAS_METRICAS, calcular_metricas, entidades_geojson, sumar_tramos_solo_sword

VERSION = 1
FUENTE = "SWOT L2_HR_RiverSP versión D vía Hydrocron, pasadas con reach_q 0 o 1"
TOLERANCIA_GRADOS = 0.0012  # unos 120 m
VECINOS = 4
RADIO_VECINOS_KM = 45
HUECO_MINIMO_KM = 1.0  # extremos más separados que esto se consideran un hueco
# Dos tramos se consideran unidos si sus extremos están a menos de 1 km. Casi todos se tocan (menos de
# 200 m). El margen es para tramos que están en SWORD pero no en Hydrocron y dejan un corte chico (hay
# uno de 0,9 km en un embalse). Ese corte queda vacío en el mapa, no se dibuja nada encima.
UNION_MAXIMA_KM = 1.0
PENALIDAD_SALTO = 20  # cada km de salto entre extremos cuesta como 20 km de río, así se prefieren los tramos que se tocan

# Métricas de la demo, de qué columna salen y en qué unidad están
METRICAS = {
    "ancho": {"campo": "ancho_mediano", "unidad": "m"},
    "nivel": {"campo": "nivel_mediano", "unidad": "m"},
    "pendiente": {"campo": "pendiente", "unidad": "cm/km"},
    "amplitud": {"campo": "amplitud", "unidad": "m"},
}
# Escala de la normalización propia según el criterio. La pendiente negativa se lleva a cero antes.
ESCALAS = {
    "absolutos": {"ancho": "log", "nivel": "log", "pendiente": "lineal", "amplitud": "log"},
    "relativos": {"ancho": "log", "nivel": "lineal", "pendiente": "lineal", "amplitud": "log"},
}
SOLO_POSITIVAS = {"pendiente"}

# Criterios relativos
ANCHO_RELATIVO = (0.3, 3.0)  # veces p_width
Z_ROBUSTO_MAXIMO = 3.5
VECINOS_MAD = 10  # tramos con dato más cercanos a lo largo del cauce con los que se calcula la MAD
MAD_A_SIGMA = 0.6745
# Piso de la MAD, del orden del ruido de SWOT por tramo. Sin él, donde el río es muy parejo (pendientes casi
# cero cerca de la desembocadura) cualquier diferencia de milímetros da un z enorme y se marcaría como rara.
MAD_MINIMA = {"pendiente": 1.0, "amplitud": 0.25}  # cm/km y m


# Geometría

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


def separacion_km(a, b, coseno):
    return float(np.hypot((a[0] - b[0]) * coseno * 111.2, (a[1] - b[1]) * 111.2))


def extremos(tramo):
    linea = tramo["geometry"]["coordinates"]
    return linea[0], linea[-1]


def largo_km(tramo, coseno):
    linea = tramo["geometry"]["coordinates"]
    return sum(separacion_km(a, b, coseno) for a, b in zip(linea, linea[1:]))


# Cierre de huecos

def tramos_candidatos(observaciones, geometrias, solo_sword=None, meses=None):
    """Arma los candidatos a cerrar huecos con las mismas métricas que los tramos del cauce."""
    if observaciones.empty and not solo_sword:
        return []
    metricas = calcular_metricas(observaciones, meses=meses) if not observaciones.empty else pd.DataFrame(
        columns=COLUMNAS_METRICAS).rename_axis("reach_id")
    metricas = sumar_tramos_solo_sword(metricas, solo_sword or {})[COLUMNAS_METRICAS].round(4)
    geometrias = dict(geometrias)
    for id_tramo, ficha in (solo_sword or {}).items():
        geometrias.setdefault(id_tramo, ficha["linea"])
    return entidades_geojson(metricas, geometrias)


def huecos_del_cauce(tramos, sin_dudosos=True):
    """Pares de tramos consecutivos del cauce (por distancia a la desembocadura) cuyos extremos no se tocan.

    Con sin_dudosos se dejan afuera los tramos de topología dudosa, que en una lista de ids suelen ser brazos
    paralelos (un delta). En un cauce elegido por topología son un solo camino y cuentan como los demás.
    """
    if not tramos:
        return []
    coseno = np.cos(np.radians(np.mean([t["properties"]["lat"] for t in tramos])))
    puntas = [extremos(t) for t in tramos]
    cauce = sorted((i for i, t in enumerate(tramos) if not sin_dudosos or t["properties"]["tipo"] != "topología dudosa"),
                   key=lambda i: tramos[i]["properties"]["dist_km"])
    huecos = []
    for a, b in zip(cauce, cauce[1:]):
        hueco = min(separacion_km(x, y, coseno) for x in puntas[a] for y in puntas[b])
        if hueco > HUECO_MINIMO_KM:
            huecos.append((a, b, hueco))
    return huecos


def cerrar_huecos(tramos, candidatos, sin_dudosos=True):
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

    usados, informe = set(), []
    for a, b, hueco in huecos_del_cauce(tramos, sin_dudosos):
        recorrido = camino(a, b)
        ids = (tramos[a]["properties"]["reach_id"], tramos[b]["properties"]["reach_id"])
        if recorrido is None:
            informe.append((ids, hueco, None))
        else:
            usados.update(recorrido)
            informe.append((ids, hueco, [todos[k]["properties"]["reach_id"] for k in recorrido]))
    return [todos[k] for k in sorted(usados)], informe


# Valores raros

def marcar_fuera_de_rango(valores, minimos, maximos):
    con_dato = ~np.isnan(valores)
    en_rango = con_dato & (valores >= minimos) & (valores <= maximos)
    return con_dato & ~en_rango


def marcar_por_mad(valores, km, mad_minima=0.0):
    """Marca los valores con z robusto mayor a Z_ROBUSTO_MAXIMO respecto de sus vecinos a lo largo del cauce.

    Devuelve los marcados y, para cada uno, los límites de valores no raros (por si no hay vecinos para corregir).
    """
    con_dato = np.where(~np.isnan(valores))[0]
    marcados = np.zeros(len(valores), dtype=bool)
    minimos = np.full(len(valores), -np.inf)
    maximos = np.full(len(valores), np.inf)
    for i in con_dato:
        otros = con_dato[con_dato != i]
        if len(otros) < 3:
            continue
        cercanos = otros[np.argsort(np.abs(km[otros] - km[i]), kind="stable")[:VECINOS_MAD]]
        mediana = float(np.median(valores[cercanos]))
        mad = max(float(np.median(np.abs(valores[cercanos] - mediana))), mad_minima)
        if mad == 0:
            continue
        radio = Z_ROBUSTO_MAXIMO * mad / MAD_A_SIGMA
        minimos[i], maximos[i] = mediana - radio, mediana + radio
        marcados[i] = abs(valores[i] - mediana) > radio
    return marcados, minimos, maximos


def corregir(valores, marcados, distancias, minimos, maximos):
    """Reemplaza cada valor marcado por la mediana de hasta VECINOS tramos cercanos con dato y sin marcar."""
    corregidos = valores.copy()
    validos = ~np.isnan(valores) & ~marcados
    for i in np.where(marcados)[0]:
        orden = np.argsort(distancias[i])
        vecinos = [j for j in orden if j != i and validos[j] and distancias[i, j] <= RADIO_VECINOS_KM][:VECINOS]
        if vecinos:
            corregidos[i] = float(np.median(valores[vecinos]))
        else:
            corregidos[i] = np.clip(valores[i], minimos[i], maximos[i])
    return corregidos


def rango_absoluto(criterios, nombre, cantidad):
    minimo, maximo = criterios["rangos"].get(nombre, [None, None])
    minimo = -np.inf if minimo is None else float(minimo)
    maximo = np.inf if maximo is None else float(maximo)
    return np.full(cantidad, minimo), np.full(cantidad, maximo)


def marcar_raros(nombre, crudos, criterios, ancho_referencia, km):
    if criterios["modo"] == "absolutos":
        minimos, maximos = rango_absoluto(criterios, nombre, len(crudos))
        return marcar_fuera_de_rango(crudos, minimos, maximos), minimos, maximos
    if nombre == "ancho":
        referencia = np.where(ancho_referencia > 0, ancho_referencia, np.nan)
        minimos = np.nan_to_num(ANCHO_RELATIVO[0] * referencia, nan=-np.inf)
        maximos = np.nan_to_num(ANCHO_RELATIVO[1] * referencia, nan=np.inf)
        return marcar_fuera_de_rango(crudos, minimos, maximos), minimos, maximos
    if nombre in ("pendiente", "amplitud"):
        return marcar_por_mad(crudos, km, MAD_MINIMA[nombre])
    sin_limite = np.full(len(crudos), np.inf)
    return np.zeros(len(crudos), dtype=bool), -sin_limite, sin_limite


# Interpolación y normalización

def interpolar_faltantes(valores, km):
    """Completa los tramos sin dato interpolando linealmente por distancia a la desembocadura."""
    faltan = np.isnan(valores)
    completos = valores.copy()
    if faltan.any() and (~faltan).sum() >= 2:
        orden = np.argsort(km[~faltan])
        completos[faltan] = np.interp(km[faltan], km[~faltan][orden], valores[~faltan][orden])
    return completos, faltan


def transformar(valores, escala, solo_positivas, minimo_log=1e-3):
    base = np.asarray(valores, dtype=float)
    if escala == "log":
        return np.log(np.clip(base, minimo_log, None))
    if solo_positivas:
        return np.clip(base, 0, None)
    return base


def normalizador_propio(valores_medidos, escala, solo_positivas):
    """Lleva valores a 0..1 según los percentiles 5 y 95 de los valores medidos del río."""
    base = transformar(valores_medidos, escala, solo_positivas)
    base = base[~np.isnan(base)]
    if len(base) == 0:
        return lambda valores: np.full(len(valores), 0.5)
    bajo, alto = np.percentile(base, [5, 95])
    if alto == bajo:
        return lambda valores: np.full(len(valores), 0.5)
    return lambda valores: np.clip((transformar(valores, escala, solo_positivas) - bajo) / (alto - bajo), 0, 1)


def normalizador_global(escala_global, solo_positivas):
    """Lleva valores a 0..1 con un rango fijo, el mismo para todos los ríos."""
    escala, minimo, maximo = escala_global["escala"], escala_global["minimo"], escala_global["maximo"]
    bajo, alto = transformar([minimo, maximo], escala, solo_positivas, minimo_log=minimo)
    return lambda valores: np.clip(
        (transformar(valores, escala, solo_positivas, minimo_log=minimo) - bajo) / (alto - bajo), 0, 1)


# Programa

def preparar(rio, tramos, candidatos, normalizadores=None):
    """Arma el diccionario de la demo con el contrato de demo/datos/<id>.json y un resumen de lo hecho.

    normalizadores es {métrica: función} para la normalización propia. Sin él se calcula con los valores de
    estos mismos tramos. Las estaciones pasan los del año entero, así las cuatro comparten la escala y se
    escucha la diferencia entre una y otra. Los que se usaron vuelven en resumen["normalizadores"]."""
    criterios = rio["criterios"]
    escalas = dict(ESCALAS[criterios["modo"]], **criterios.get("escalas", {}))
    escalas_globales = cargar_escalas_globales()["metricas"]

    # 1. Cierre de huecos
    tramos = [dict(t, properties=dict(t["properties"], de_hueco=False)) for t in tramos]
    agregados, informe = cerrar_huecos(tramos, candidatos, sin_dudosos=rio["seleccion"]["modo"] == "ids")
    agregados = [dict(t, properties=dict(t["properties"], de_hueco=True)) for t in agregados]
    tramos = tramos + agregados

    lat = np.array([t["properties"]["lat"] for t in tramos])
    lon = np.array([t["properties"]["lon"] for t in tramos])
    km = np.array([t["properties"]["dist_km"] for t in tramos])
    ancho_referencia = np.array([np.nan if t["properties"]["p_width"] is None else t["properties"]["p_width"]
                                 for t in tramos], dtype=float)
    if criterios["modo"] == "absolutos":
        distancias = distancias_km(lat, lon)
    else:
        distancias = np.abs(km[:, None] - km[None, :])  # a lo largo del cauce

    columnas = {}
    propios = {}
    for nombre, config in METRICAS.items():
        crudos = np.array([np.nan if t["properties"][config["campo"]] is None else t["properties"][config["campo"]]
                           for t in tramos], dtype=float)
        # 2. Valores raros
        marcados, minimos, maximos = marcar_raros(nombre, crudos, criterios, ancho_referencia, km)
        corregidos = corregir(crudos, marcados, distancias, minimos, maximos)
        # 3. Interpolación a lo largo del cauce
        completos, interpolados = interpolar_faltantes(corregidos, km)
        # 4. Normalizaciones propia y global
        solo_positivas = nombre in SOLO_POSITIVAS
        if normalizadores is None:
            propia = normalizador_propio(corregidos, escalas[nombre], solo_positivas)
        else:
            propia = normalizadores[nombre]
        propios[nombre] = propia
        global_ = normalizador_global(escalas_globales[nombre], solo_positivas)
        columnas[nombre] = {"crudos": crudos, "completos": completos, "marcados": marcados,
                            "interpolados": interpolados, "propia": propia(completos), "global": global_(completos)}

    salida = []
    for i, tramo in enumerate(tramos):
        propiedades = tramo["properties"]
        # 5. Geometría simplificada
        geometria = simplificar(tramo["geometry"]["coordinates"], TOLERANCIA_GRADOS)
        registro = {
            "id": propiedades["reach_id"],
            "tipo": propiedades["tipo"],
            "nombre": propiedades["nombre"],
            "de_hueco": propiedades["de_hueco"],
            "km": round(propiedades["dist_km"]),
            "pasadas": propiedades["pasadas_buenas"],
            "valor": {}, "normas": {"propia": {}, "global": {}}, "corregido": {}, "medido": {}, "interpolado": {},
            "linea": [[round(x, 4), round(y, 4)] for x, y in geometria],
        }
        for nombre, columna in columnas.items():
            registro["valor"][nombre] = round(float(columna["completos"][i]), 2)
            registro["normas"]["propia"][nombre] = round(float(columna["propia"][i]), 3)
            registro["normas"]["global"][nombre] = round(float(columna["global"][i]), 3)
            if columna["marcados"][i]:
                registro["corregido"][nombre] = True
                registro["medido"][nombre] = round(float(columna["crudos"][i]), 2)
            if columna["interpolados"][i]:
                registro["interpolado"][nombre] = True
        salida.append(registro)

    datos = {
        "version": VERSION,
        "id": rio["id"],
        "nombre": rio["nombre"],
        "fuente": FUENTE,
        "unidades": {nombre: config["unidad"] for nombre, config in METRICAS.items()},
        "ciudades": [list(c) for c in rio["ciudades"]],
        "tramos": salida,
    }
    resumen = {
        "huecos": informe,
        "agregados": len(agregados),
        "corregidos": {n: int(c["marcados"].sum()) for n, c in columnas.items()},
        "interpolados": {n: int(c["interpolados"].sum()) for n, c in columnas.items()},
        "sin_valor": {n: int(np.isnan(c["completos"]).sum()) for n, c in columnas.items()},
        "normalizadores": propios,
    }
    return datos, resumen


def escribir(datos):
    archivo = CARPETA_DEMO_DATOS / f"{datos['id']}.json"
    escribir_texto(archivo, json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + "\n")
    actualizar_indice(datos["id"], datos["nombre"])
    return archivo


def actualizar_indice(id_rio, nombre):
    archivo = CARPETA_DEMO_DATOS / "indice.json"
    indice = json.loads(archivo.read_text(encoding="utf-8")) if archivo.exists() else {"rios": []}
    for rio in indice["rios"]:
        if rio["id"] == id_rio:
            rio["nombre"] = nombre
            break
    else:
        indice["rios"].append({"id": id_rio, "nombre": nombre})
    escribir_texto(archivo, json.dumps(indice, ensure_ascii=False, indent=2) + "\n")


def imprimir_resumen(resumen, cantidad_tramos):
    for (desde, hasta), hueco, recorrido in resumen["huecos"]:
        resultado = f"cerrado con {len(recorrido)} tramos" if recorrido is not None else "SIN CAMINO, queda abierto"
        print(f"hueco de {hueco:5.1f} km entre {desde} y {hasta}, {resultado}")
    for nombre in METRICAS:
        print(f"{nombre:10s} {resumen['corregidos'][nombre]:3d} corregidos, "
              f"{resumen['interpolados'][nombre]:3d} interpolados")
    print(f"{resumen['agregados']} tramos de SWORD agregados para cerrar huecos, {cantidad_tramos} tramos en total")
