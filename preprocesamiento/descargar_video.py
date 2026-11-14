"""Descarga el video de la visualización SVS 14990 (unos 160 MB en WEBM 4K)."""

import urllib.request

from comun import CARPETA_FUENTE, VIDEO_FUENTE, cargar_datos


def mostrar_avance(bloques, tamano_bloque, total):
    if total <= 0:
        return
    porcentaje = min(100, bloques * tamano_bloque * 100 / total)
    print(f"\rDescargando {porcentaje:5.1f} %", end="", flush=True)


def main():
    url = cargar_datos()["fuente"]["video"]
    CARPETA_FUENTE.mkdir(exist_ok=True)
    if VIDEO_FUENTE.exists():
        print(f"Ya existe {VIDEO_FUENTE.name}, no hace falta descargarlo de nuevo.")
        return
    temporal = VIDEO_FUENTE.with_suffix(".parcial")
    urllib.request.urlretrieve(url, temporal, mostrar_avance)
    temporal.rename(VIDEO_FUENTE)
    print(f"\nListo, guardado en {VIDEO_FUENTE}")


if __name__ == "__main__":
    main()
