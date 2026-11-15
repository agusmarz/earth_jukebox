"""Rutas y utilidades que comparten los scripts de preprocesamiento."""

import json
import shutil
import sys
from pathlib import Path

CARPETA = Path(__file__).resolve().parent
RAIZ = CARPETA.parent
ARCHIVO_RIOS = RAIZ / "app_video" / "src" / "datos" / "rios.json"
CARPETA_CLIPS = RAIZ / "app_video" / "rios"
CARPETA_FUENTE = CARPETA / "fuente"
NOMBRE_ORIGINAL = "20260305_SVS14990_SWOT_RIVERS_DATA_VIS_3840x2160_60fps_ENGLISH_FINALCUT_GAW.webm"
VIDEO_FUENTE = CARPETA_FUENTE / "svs14990.webm"
# Si el video quedó en Descargas con su nombre original, se usa ese
_EN_DESCARGAS = Path.home() / "Downloads" / NOMBRE_ORIGINAL
if not VIDEO_FUENTE.exists() and _EN_DESCARGAS.exists():
    VIDEO_FUENTE = _EN_DESCARGAS


def cargar_datos():
    with open(ARCHIVO_RIOS, encoding="utf-8") as archivo:
        return json.load(archivo)


def verificar_ffmpeg():
    if shutil.which("ffmpeg") is None:
        sys.exit(
            "No encontré ffmpeg. En Windows podés instalarlo con "
            "'winget install ffmpeg' o 'scoop install ffmpeg'."
        )


def verificar_video():
    if not VIDEO_FUENTE.exists():
        sys.exit("Falta el video fuente. Corré primero 'python descargar_video.py'.")
