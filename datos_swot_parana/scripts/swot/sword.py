"""SWORD (SWOT River Database): índice de búsqueda por nombre, tramos de v17b y selección del cauce.

El índice de SWORD Explorer (unos 38 MB) solo trae reach_id, river_name, centro, bbox y continente, así
que no alcanza para seguir el río. La topología (rch_id_up, rch_id_dn, facc) sale de la distribución
oficial de SWORD v17b en Zenodo (https://doi.org/10.5281/zenodo.15299138). Esa distribución es un
zip de casi 2 GB con un GeoPackage de tramos por continente adentro. Como Zenodo acepta pedidos por
rango de bytes, se baja solo el GeoPackage del continente que hace falta (130 a 330 MB comprimido) y
se guarda una única vez en datos/cache_sword/, que está en .gitignore.
"""
import json
import sqlite3
import struct
import zlib
from pathlib import Path

import requests

from . import CARPETA_DATOS

URL_INDICE_SWORD = "https://pub-ceb2c39205d5401cac3cf448cff9518d.r2.dev/tiles/reach_search_index.json"
URL_ZIP_SWORD = "https://zenodo.org/api/records/15299138/files/SWORD_v17b_gpkg.zip/content"
CARPETA_CACHE_SWORD = CARPETA_DATOS / "cache_sword"
LIMITE_DESCARGA_BYTES = 1_000_000_000  # más que esto no se baja sin avisar

# Primer dígito del reach_id (región de SWORD) al archivo de continente de la distribución
CONTINENTES = {"1": "af", "2": "eu", "3": "as", "4": "as", "5": "oc", "6": "sa", "7": "na", "8": "na", "9": "na"}

sesion = requests.Session()


# 1. Índice de SWORD Explorer, para buscar tramos por nombre

def indice_explorer():
    archivo = CARPETA_CACHE_SWORD / "reach_search_index.json"
    if not archivo.exists():
        print("Bajando el índice de SWORD Explorer (unos 38 MB)...")
        respuesta = sesion.get(URL_INDICE_SWORD, timeout=300)
        respuesta.raise_for_status()
        archivo.parent.mkdir(parents=True, exist_ok=True)
        archivo.write_bytes(respuesta.content)
    return json.loads(archivo.read_text(encoding="utf-8"))


def ids_por_nombre(nombre):
    nombre = nombre.lower()
    return [r["reach_id"] for r in indice_explorer()["records"]
            if r.get("river_name") and nombre in r["river_name"].lower()]


# 2. GeoPackage de tramos de SWORD v17b, bajado una sola vez por continente

def continente_de(id_tramo):
    return CONTINENTES[str(id_tramo)[0]]


def ruta_gpkg(continente):
    return CARPETA_CACHE_SWORD / f"{continente}_sword_reaches_v17b.gpkg"


def _leer_rango(desde, hasta):
    respuesta = sesion.get(URL_ZIP_SWORD, headers={"Range": f"bytes={desde}-{hasta}"}, timeout=600)
    if respuesta.status_code != 206:
        raise SystemExit(f"Zenodo no aceptó el pedido por rango (código {respuesta.status_code})")
    return respuesta.content


def _entradas_del_zip():
    """Lee el directorio central del zip remoto, sin bajar el zip."""
    total = int(sesion.head(URL_ZIP_SWORD, allow_redirects=True, timeout=60).headers["content-length"])
    cola = _leer_rango(max(0, total - 200_000), total - 1)
    base = total - len(cola)
    zip64 = cola.rfind(b"PK\x06\x06")
    if zip64 >= 0:
        _, inicio_directorio = struct.unpack("<QQ", cola[zip64 + 40:zip64 + 56])
    else:
        fin = cola.rfind(b"PK\x05\x06")
        _, inicio_directorio = struct.unpack("<II", cola[fin + 12:fin + 20])
    entradas, p = {}, inicio_directorio - base
    while cola[p:p + 4] == b"PK\x01\x02":
        metodo, = struct.unpack("<H", cola[p + 10:p + 12])
        comprimido, descomprimido = struct.unpack("<II", cola[p + 20:p + 28])
        largo_nombre, largo_extra, largo_comentario = struct.unpack("<HHH", cola[p + 28:p + 34])
        posicion, = struct.unpack("<I", cola[p + 42:p + 46])
        nombre = cola[p + 46:p + 46 + largo_nombre].decode()
        extra = cola[p + 46 + largo_nombre:p + 46 + largo_nombre + largo_extra]
        k = 0
        while k < len(extra):
            etiqueta, tamano = struct.unpack("<HH", extra[k:k + 4])
            if etiqueta == 1:  # campos de 64 bits
                cuerpo, q = extra[k + 4:k + 4 + tamano], 0
                if descomprimido == 0xFFFFFFFF:
                    descomprimido, = struct.unpack("<Q", cuerpo[q:q + 8]); q += 8
                if comprimido == 0xFFFFFFFF:
                    comprimido, = struct.unpack("<Q", cuerpo[q:q + 8]); q += 8
                if posicion == 0xFFFFFFFF:
                    posicion, = struct.unpack("<Q", cuerpo[q:q + 8]); q += 8
            k += 4 + tamano
        entradas[nombre] = dict(metodo=metodo, comprimido=comprimido, descomprimido=descomprimido, posicion=posicion)
        p += 46 + largo_nombre + largo_extra + largo_comentario
    return entradas


