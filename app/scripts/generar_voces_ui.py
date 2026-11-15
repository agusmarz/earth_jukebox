"""Genera las locuciones de la interfaz (tutorial y, más adelante, navegación por voz) con edge-tts.

Escribe demo/audios/<idioma>/ui/<id>.mp3 para cada texto de textos_ui.TEXTOS_UI, con las mismas
voces que los ríos, y reescribe demo/audios/textos.js (ríos más interfaz). Los clips tutorial_*
quedan listos para quien implemente el tutorial: ver demo/audios/README.md. Necesita internet.

    pip install edge-tts
    python generar_voces_ui.py            # genera solo los que faltan
    python generar_voces_ui.py --todos    # regenera todos
"""

import asyncio
import sys

from generar_voces import CARPETA_DEMO, CARPETA_SALIDA, VOCES, escribir_textos_js, generar
from textos_ui import TEXTOS_UI


def minimo_para(texto):
    """edge-tts da unos 6 KB por segundo; un clip corto legítimo puede pesar menos que los 10 KB de los ríos"""
    return max(2_500, 100 * len(texto))


async def main():
    todos = "--todos" in sys.argv
    errores = []
    escribir_textos_js()
    ids = set(TEXTOS_UI["en"])
    for idioma in VOCES:
        if set(TEXTOS_UI[idioma]) != ids:
            errores.append(f"los ids de {idioma} no coinciden con los de en")
    for idioma, voz in VOCES.items():
        carpeta = CARPETA_SALIDA / idioma / "ui"
        carpeta.mkdir(parents=True, exist_ok=True)
        for clave, texto in TEXTOS_UI[idioma].items():
            destino = carpeta / f"{clave}.mp3"
            if destino.exists() and not todos:
                print(f"  ya está {idioma}/ui/{clave}.mp3")
                continue
            try:
                await generar(texto, voz, destino, minimo_para(texto))
                print(f"  {destino.relative_to(CARPETA_DEMO)}  {destino.stat().st_size // 1024} KB")
            except RuntimeError as error:
                errores.append(str(error))
    for error in errores:
        print(f"ERROR {error}", file=sys.stderr)
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    asyncio.run(main())
