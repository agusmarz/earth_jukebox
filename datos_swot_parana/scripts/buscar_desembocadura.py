"""Busca en SWORD v17b el tramo de desembocadura de un río, para usarlo en seleccion.desembocadura.

Parte del tramo con ese nombre más cercano a la desembocadura y baja por el vecino de mayor facc
hasta un tramo sin vecino aguas abajo. Conviene revisar el resultado en un mapa antes de usarlo.

Uso, desde esta carpeta
    python buscar_desembocadura.py "Mississippi River"
"""
import argparse
import sys

from swot import sword


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Tramo de desembocadura de un río de SWORD")
    parser.add_argument("nombre", help="nombre del río en SWORD (alcanza con una parte, sin distinguir mayúsculas)")
    nombre = parser.parse_args().nombre
    desembocadura, inicio = sword.buscar_desembocadura(nombre)
    tramo = sword.tramos_sword(sword.continente_de(desembocadura))[desembocadura]
    print(f"Partiendo de {inicio}, la desembocadura es {desembocadura} "
          f"({tramo['nombre']}, a {tramo['dist_km']:.1f} km del mar, lat {tramo['lat']:.3f}, lon {tramo['lon']:.3f})")
    print(f'"seleccion": {{"modo": "topologia", "desembocadura": "{desembocadura}"}}')


if __name__ == "__main__":
    main()
