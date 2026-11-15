"""Genera demo/mundo.js, el planisferio de la bienvenida y del menú de ríos.

Lee el TopoJSON de tierras de Natural Earth (dominio público), empaquetado en world-atlas:
https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json

Uso, desde scripts/:
    python generar_mundo.py <ruta a land-50m.json>

Proyecta con Miller, deja afuera la Antártida, simplifica con Douglas-Peucker y escribe el
contorno como un solo path de SVG. También guarda, para cada río de demo/datos/indice.json, el
punto del cauce que está a mitad de camino entre la naciente y la desembocadura, que es donde el
menú pone su etiqueta. Al agregar un río nuevo hay que volver a correrlo.
"""

import json
import math
import sys
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent / 'demo'
ANCHO = 1000  # unidades del viewBox para los 360 grados de longitud
LATITUD_MAXIMA = 83.7
LATITUD_MINIMA = -57.0
AREA_MINIMA = 0.6  # islas más chicas que esto (en unidades del viewBox al cuadrado) no se dibujan
TOLERANCIA = 0.18  # Douglas-Peucker, en unidades del viewBox


def miller_y(latitud):
    fi = math.radians(latitud)
    return 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * fi))


Y_ARRIBA = miller_y(LATITUD_MAXIMA)
Y_ABAJO = miller_y(LATITUD_MINIMA)
ESCALA = ANCHO / (2 * math.pi)
ALTO = (Y_ARRIBA - Y_ABAJO) * ESCALA


def proyectar(longitud, latitud):
    latitud = max(LATITUD_MINIMA, min(LATITUD_MAXIMA, latitud))
    x = (longitud + 180) / 360 * ANCHO
    y = (Y_ARRIBA - miller_y(latitud)) * ESCALA
    return x, y


def decodificar_arcos(topo):
    escala = topo['transform']['scale']
    traslado = topo['transform']['translate']
    arcos = []
    for arco in topo['arcs']:
        x = y = 0
        puntos = []
        for dx, dy in arco:
            x += dx
            y += dy
            puntos.append((x * escala[0] + traslado[0], y * escala[1] + traslado[1]))
        arcos.append(puntos)
    return arcos


def anillo(indices, arcos):
    puntos = []
    for indice in indices:
        arco = arcos[indice] if indice >= 0 else arcos[~indice][::-1]
        puntos.extend(arco if not puntos else arco[1:])
    return puntos


def poligonos(geometria):
    if geometria['type'] == 'GeometryCollection':
        for hija in geometria['geometries']:
            yield from poligonos(hija)
    elif geometria['type'] == 'Polygon':
        yield geometria['arcs']
    elif geometria['type'] == 'MultiPolygon':
        yield from geometria['arcs']


def area(puntos):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(puntos, puntos[1:] + puntos[:1]))) / 2


def simplificar(puntos, tolerancia):
    """Douglas-Peucker, saca los puntos que se apartan menos que la tolerancia de la recta."""
    if len(puntos) < 3:
        return puntos
    (ax, ay), (bx, by) = puntos[0], puntos[-1]
    largo = math.hypot(bx - ax, by - ay)
    mayor, indice = -1.0, 0
    for k in range(1, len(puntos) - 1):
        px, py = puntos[k]
        if largo == 0:
            distancia = math.hypot(px - ax, py - ay)
        else:
            distancia = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / largo
        if distancia > mayor:
            mayor, indice = distancia, k
    if mayor <= tolerancia:
        return [puntos[0], puntos[-1]]
    return simplificar(puntos[:indice + 1], tolerancia)[:-1] + simplificar(puntos[indice:], tolerancia)


def copias_antimeridiano(geograficos):
    """Un anillo que cruza el meridiano 180 haría una raya de lado a lado del mapa. Se lo hace
    continuo (con longitudes de más de 180) y se agrega una copia corrida 360 grados para el otro
    borde. Lo que cae fuera del viewBox no se ve."""
    continuo = [geograficos[0]]
    for lon, lat in geograficos[1:]:
        anterior = continuo[-1][0]
        while lon - anterior > 180:
            lon -= 360
        while lon - anterior < -180:
            lon += 360
        continuo.append((lon, lat))
    copias = [continuo]
    if max(lon for lon, _ in continuo) > 180:
        copias.append([(lon - 360, lat) for lon, lat in continuo])
    if min(lon for lon, _ in continuo) < -180:
        copias.append([(lon + 360, lat) for lon, lat in continuo])
    return copias


def trazo(geograficos):
    """Un anillo como subcamino de SVG, o None si es demasiado chico."""
    puntos = [proyectar(lon, lat) for lon, lat in geograficos]
    if area(puntos) < AREA_MINIMA:
        return None
    # Se parte el anillo en dos para que Douglas-Peucker no lo colapse a una recta
    mitad = len(puntos) // 2
    puntos = simplificar(puntos[:mitad + 1], TOLERANCIA)[:-1] + simplificar(puntos[mitad:], TOLERANCIA)
    redondeados = []
    for x, y in puntos:
        punto = (round(x * 10), round(y * 10))
        if not redondeados or punto != redondeados[-1]:
            redondeados.append(punto)
    if len(redondeados) < 4:
        return None
    # Coordenadas relativas en décimas de unidad, así el archivo pesa menos
    pares = [f'{(x1 - x0) / 10:g} {(y1 - y0) / 10:g}' for (x0, y0), (x1, y1) in zip(redondeados, redondeados[1:])]
    return f'M{redondeados[0][0] / 10:g} {redondeados[0][1] / 10:g}l' + ' '.join(pares) + 'z'


def contorno(topo):
    arcos = decodificar_arcos(topo)
    partes = []
    for poligono in poligonos(next(iter(topo['objects'].values()))):
        for indices in poligono:
            geograficos = anillo(indices, arcos)
            if max(lat for _, lat in geograficos) < LATITUD_MINIMA:
                continue  # Antártida
            for copia in copias_antimeridiano(geograficos):
                parte = trazo(copia)
                if parte:
                    partes.append(parte)
    return ''.join(partes)


def punto_de_rio(id_rio):
    datos = json.loads((DEMO / 'datos' / f'{id_rio}.json').read_text(encoding='utf-8'))
    tramos = sorted(datos['tramos'], key=lambda tramo: tramo['km'])
    medio = tramos[len(tramos) // 2]['linea']
    longitud, latitud = medio[len(medio) // 2]
    x, y = proyectar(longitud, latitud)
    return [round(x, 1), round(y, 1)]


def main():
    sys.setrecursionlimit(20000)
    if len(sys.argv) != 2:
        sys.exit('Uso: python generar_mundo.py <ruta a land-50m.json>')
    topo = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    indice = json.loads((DEMO / 'datos' / 'indice.json').read_text(encoding='utf-8'))
    mundo = {
        'ancho': ANCHO,
        'alto': round(ALTO, 1),
        'rios': {rio['id']: punto_de_rio(rio['id']) for rio in indice['rios']},
        'tierra': contorno(topo),
    }
    salida = DEMO / 'mundo.js'
    salida.write_text(
        '// Lo genera scripts/generar_mundo.py con Natural Earth (dominio público), no editar a mano.\n'
        f'window.MUNDO = {json.dumps(mundo, ensure_ascii=False, separators=(",", ":"))};\n',
        encoding='utf-8',
    )
    print(f'{salida}: {salida.stat().st_size / 1024:.0f} KB, {len(mundo["rios"])} ríos, {ANCHO} x {ALTO:.0f}')


if __name__ == '__main__':
    main()
