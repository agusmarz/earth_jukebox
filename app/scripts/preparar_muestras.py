"""Prepara las muestras orquestales de la demo a partir de VSCO 2 Community Edition (CC0).

Baja del repo de VSCO 2 CE solo los archivos que usa la demo, lee el mapeo de cada
instrumento de sus archivos SFZ (nota de cada grabación, capa de dinámica y volumen),
recorta silencios, limita la duración y convierte a mp3. Escribe las muestras en
demo/muestras/ y el índice en demo/muestras/indice.js.

Necesita git y ffmpeg en el PATH.

    python preparar_muestras.py
"""

import json
import re
import subprocess
import sys
from pathlib import Path

REPO_VSCO = "https://github.com/sgossner/VSCO-2-CE"
CARPETA_DEMO = Path(__file__).resolve().parent.parent / "demo"
CARPETA_SALIDA = CARPETA_DEMO / "muestras"
CARPETA_CACHE = Path(__file__).resolve().parent / ".cache_vsco"

# Dinámica con la que se elige la capa de cada instrumento (0 a 127). Las capas suaves
# suenan más al colchón que buscamos.
DINAMICA = 55

# Duración máxima de cada muestra en segundos, con un fundido final
DURACION_MAXIMA = 9.0
FUNDIDO_FINAL = 1.5

# instrumento: archivo SFZ, rango de notas MIDI que usa la demo
INSTRUMENTOS = {
    "violines": ("ViolinEnsSusVib.sfz", 55, 80),
    "violas": ("ViolaEnsSusVib.sfz", 48, 66),
    "chelos": ("CelloEnsSusVib.sfz", 36, 60),
    "contrabajo": ("ContrabassSusVB.sfz", 28, 56),
    "arpa": ("Harp.sfz", 46, 90),
    "fagot": ("BassoonSus.sfz", 46, 72),
    "clarinete": ("ClarinetSus.sfz", 50, 80),
    "oboe": ("OboeSusVib.sfz", 58, 88),
    "flauta": ("FluteSusVib.sfz", 60, 90),
    "corno": ("FHornSus.sfz", 50, 72),
    "timbal": ("Timpani.sfz", 36, 60),
}


def correr(comando, **opciones):
    return subprocess.run(comando, check=True, capture_output=True, text=True, **opciones)


# 1. Clon parcial de VSCO 2 CE, sin bajar todavía ningún audio
def preparar_repo():
    repo = CARPETA_CACHE / "repo"
    if not repo.exists():
        CARPETA_CACHE.mkdir(parents=True, exist_ok=True)
        correr(["git", "clone", "--filter=blob:none", "--no-checkout", "--depth", "1", REPO_VSCO, str(repo)])
        correr(["git", "fetch", "--depth", "1", "--filter=blob:none", "origin", "SFZ:sfz"], cwd=repo)
    return repo


# 2. Lectura de las regiones de un SFZ, con lo heredado de <global> y <group>
def leer_sfz(repo, nombre):
    texto = correr(["git", "show", f"sfz:{nombre}"], cwd=repo).stdout
    ruta_base = ""
    globales, grupo, region = {}, {}, None
    regiones = []
    nivel = None
    for linea in texto.splitlines():
        linea = linea.split("//")[0].strip()
        if not linea:
            continue
        encabezado = re.match(r"<(\w+)>", linea)
        if encabezado:
            if region is not None:
                regiones.append({**globales, **grupo, **region})
                region = None
            nivel = encabezado.group(1)
            if nivel == "group":
                grupo = {}
            elif nivel == "region":
                region = {}
            linea = linea[encabezado.end():].strip()
            if not linea:
                continue
        for clave, valor in re.findall(r"(\w+)=(.+?)(?=\s+\w+=|$)", linea):
            if clave == "default_path":
                ruta_base = valor.replace("\\", "/")
            elif nivel == "region":
                region[clave] = valor
            elif nivel == "group":
                grupo[clave] = valor
            elif nivel == "global":
                globales[clave] = valor
    if region is not None:
        regiones.append({**globales, **grupo, **region})
    for r in regiones:
        r["ruta"] = ruta_base + r["sample"].replace("\\", "/")
    return regiones


