"""Arma una imagen por río con un cuadro cada 2 segundos del tramo.

Sirve para revisar a ojo qué partes son visualización de datos SWOT y
cuáles son tomas de terceros (que no se pueden recortar ni remixar), y
para elegir el rectángulo de recorte de cada río.

Leé la grilla de izquierda a derecha y de arriba hacia abajo. El cuadro
número n corresponde al segundo inicio + 2 * n del video original.
"""

import math
import subprocess

from comun import CARPETA, VIDEO_FUENTE, cargar_datos, verificar_ffmpeg, verificar_video

SEGUNDOS_ENTRE_CUADROS = 2
COLUMNAS = 6


def main():
    verificar_ffmpeg()
    verificar_video()
    carpeta_hojas = CARPETA / "hojas"
    carpeta_hojas.mkdir(exist_ok=True)

    for rio in cargar_datos()["rios"]:
        duracion = rio["fin"] - rio["inicio"]
        cantidad = math.ceil(duracion / SEGUNDOS_ENTRE_CUADROS)
        filas = math.ceil(cantidad / COLUMNAS)
        destino = carpeta_hojas / f"{rio['id']}.jpg"
        filtro = (
            f"fps=1/{SEGUNDOS_ENTRE_CUADROS},scale=480:-2,"
            f"tile={COLUMNAS}x{filas}:padding=6:margin=6:color=white"
        )
        subprocess.run(
            [
                "ffmpeg", "-loglevel", "error", "-y",
                "-ss", str(rio["inicio"]), "-to", str(rio["fin"]),
                "-i", str(VIDEO_FUENTE),
                "-vf", filtro, "-frames:v", "1", "-q:v", "3",
                str(destino),
            ],
            check=True,
        )
        print(f"{rio['nombre']} con {cantidad} cuadros en {destino}")


if __name__ == "__main__":
    main()