def bajar_gpkg(continente):
    archivo = ruta_gpkg(continente)
    if archivo.exists():
        return archivo
    nombre = f"gpkg/{continente}_sword_reaches_v17b.gpkg"
    entrada = _entradas_del_zip().get(nombre)
    if entrada is None:
        raise SystemExit(f"El zip de SWORD v17b no tiene {nombre}")
    if entrada["comprimido"] > LIMITE_DESCARGA_BYTES or entrada["descomprimido"] > LIMITE_DESCARGA_BYTES:
        raise SystemExit(f"{nombre} pesa {entrada['descomprimido'] / 1e9:.1f} GB, más de 1 GB. "
                         f"Bajalo a mano a {archivo} si querés usarlo.")
    print(f"Bajando {nombre} de SWORD v17b ({entrada['comprimido'] / 1e6:.0f} MB, una sola vez)...")
    encabezado = _leer_rango(entrada["posicion"], entrada["posicion"] + 29)
    largo_nombre, largo_extra = struct.unpack("<HH", encabezado[26:30])
    inicio = entrada["posicion"] + 30 + largo_nombre + largo_extra
    archivo.parent.mkdir(parents=True, exist_ok=True)
    temporal = archivo.with_suffix(".parcial")
    descompresor = zlib.decompressobj(-15) if entrada["metodo"] == 8 else None
    with sesion.get(URL_ZIP_SWORD, headers={"Range": f"bytes={inicio}-{inicio + entrada['comprimido'] - 1}"},
                    stream=True, timeout=600) as respuesta, open(temporal, "wb") as salida:
        if respuesta.status_code != 206:
            raise SystemExit(f"Zenodo no aceptó el pedido por rango (código {respuesta.status_code})")
        for bloque in respuesta.iter_content(1 << 20):
            salida.write(descompresor.decompress(bloque) if descompresor else bloque)
        if descompresor:
            salida.write(descompresor.flush())
    if temporal.stat().st_size != entrada["descomprimido"]:
        temporal.unlink()
        raise SystemExit(f"La descarga de {nombre} quedó incompleta, probá de nuevo")
    temporal.replace(archivo)
    return archivo


# 3. Lectura de los tramos de SWORD v17b

_tramos_por_continente = {}


def _linea_gpkg(blob):
    """Pasa una geometría de GeoPackage (encabezado GP más WKB de una LineString) a [[lon, lat], ...]."""
    banderas = blob[3]
    largo_envolvente = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(banderas >> 1) & 7]
    p = 8 + largo_envolvente
    orden = "<" if blob[p] == 1 else ">"
    tipo, = struct.unpack(orden + "I", blob[p + 1:p + 5])
    if tipo % 1000 != 2:
        return None
    dimensiones = 3 if tipo // 1000 in (1, 2) else 4 if tipo // 1000 == 3 else 2
    cantidad, = struct.unpack(orden + "I", blob[p + 5:p + 9])
    valores = struct.unpack(orden + "d" * cantidad * dimensiones, blob[p + 9:p + 9 + 8 * cantidad * dimensiones])
    return [[valores[i], valores[i + 1]] for i in range(0, len(valores), dimensiones)]


def tramos_sword(continente):
    """Todos los tramos de un continente, por reach_id (texto), con su topología y atributos."""
    if continente not in _tramos_por_continente:
        conexion = sqlite3.connect(bajar_gpkg(continente))
        consulta = ("select reach_id, river_name, facc, rch_id_up, rch_id_dn, dist_out, width, x, y, "
                    "path_freq, geom from reaches")
        tramos = {}
        for (reach_id, nombre, facc, arriba, abajo, dist_out, ancho, x, y, frecuencia,
             geometria) in conexion.execute(consulta):
            tramos[str(reach_id)] = {
                "nombre": nombre, "facc": facc or 0.0, "arriba": (arriba or "").split(),
                "abajo": (abajo or "").split(), "dist_km": dist_out / 1000, "p_width": ancho, "lat": y, "lon": x,
                "path_freq": frecuencia, "geometria": geometria,
            }
        conexion.close()
        _tramos_por_continente[continente] = tramos
    return _tramos_por_continente[continente]


