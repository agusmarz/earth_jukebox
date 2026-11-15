// Misma proyección Mercator que se usó para generar mapa/tierra.svg
export const ANCHO = 1000;
export const LAT_MAX = 78;
export const LAT_MIN = -58;

const yMercator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
const escala = ANCHO / (2 * Math.PI);
const yArriba = yMercator(LAT_MAX);
export const ALTO = Math.round((yArriba - yMercator(LAT_MIN)) * escala);

export function proyectar({ lat, lon }) {
  return {
    x: ((lon + 180) / 360) * ANCHO,
    y: (yArriba - yMercator(lat)) * escala,
  };
}
