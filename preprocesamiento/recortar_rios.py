"""Corta el tramo de cada río, aplica el recorte espacial si está definido
en rios.json y guarda clips livianos en app_video/rios/<id>.webm sin audio.

Cuando existen estos clips la app los usa en lugar de reproducir el video
4K directo desde la NASA, así anda más fluido y sin depender de internet.

Uso
    python recortar_rios.py            corta todos los ríos
    python recortar_rios.py amazonas   corta solo los que nombres
"""

import subprocess
import sys

from comun import CARPETA_CLIPS, VIDEO_FUENTE, cargar_datos, verificar_ffmpeg, verificar_video

ANCHO_SALIDA = 1920
CALIDAD = 34  # crf de VP9, más alto es más liviano


def filtro_de(rio):
    filtros = []
    recorte = rio.get("recorte")
    if recorte:
        filtros.append(f"crop={recorte['ancho']}:{recorte['alto']}:{recorte['x']}:{recorte['y']}")
    filtros.append(f"scale='min({ANCHO_SALIDA},iw)':-2")
    filtros.append("fps=30")
    return ",".join(filtros)


def recortar(rio):
    destino = CARPETA_CLIPS / f"{rio['id']}.webm"
    print(f"Cortando {rio['nombre']} del segundo {rio['inicio']} al {rio['fin']}")
    subprocess.run(
        [
            "ffmpeg", "-loglevel", "error", "-stats", "-y",
            "-ss", str(rio["inicio"]), "-to", str(rio["fin"]),
            "-i", str(VIDEO_FUENTE),
            "-vf", filtro_de(rio),
            "-an",
            "-c:v", "libvpx-vp9", "-crf", str(CALIDAD), "-b:v", "0",
            "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
            str(destino),
        ],
        check=True,
    )
    print(f"Listo {destino}")


def main():
    verificar_ffmpeg()
    verificar_video()
    CARPETA_CLIPS.mkdir(exist_ok=True)
    pedidos = {nombre.lower() for nombre in sys.argv[1:]}
    for rio in cargar_datos()["rios"]:
        if not pedidos or rio["id"] in pedidos:
            recortar(rio)


if __name__ == "__main__":
    main()
