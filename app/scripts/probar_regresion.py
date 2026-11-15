"""Prueba de regresión: un río configurado con criterios absolutos tiene que dar lo mismo que antes del paquete swot.

Corre los pasos exportar y demo (sin red, desde la caché de datos/<id>/crudo) y compara
    datos/<id>/metricas.csv          byte a byte con el metricas.csv de referencia
    demo/datos/<id>.json             fuente, unidades, ciudades y tramos contra el tramos.js de referencia,
                                     tomando normas.propia como el norma de antes
Las referencias salen del commit anterior a la reorganización (se leen con git show), así la prueba no
depende de archivos que el propio proceso reescribe.

Qué comparar se configura en el bloque "regresion" de rios/<id>.json (commit y rutas de referencia en git).

Uso, desde esta carpeta
    python probar_regresion.py           todos los ríos con bloque "regresion"
    python probar_regresion.py <id>      uno solo
"""
import argparse
import json
import subprocess
import sys

from swot import CARPETA_RIOS, RAIZ, cargar_rio, carpeta_datos
from swot.pasos import exportar_datos, preparar_demo

def de_git(commit, ruta):
    return subprocess.run(["git", "show", f"{commit}:{ruta}"], cwd=RAIZ, capture_output=True, check=True).stdout


def comparar_tramos(nuevos, viejos):
    errores = []
    if len(nuevos) != len(viejos):
        errores.append(f"cantidad de tramos {len(nuevos)} contra {len(viejos)}")
    for nuevo, viejo in zip(nuevos, viejos):
        nuevo = dict(nuevo)
        normas = nuevo.pop("normas")
        nuevo["norma"] = normas["propia"]
        if set(normas["global"]) != set(normas["propia"]):
            errores.append(f"{nuevo['id']}: normas.global no tiene las mismas claves que normas.propia")
        if not all(0 <= v <= 1 for v in list(normas["propia"].values()) + list(normas["global"].values())):
            errores.append(f"{nuevo['id']}: hay normas fuera de 0 a 1")
        if nuevo != viejo:
            campos = sorted(k for k in set(nuevo) | set(viejo) if nuevo.get(k) != viejo.get(k))
            errores.append(f"{nuevo['id']}: difiere en {', '.join(campos)}")
    return errores


def probar(rio):
    referencia = rio["regresion"]
    exportar_datos(rio)
    datos, _ = preparar_demo(rio)

    errores = []
    metricas_nuevas = (carpeta_datos(rio["id"]) / "metricas.csv").read_bytes()
    if metricas_nuevas != de_git(referencia["commit"], referencia["metricas"]):
        errores.append("metricas.csv no es igual al de referencia")

    texto_js = de_git(referencia["commit"], referencia["tramos_js"]).decode("utf-8")
    viejo = json.loads(texto_js[texto_js.index("=") + 1:].strip().rstrip(";"))
    for campo in ("fuente", "unidades", "ciudades"):
        if datos[campo] != viejo[campo]:
            errores.append(f"el campo {campo} difiere")
    errores += comparar_tramos(datos["tramos"], viejo["tramos"])

    escrito = json.loads((RAIZ / "demo" / "datos" / f"{rio['id']}.json").read_text(encoding="utf-8"))
    if escrito != json.loads(json.dumps(datos)):
        errores.append(f"demo/datos/{rio['id']}.json no coincide con lo calculado")

    if errores:
        print(f"{rio['id']}: FALLA, {len(errores)} diferencias")
        for error in errores[:30]:
            print("  " + error)
        return False
    print(f"{rio['id']}: OK, metricas.csv igual y {len(datos['tramos'])} tramos iguales a la referencia "
          f"{referencia['commit']}")
    return True


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Compara la salida actual con la de referencia")
    parser.add_argument("id", nargs="?", help="río a probar (por defecto todos los que tienen bloque regresion)")
    argumentos = parser.parse_args()

    if argumentos.id:
        rios = [cargar_rio(argumentos.id)]
    else:
        rios = [cargar_rio(a.stem) for a in sorted(CARPETA_RIOS.glob("*.json")) if a.stem != "escalas_globales"]
    rios = [r for r in rios if "regresion" in r]
    if not rios:
        raise SystemExit("Ningún río tiene bloque regresion")
    resultados = [probar(rio) for rio in rios]
    sys.exit(0 if all(resultados) else 1)


if __name__ == "__main__":
    main()
