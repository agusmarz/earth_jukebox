"""Consultas a Hydrocron (PO.DAAC) con caché en datos/<id>/crudo/<reach_id>.json.

La caché guarda la respuesta tal como la devuelve la API y su clave es solo el reach_id, así que una
respuesta ya bajada se reusa aunque cambie la fecha de fin. Con actualizar=True se vuelve a bajar.
"""
import json
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import requests

from . import carpeta_crudo
from .metricas import limpiar

URL_HYDROCRON = "https://soto.podaac.earthdatacloud.nasa.gov/hydrocron/v1/timeseries"
INICIO = "2023-07-15T00:00:00Z"  # después de la fase de calibración de órbita diaria
HILOS = 4
CAMPOS_TRAMO = ["reach_id", "time_str", "wse", "wse_u", "width", "slope", "area_total", "reach_q",
                "dark_frac", "p_dist_out", "p_wse", "p_width", "p_lat", "p_lon", "river_name", "geometry"]

sesion = requests.Session()


def fecha_fin():
    return pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%dT00:00:00Z")


def bajar_tramo(id_rio, id_tramo, actualizar=False, reintentos=3):
    """Devuelve la respuesta de Hydrocron del tramo (de la caché si ya está) o None si no hay datos."""
    archivo = carpeta_crudo(id_rio) / f"{id_tramo}.json"
    if archivo.exists() and not actualizar:
        return json.loads(archivo.read_text(encoding="utf-8"))
    parametros = {"feature": "Reach", "feature_id": str(id_tramo), "start_time": INICIO, "end_time": fecha_fin(),
                  "output": "geojson", "compact": "true", "fields": ",".join(CAMPOS_TRAMO)}
    codigo = None
    for intento in range(reintentos):
        try:
            r = sesion.get(URL_HYDROCRON, params=parametros, timeout=90)
            codigo = r.status_code
        except requests.RequestException as error:
            codigo = type(error).__name__
            time.sleep(2 * (intento + 1))
            continue
        if r.status_code == 200:
            archivo.parent.mkdir(parents=True, exist_ok=True)
            archivo.write_text(json.dumps(r.json()), encoding="utf-8")
            return r.json()
        if r.status_code in (400, 404):  # Hydrocron no tiene ese tramo o no tiene pasadas en el período
            return None
        time.sleep(2 * (intento + 1))
    print(f"  no se pudo bajar {id_tramo} ({codigo})")
    return None


def bajar_tramos(id_rio, ids, actualizar=False):
    """Baja (o lee de la caché) todos los tramos. Devuelve los ids que Hydrocron no tiene."""
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=HILOS) as ejecutor:
        respuestas = list(ejecutor.map(lambda i: bajar_tramo(id_rio, i, actualizar), ids))
    sin_datos = [i for i, r in zip(ids, respuestas) if r is None or not entidades(r)]
    print(f"{len(ids)} tramos en {time.time() - t0:.0f} s, {len(sin_datos)} sin respuesta de Hydrocron")
    return sin_datos


def entidades(respuesta):
    return respuesta["results"]["geojson"]["features"]


def leer_tramo(id_rio, id_tramo):
    """Lee la respuesta guardada. Devuelve (tabla de observaciones, geometría) o (None, None)."""
    archivo = carpeta_crudo(id_rio) / f"{id_tramo}.json"
    if not archivo.exists():
        return None, None
    lista = entidades(json.loads(archivo.read_text(encoding="utf-8")))
    if not lista:
        return None, None
    entidad = lista[0]
    propiedades = {k: (v if isinstance(v, list) else [v]) for k, v in entidad["properties"].items()}
    geometria = (entidad.get("geometry") or {}).get("coordinates")
    return limpiar(pd.DataFrame(propiedades)), geometria


def leer_tramos(id_rio, ids):
    """Lee varios tramos de la caché. Devuelve (observaciones concatenadas, geometrías por id)."""
    tablas, geometrias = [], {}
    for id_tramo in sorted(ids):
        tabla, geometria = leer_tramo(id_rio, id_tramo)
        if tabla is None:
            continue
        tablas.append(tabla)
        if geometria:
            geometrias[id_tramo] = geometria
    observaciones = pd.concat(tablas, ignore_index=True) if tablas else pd.DataFrame()
    return observaciones, geometrias
