"""Los pasos de procesar_rio.py: bajar, exportar, mapas, demo y estaciones.

bajar     elige los tramos del cauce (por ids o por topología), los baja de Hydrocron y busca candidatos
          para cerrar huecos. Deja la elección en datos/<id>/seleccion.json.
exportar  arma datos/<id>/observaciones.csv, metricas.csv y tramos.geojson.
mapas     hace los mapas de mapas/<id>/.
demo      escribe demo/datos/<id>.json y actualiza demo/datos/indice.json.
estaciones escribe demo/datos/estaciones/<id>.json, los mismos datos de la demo para cada estación del año.
"""
import json

from . import carpeta_datos, escribir_texto, hydrocron, sword
from . import demo as demo_rio
from . import estaciones as estaciones_rio
from . import mapas as mapas_rio
from .metricas import (COLUMNAS_METRICAS, VARIABLES_MAPAS, calcular_metricas, entidades_geojson, exportar,
                       leer_observaciones, leer_tramos_geojson, sumar_tramos_solo_sword)

PASOS = ["bajar", "exportar", "mapas", "demo", "estaciones"]


def archivo_seleccion(id_rio):
    return carpeta_datos(id_rio) / "seleccion.json"


def leer_seleccion(id_rio):
    archivo = archivo_seleccion(id_rio)
    if not archivo.exists():
        raise SystemExit(f"Falta {archivo}. Corré primero el paso bajar.")
    return json.loads(archivo.read_text(encoding="utf-8"))


def fichas_solo_sword(seleccion, ids):
    return {i: seleccion["solo_sword"][i] for i in ids if i in seleccion["solo_sword"]}


# Paso bajar

def bajar(rio, actualizar=False):
    id_rio, seleccion = rio["id"], rio["seleccion"]

    # 1. Tramos del cauce principal
    if seleccion["modo"] == "ids":
        ids_cauce = [str(i) for i in seleccion["ids"]]
    else:
        ids_cauce = sword.cauce_por_topologia(seleccion["desembocadura"])
    print(f"{len(ids_cauce)} tramos en el cauce principal de {rio['nombre']} (modo {seleccion['modo']})")

    # 2. Descarga de Hydrocron. En modo topología, lo que Hydrocron no tiene se dibuja con la geometría de SWORD.
    sin_datos = hydrocron.bajar_tramos(id_rio, ids_cauce, actualizar)
    solo_sword = {}
    if seleccion["modo"] == "topologia":
        solo_sword = {i: sword.ficha(i) for i in sin_datos}

    # 3. Candidatos para cerrar huecos con Dijkstra: los de la configuración o los tramos de SWORD cerca de cada hueco
    if "ids_huecos" in seleccion:
        ids_huecos = [str(i) for i in seleccion["ids_huecos"]]
        hydrocron.bajar_tramos(id_rio, ids_huecos, actualizar)
    else:
        ids_huecos = buscar_candidatos(id_rio, ids_cauce, solo_sword, actualizar, seleccion["modo"] == "ids")
        solo_sword.update({i: sword.ficha(i) for i in ids_huecos if hydrocron.leer_tramo(id_rio, i)[0] is None})

    escribir_texto(archivo_seleccion(id_rio), json.dumps(
        {"modo": seleccion["modo"], "ids_cauce": ids_cauce, "ids_huecos": ids_huecos, "solo_sword": solo_sword},
        ensure_ascii=False))
    return ids_cauce, ids_huecos


def buscar_candidatos(id_rio, ids_cauce, solo_sword, actualizar, sin_dudosos):
    observaciones, geometrias = hydrocron.leer_tramos(id_rio, ids_cauce)
    tramos = demo_rio.tramos_candidatos(observaciones, geometrias, solo_sword)
    huecos = demo_rio.huecos_del_cauce(tramos, sin_dudosos)
    if not huecos:
        print("El cauce no tiene huecos")
        return []
    extremos = []
    for a, b, _ in huecos:
        centro_a = (tramos[a]["properties"]["lon"], tramos[a]["properties"]["lat"])
        centro_b = (tramos[b]["properties"]["lon"], tramos[b]["properties"]["lat"])
        extremos.append((centro_a, centro_b, sword.continente_de(tramos[a]["properties"]["reach_id"])))
    candidatos = sword.candidatos_cerca(extremos, excluir=set(ids_cauce))
    print(f"{len(huecos)} huecos en el cauce, {len(candidatos)} tramos de SWORD candidatos para cerrarlos")
    hydrocron.bajar_tramos(id_rio, candidatos, actualizar)
    return candidatos


# Paso exportar

def exportar_datos(rio):
    seleccion = leer_seleccion(rio["id"])
    observaciones, geometrias = hydrocron.leer_tramos(rio["id"], seleccion["ids_cauce"])
    return exportar(rio["id"], observaciones, geometrias, fichas_solo_sword(seleccion, seleccion["ids_cauce"]))