def linea(tramo):
    if isinstance(tramo["geometria"], bytes):
        tramo["geometria"] = _linea_gpkg(tramo["geometria"])
    return tramo["geometria"]


def ficha(id_tramo):
    """Lo que hace falta de SWORD para dibujar y ubicar un tramo que Hydrocron no tiene."""
    tramo = tramos_sword(continente_de(id_tramo))[id_tramo]
    return {"nombre": tramo["nombre"], "dist_km": tramo["dist_km"], "p_width": tramo["p_width"],
            "lat": tramo["lat"], "lon": tramo["lon"], "linea": linea(tramo)}


# 4. Cauce principal por topología

# El facc (área de aporte) de SWORD tiene errores de un tramo o de rachas cortas: brazos que salen del
# río con el facc del río entero, o tramos del cauce con facc casi cero (hay rachas de siete seguidos,
# y en los deltas es común). Por eso el facc de
# cada vecino se mira sobre su cadena aguas arriba (el propio vecino y los que siguen subiendo por el
# de mayor facc, hasta TRAMOS_A_MIRAR) y se toma su percentil PERCENTIL_FACC. Un valor aislado, alto o
# bajo, no alcanza para cambiar la elección. Los empates se resuelven con path_freq y después con facc.
TRAMOS_A_MIRAR = 20
PERCENTIL_FACC = 0.75


def _facc_de_la_cadena(tramos, id_tramo, ya_usados, sentido="arriba"):
    valores, actual, vistos = [tramos[id_tramo]["facc"]], id_tramo, set(ya_usados) | {id_tramo}
    for _ in range(TRAMOS_A_MIRAR - 1):
        vecinos = [u for u in tramos[actual][sentido] if u in tramos and u not in vistos]
        if not vecinos:
            break
        actual = max(vecinos, key=lambda u: tramos[u]["facc"])
        vistos.add(actual)
        valores.append(tramos[actual]["facc"])
    valores.sort()
    return valores[int(PERCENTIL_FACC * (len(valores) - 1))]


def _seguir(tramos, inicio, sentido):
    camino, usados = [inicio], {inicio}
    while True:
        vecinos = [u for u in tramos[camino[-1]][sentido] if u in tramos and u not in usados]
        if not vecinos:
            return camino
        siguiente = max(vecinos, key=lambda u: (_facc_de_la_cadena(tramos, u, usados, sentido),
                                                tramos[u]["path_freq"], tramos[u]["facc"]))
        camino.append(siguiente)
        usados.add(siguiente)


def cauce_por_topologia(desembocadura):
    """Desde la desembocadura sube siempre por el vecino aguas arriba de mayor facc hasta la naciente."""
    desembocadura = str(desembocadura)
    tramos = tramos_sword(continente_de(desembocadura))
    if desembocadura not in tramos:
        raise SystemExit(f"El tramo {desembocadura} no está en SWORD v17b")
    return _seguir(tramos, desembocadura, "arriba")


def buscar_desembocadura(nombre):
    """Desde el tramo con ese nombre más cercano a la desembocadura, baja por el vecino de mayor facc hasta el mar.

    Devuelve el reach_id de la desembocadura y el tramo con nombre del que se partió.
    """
    ids = ids_por_nombre(nombre)
    if not ids:
        raise SystemExit(f"No hay tramos de SWORD con '{nombre}' en el nombre")
    por_continente = {}
    for id_tramo in ids:
        por_continente.setdefault(continente_de(id_tramo), []).append(id_tramo)
    continente = max(por_continente, key=lambda c: len(por_continente[c]))
    tramos = tramos_sword(continente)
    con_nombre = [i for i in por_continente[continente] if i in tramos]
    inicio = min(con_nombre, key=lambda i: tramos[i]["dist_km"])
    return _seguir(tramos, inicio, "abajo")[-1], inicio


def candidatos_cerca(extremos_por_hueco, excluir, margen_grados=0.15, maximo=150):
    """Tramos de SWORD con centro dentro de la caja de cada hueco (más un margen), para el respaldo con Dijkstra."""
    candidatos = []
    for (lon_a, lat_a), (lon_b, lat_b), continente in extremos_por_hueco:
        tramos = tramos_sword(continente)
        oeste, este = min(lon_a, lon_b) - margen_grados, max(lon_a, lon_b) + margen_grados
        sur, norte = min(lat_a, lat_b) - margen_grados, max(lat_a, lat_b) + margen_grados
        cerca = [i for i, t in tramos.items()
                 if i not in excluir and oeste <= t["lon"] <= este and sur <= t["lat"] <= norte]
        candidatos += sorted(cerca)[:maximo]
    return sorted(set(candidatos))
