// Genera app_video/mapa/tierra.svg. Uso: npm i topojson-client d3-geo world-atlas && node generar_mapa.mjs
import fs from 'fs';
import { feature } from 'topojson-client';
import { geoMercator, geoPath } from 'd3-geo';
const topo = JSON.parse(fs.readFileSync(new URL('./node_modules/world-atlas/land-110m.json', import.meta.url)));
const tierra = feature(topo, topo.objects.land);
// mismos parámetros que app_video/src/mapa/proyeccion.js
const ANCHO = 1000, LAT_MAX = 78, LAT_MIN = -58;
const yMerc = lat => Math.log(Math.tan(Math.PI/4 + (lat*Math.PI/180)/2));
const escala = ANCHO / (2*Math.PI);
const yArriba = yMerc(LAT_MAX);
const ALTO = Math.round((yArriba - yMerc(LAT_MIN)) * escala);
const proyeccion = geoMercator().scale(escala).translate([ANCHO/2, yArriba*escala]).clipExtent([[0,0],[ANCHO,ALTO]]);
const d = geoPath(proyeccion).digits(1)(tierra);
fs.writeFileSync(new URL('../app_video/mapa/tierra.svg', import.meta.url),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}"><path class="tierra" d="${d}"/></svg>\n`);
// verificación cruzada con la proyección propia
const [x,y] = proyeccion([-60,-3.3]);
console.log(ANCHO, ALTO, d.length, x.toFixed(1), y.toFixed(1), ((-60+180)/360*ANCHO).toFixed(1), ((yArriba-yMerc(-3.3))*escala).toFixed(1));
