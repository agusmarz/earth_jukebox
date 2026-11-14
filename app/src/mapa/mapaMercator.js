import { ANCHO, ALTO, proyectar } from './proyeccion.js';

const NS = 'http://www.w3.org/2000/svg';

// Dibuja el mapa y un pin por río. Cada pin es un botón enfocable.
export async function crearMapa(contenedor, rios, { alElegir, alEnfocar, alPasar }) {
  const texto = await (await fetch('mapa/tierra.svg')).text();
  contenedor.innerHTML = texto;
  const svg = contenedor.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${ANCHO} ${ALTO}`);
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Mapa del mundo con los cinco ríos disponibles');
  svg.querySelector('.tierra').setAttribute('aria-hidden', 'true');

  // La tierra se dibuja como una trama de puntos negros
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML =
    '<pattern id="trama-puntos" width="5" height="5" patternUnits="userSpaceOnUse">' +
    '<circle cx="2.5" cy="2.5" r="1.15" fill="#000"/></pattern>';
  svg.prepend(defs);

  const pines = rios.map((rio, indice) => {
    const { x, y } = proyectar(rio.coordenadas);
    const grupo = document.createElementNS(NS, 'g');
    grupo.classList.add('pin');
    grupo.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    grupo.setAttribute('tabindex', '0');
    grupo.setAttribute('role', 'button');
    grupo.setAttribute('aria-label', `${indice + 1}, ${rio.nombre}, ${rio.region}`);
    grupo.dataset.id = rio.id;

    const anillo = document.createElementNS(NS, 'circle');
    anillo.setAttribute('r', '16');
    anillo.classList.add('pin-anillo');

    const punto = document.createElementNS(NS, 'circle');
    punto.setAttribute('r', '7');
    punto.classList.add('pin-punto');

    const etiqueta = document.createElementNS(NS, 'text');
    etiqueta.textContent = rio.nombre;
    etiqueta.setAttribute('y', '-20');
    etiqueta.setAttribute('text-anchor', 'middle');
    etiqueta.classList.add('pin-etiqueta');

    grupo.append(anillo, punto, etiqueta);
    grupo.addEventListener('click', () => alElegir(rio));
    grupo.addEventListener('focus', () => alEnfocar(rio));
    grupo.addEventListener('mouseenter', () => alPasar?.(rio));
    svg.append(grupo);
    return grupo;
  });

  return {
    resaltar(id) {
      pines.forEach((p) => p.classList.toggle('activo', p.dataset.id === id));
    },
    enfocar(id) {
      pines.find((p) => p.dataset.id === id)?.focus();
    },
  };
}
