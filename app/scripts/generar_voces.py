"""Genera las locuciones de presentación de los diez ríos de la demo con voces neuronales de edge-tts.

Escribe demo/audios/es/<id>.mp3 y demo/audios/en/<id>.mp3, uno por río de demo/datos/indice.json,
y demo/audios/textos.js con los mismos textos, que la demo usa si un mp3 no carga (los dice con la
síntesis de voz del navegador). Los textos están en TEXTOS. Necesita internet (edge-tts usa el servicio de voz de Microsoft Edge).

    pip install edge-tts
    python generar_voces.py            # genera solo los que faltan
    python generar_voces.py --todos    # regenera los veinte
"""

import asyncio
import json
import sys
from pathlib import Path

import edge_tts

CARPETA_DEMO = Path(__file__).resolve().parent.parent / "demo"
CARPETA_SALIDA = CARPETA_DEMO / "audios"

VOCES = {
    "es": "es-AR-ElenaNeural",
    "en": "en-US-AvaNeural",
}

TEXTOS = {
    "es": {
        "parana": "¡Estamos en el río Paraná! Se encuentra en América del Sur, recorriendo Brasil, Paraguay y Argentina, y tiene una longitud aproximada de 4.880 kilómetros.",
        "mississippi": "¡Estamos en el río Mississippi! Está ubicado en América del Norte, atravesando el centro de Estados Unidos, y cuenta con una longitud aproximada de 3.766 kilómetros.",
        "amazonas": "¡Estamos en el río Amazonas! Se sitúa en América del Sur, cruzando principalmente Perú, Colombia y Brasil, y posee una longitud aproximada de 7.062 kilómetros.",
        "congo": "¡Estamos en el río Congo! Está en África Central, atravesando la República Democrática del Congo, la República del Congo y Angola, y alcanza una longitud aproximada de 4.700 kilómetros.",
        "ganges": "¡Estamos en el sistema fluvial Ganges-Brahmaputra-Meghna! Se localiza en Asia del Sur, recorriendo India, China (Tíbet) y Bangladés, y su curso principal alcanza cerca de 2.900 kilómetros de longitud.",
        "orinoco": "¡Estamos en el río Orinoco! Se encuentra en el norte de América del Sur, fluyendo entre Venezuela y Colombia, y tiene una longitud aproximada de 2.140 kilómetros.",
        "yangtse": "¡Estamos en el río Yangtsé! Está ubicado en Asia Oriental, atravesando China de oeste a este, y cuenta con una longitud aproximada de 6.300 kilómetros.",
        "yenisei": "¡Estamos en el río Yeniséi! Se sitúa en Asia del Norte, recorriendo Mongolia y Siberia en Rusia hasta el océano Ártico, y tiene una longitud aproximada de 5.539 kilómetros.",
        "lena": "¡Estamos en el río Lena! Está en Asia del Norte, fluyendo íntegramente por Siberia oriental en Rusia, y alcanza una longitud aproximada de 4.400 kilómetros.",
        "mekong": "¡Estamos en el río Mekong! Se encuentra en el Sudeste Asiático, atravesando China, Myanmar, Laos, Tailandia, Camboya y Vietnam, y posee una longitud aproximada de 4.350 kilómetros.",
    },
    "en": {
        "parana": "We are at the Paraná River! It is located in South America, flowing through Brazil, Paraguay, and Argentina, and has an approximate length of 4,880 kilometers.",
        "mississippi": "We are at the Mississippi River! It is located in North America, running through the central United States, and has an approximate length of 3,766 kilometers.",
        "amazonas": "We are at the Amazon River! It is located in South America, crossing mainly Peru, Colombia, and Brazil, and has an approximate length of 7,062 kilometers.",
        "congo": "We are at the Congo River! It is in Central Africa, flowing through the Democratic Republic of the Congo, the Republic of the Congo, and Angola, and reaches an approximate length of 4,700 kilometers.",
        "ganges": "We are at the Ganges-Brahmaputra-Meghna river system! It is located in South Asia, flowing through India, China (Tibet), and Bangladesh, and its main course reaches nearly 2,900 kilometers in length.",
        "orinoco": "We are at the Orinoco River! It is located in northern South America, flowing between Venezuela and Colombia, and has an approximate length of 2,140 kilometers.",
        "yangtse": "We are at the Yangtze River! It is located in East Asia, crossing China from west to east, and has an approximate length of 6,300 kilometers.",
        "yenisei": "We are at the Yenisei River! It is located in North Asia, flowing through Mongolia and Siberia in Russia to the Arctic Ocean, and has an approximate length of 5,539 kilometers.",
        "lena": "We are at the Lena River! It is in North Asia, flowing entirely through eastern Siberia in Russia, and reaches an approximate length of 4,400 kilometers.",
        "mekong": "We are at the Mekong River! It is located in Southeast Asia, flowing through China, Myanmar, Laos, Thailand, Cambodia, and Vietnam, and has an approximate length of 4,350 kilometers.",
    },
}

# Un mp3 más chico que esto es casi seguro una respuesta vacía o cortada del servicio
TAMANO_MINIMO = 10_000
REINTENTOS = 3


def ids_de_la_demo():
    indice = json.loads((CARPETA_DEMO / "datos" / "indice.json").read_text(encoding="utf-8"))
    return [rio["id"] for rio in indice["rios"]]


async def generar(texto, voz, destino):
    temporal = destino.with_suffix(".tmp")
    for intento in range(1, REINTENTOS + 1):
        try:
            await edge_tts.Communicate(texto, voz).save(str(temporal))
            if temporal.stat().st_size < TAMANO_MINIMO:
                raise RuntimeError(f"salió muy chico ({temporal.stat().st_size} bytes)")
            temporal.replace(destino)
            return
        except Exception as error:  # noqa: BLE001, el servicio falla de muchas formas distintas
            if intento == REINTENTOS:
                temporal.unlink(missing_ok=True)
                raise RuntimeError(f"{destino.name}: {error}") from error
            await asyncio.sleep(2 * intento)


def escribir_textos_js():
    """Los textos como script y no como JSON, así la demo los lee también desde file://"""
    contenido = json.dumps({"voces": VOCES, "textos": TEXTOS}, ensure_ascii=False, indent=2)
    destino = CARPETA_SALIDA / "textos.js"
    destino.write_text(
        "// Lo genera scripts/generar_voces.py, no editar a mano.\n"
        f"window.TEXTOS_LOCUCION = {contenido};\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"  {destino.relative_to(CARPETA_DEMO)}")


async def main():
    todos = "--todos" in sys.argv
    ids = ids_de_la_demo()
    errores = []
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    escribir_textos_js()
    for idioma, voz in VOCES.items():
        faltan = [i for i in ids if i not in TEXTOS[idioma]]
        if faltan:
            errores.append(f"no hay texto en {idioma} para {', '.join(faltan)}")
            continue
        carpeta = CARPETA_SALIDA / idioma
        carpeta.mkdir(parents=True, exist_ok=True)
        for rio in ids:
            destino = carpeta / f"{rio}.mp3"
            if destino.exists() and not todos:
                print(f"  ya está {idioma}/{rio}.mp3")
                continue
            try:
                await generar(TEXTOS[idioma][rio], voz, destino)
                print(f"  {idioma}/{rio}.mp3  {destino.stat().st_size // 1024} KB")
            except RuntimeError as error:
                errores.append(str(error))
    for error in errores:
        print(f"ERROR {error}", file=sys.stderr)
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    asyncio.run(main())