# Paso mapas

def metricas_y_geometrias(rio, desde=None, hasta=None):
    seleccion = leer_seleccion(rio["id"])
    observaciones = leer_observaciones(rio["id"])
    metricas = calcular_metricas(observaciones, desde, hasta)
    metricas = sumar_tramos_solo_sword(metricas, fichas_solo_sword(seleccion, seleccion["ids_cauce"]))
    geometrias = {f["properties"]["reach_id"]: f["geometry"]["coordinates"] for f in leer_tramos_geojson(rio["id"])}
    return observaciones, metricas, geometrias


def hacer_mapas(rio, variables=VARIABLES_MAPAS, con_png=True):
    observaciones, metricas, geometrias = metricas_y_geometrias(rio)
    inicio = observaciones["fecha"].min().strftime("%Y-%m-%d")
    fin = observaciones["fecha"].max().strftime("%Y-%m-%d")
    subtitulo = f"Río {rio['nombre']}, SWOT {inicio} a {fin}, pasadas con reach_q 0 o 1"
    carpeta = mapas_rio.hacer_mapas(rio, metricas, geometrias, variables, subtitulo, con_png=con_png)
    print(f"Mapas en {carpeta}")


# Paso demo

def preparar_demo(rio, escribir=True):
    seleccion = leer_seleccion(rio["id"])
    tramos = leer_tramos_geojson(rio["id"])
    observaciones, geometrias = hydrocron.leer_tramos(rio["id"], seleccion["ids_huecos"])
    candidatos = demo_rio.tramos_candidatos(observaciones, geometrias,
                                            fichas_solo_sword(seleccion, seleccion["ids_huecos"]))
    datos, resumen = demo_rio.preparar(rio, tramos, candidatos)
    demo_rio.imprimir_resumen(resumen, len(datos["tramos"]))
    if escribir:
        archivo = demo_rio.escribir(datos)
        print(f"{archivo} ({archivo.stat().st_size / 1024:.0f} KB)")
    return datos, resumen


# Paso estaciones

def tramos_de_estacion(seleccion, observaciones, geometrias, meses):
    """Los mismos tramos del cauce que tramos.geojson, con las métricas de las pasadas de esos meses."""
    metricas = calcular_metricas(observaciones, meses=meses)
    metricas = sumar_tramos_solo_sword(metricas, fichas_solo_sword(seleccion, seleccion["ids_cauce"]))
    return entidades_geojson(metricas[COLUMNAS_METRICAS].round(4), geometrias)


def preparar_estaciones(rio, escribir=True):
    seleccion = leer_seleccion(rio["id"])
    tramos_anuales = leer_tramos_geojson(rio["id"])
    geometrias = {f["properties"]["reach_id"]: f["geometry"]["coordinates"] for f in tramos_anuales}
    observaciones = leer_observaciones(rio["id"])
    obs_huecos, geo_huecos = hydrocron.leer_tramos(rio["id"], seleccion["ids_huecos"])
    solo_sword_huecos = fichas_solo_sword(seleccion, seleccion["ids_huecos"])

    # El año entero da la normalización propia que comparten las cuatro estaciones
    candidatos = demo_rio.tramos_candidatos(obs_huecos, geo_huecos, solo_sword_huecos)
    anual, resumen_anual = demo_rio.preparar(rio, tramos_anuales, candidatos)

    por_estacion = {}
    for estacion, meses in estaciones_rio.meses_por_estacion(rio["hemisferio"]).items():
        tramos = tramos_de_estacion(seleccion, observaciones, geometrias, meses)
        candidatos = demo_rio.tramos_candidatos(obs_huecos, geo_huecos, solo_sword_huecos, meses=meses)
        datos, resumen = demo_rio.preparar(rio, tramos, candidatos, resumen_anual["normalizadores"])
        por_estacion[estacion] = (meses, datos, resumen)

    salida = estaciones_rio.armar(rio, por_estacion, anual)
    estaciones_rio.imprimir_resumen(por_estacion, anual)
    if escribir:
        archivo = estaciones_rio.escribir(salida)
        print(f"{archivo} ({archivo.stat().st_size / 1024:.0f} KB)")
    return salida, por_estacion


def correr(rio, pasos, actualizar=False):
    for paso in PASOS:
        if paso not in pasos:
            continue
        print(f"== {paso}")
        if paso == "bajar":
            bajar(rio, actualizar)
        elif paso == "exportar":
            exportar_datos(rio)
        elif paso == "mapas":
            hacer_mapas(rio)
        elif paso == "demo":
            preparar_demo(rio)
        elif paso == "estaciones":
            preparar_estaciones(rio)