# 3. Una grabación por nota, de la capa de dinámica elegida y la primera alternancia
def elegir_regiones(regiones, nota_minima, nota_maxima):
    elegidas = {}
    for r in regiones:
        if int(r.get("seq_position", 1)) != 1:
            continue
        if not int(r.get("lovel", 0)) <= DINAMICA <= int(r.get("hivel", 127)):
            continue
        centro = int(r.get("pitch_keycenter", r.get("key", 60)))
        abajo, arriba = int(r.get("lokey", centro)), int(r.get("hikey", centro))
        if arriba < nota_minima or abajo > nota_maxima:
            continue
        elegidas[centro] = {"midi": centro, "ruta": r["ruta"], "volumen": float(r.get("volume", 0))}
    return [elegidas[k] for k in sorted(elegidas)]


# 4. Medición de pico y sonoridad de una grabación, en dB
def medir(origen, ganancia_db=0.0):
    salida = subprocess.run(["ffmpeg", "-v", "info", "-i", str(origen), "-af", f"volume={ganancia_db}dB,volumedetect,ebur128",
                             "-f", "null", "-"], capture_output=True, text=True).stderr
    pico = float(re.search(r"max_volume: (-?[\d.]+) dB", salida).group(1))
    sonoridad = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", salida)[-1])
    return pico, sonoridad


# 5. Conversión a mp3, sin silencio inicial, con duración máxima, fundido y ganancia
def convertir(origen, destino, ganancia_db):
    duracion = float(correr(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(origen)]).stdout)
    filtros = [f"volume={ganancia_db:.2f}dB", "silenceremove=start_periods=1:start_threshold=-60dB"]
    if duracion > DURACION_MAXIMA:
        filtros += [f"atrim=0:{DURACION_MAXIMA}", f"afade=t=out:st={DURACION_MAXIMA - FUNDIDO_FINAL}:d={FUNDIDO_FINAL}"]
    correr(["ffmpeg", "-y", "-v", "error", "-i", str(origen), "-af", ",".join(filtros), "-ar", "44100", "-ac", "2",
            "-codec:a", "libmp3lame", "-b:a", "128k", str(destino)])
    return min(duracion, DURACION_MAXIMA)


def main():
    repo = preparar_repo()
    CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    indice = {"fuente": "VSCO 2 Community Edition, Versilian Studios, licencia CC0", "dinamica": DINAMICA, "instrumentos": {}}
    for instrumento, (sfz, minima, maxima) in INSTRUMENTOS.items():
        regiones = elegir_regiones(leer_sfz(repo, sfz), minima, maxima)
        rutas = [r["ruta"] for r in regiones]
        correr(["git", "checkout", "HEAD", "--", *rutas], cwd=repo)
        (CARPETA_SALIDA / instrumento).mkdir(exist_ok=True)
        # Se respeta el volumen relativo entre notas que fija el SFZ y se lleva el pico más
        # alto del instrumento a -3 dB, así los mp3 no pierden resolución
        medidas = [medir(repo / r["ruta"], r["volumen"]) for r in regiones]
        ajuste = -3.0 - max(pico for pico, _ in medidas)
        sonoridad = sum(s for _, s in medidas) / len(medidas) + ajuste
        notas = []
        for r in regiones:
            archivo = f"{instrumento}/{r['midi']}.mp3"
            segundos = convertir(repo / r["ruta"], CARPETA_SALIDA / archivo, r["volumen"] + ajuste)
            notas.append({"midi": r["midi"], "archivo": archivo, "segundos": round(segundos, 2)})
        # Ganancia que lleva al instrumento a -23 LUFS, para que todos arranquen parejos en la mezcla
        indice["instrumentos"][instrumento] = {"ganancia": round(10 ** ((-23.0 - sonoridad) / 20), 3), "notas": notas}
        print(f"{instrumento}: {len(notas)} notas, {sonoridad:.1f} LUFS, {', '.join(str(n['midi']) for n in notas)}")
    contenido = "// Lo genera scripts/preparar_muestras.py\nwindow.MUESTRAS = " + json.dumps(indice, ensure_ascii=False, indent=1) + ";\n"
    (CARPETA_SALIDA / "indice.js").write_text(contenido, encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
