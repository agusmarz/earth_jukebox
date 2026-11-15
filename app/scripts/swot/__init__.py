"""Procesamiento de ríos de SWORD con datos SWOT de Hydrocron.

Módulos
    hydrocron   consultas a la API con caché en datos/<id>/crudo/<reach_id>.json
    sword       índice de SWORD Explorer, tramos de SWORD v17b y selección del cauce
    metricas    limpieza de las respuestas y métricas por tramo
    mapas       mapas interactivos (folium) y estáticos (matplotlib)
    demo        cierre de huecos, corrección, interpolación y normalización para la demo

Este archivo sabe dónde está cada cosa y cómo se lee la configuración de un río (rios/<id>.json).
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
CARPETA_RIOS = RAIZ / "rios"
CARPETA_DATOS = RAIZ / "datos"
CARPETA_MAPAS = RAIZ / "mapas"
CARPETA_DEMO_DATOS = RAIZ / "demo" / "datos"
ARCHIVO_ESCALAS_GLOBALES = CARPETA_RIOS / "escalas_globales.json"


def carpeta_datos(id_rio):
    return CARPETA_DATOS / id_rio


def carpeta_crudo(id_rio):
    return carpeta_datos(id_rio) / "crudo"


def carpeta_mapas(id_rio):
    return CARPETA_MAPAS / id_rio


def cargar_rio(id_rio):
    """Lee rios/<id>.json y completa los valores por defecto."""
    archivo = CARPETA_RIOS / f"{id_rio}.json"
    if not archivo.exists():
        disponibles = sorted(a.stem for a in CARPETA_RIOS.glob("*.json") if a.stem != "escalas_globales")
        raise SystemExit(f"No existe {archivo}. Ríos configurados: {', '.join(disponibles) or 'ninguno'}")
    rio = json.loads(archivo.read_text(encoding="utf-8"))
    if rio.get("id") != id_rio:
        raise SystemExit(f"{archivo.name} tiene id {rio.get('id')!r}, se esperaba {id_rio!r}")
    rio.setdefault("nombre", id_rio)
    rio.setdefault("ciudades", [])
    rio.setdefault("ciudades_solo_mapas", [])
    rio.setdefault("etiquetas_a_la_izquierda", [])
    rio.setdefault("criterios", {"modo": "relativos"})
    if isinstance(rio["criterios"], str):
        rio["criterios"] = {"modo": rio["criterios"]}
    modo_seleccion = rio.get("seleccion", {}).get("modo")
    if modo_seleccion not in ("ids", "topologia"):
        raise SystemExit(f"{archivo.name}: seleccion.modo tiene que ser 'ids' o 'topologia'")
    if rio["criterios"].get("modo") not in ("absolutos", "relativos"):
        raise SystemExit(f"{archivo.name}: criterios.modo tiene que ser 'absolutos' o 'relativos'")
    return rio


def cargar_escalas_globales():
    return json.loads(ARCHIVO_ESCALAS_GLOBALES.read_text(encoding="utf-8"))


def escribir_texto(archivo, texto):
    """Escribe en UTF-8 con fin de línea \\n, igual en Windows que en Linux."""
    archivo = Path(archivo)
    archivo.parent.mkdir(parents=True, exist_ok=True)
    with open(archivo, "w", encoding="utf-8", newline="\n") as salida:
        salida.write(texto)
