// Navegación entre las tres vistas, con el hash de la dirección:
//   (sin hash)   bienvenida
//   #rios        menú de ríos sobre el planisferio
//   #rio/<id>    tablero del río (demo.js)
// La dirección vieja ?rio=<id> abre directo el tablero de ese río.
// Todo se maneja con mouse y teclado. Los botones de micrófono, voz, manos y tutorial están
// dibujados como en el diseño pero todavía no hacen nada.

(function () {
  const SVG = 'http://www.w3.org/2000/svg';
  const vistas = {
    bienvenida: document.getElementById('vista-bienvenida'),
    rios: document.getElementById('vista-rios'),
    rio: document.getElementById('vista-rio'),
  };
  const planisferio = document.getElementById('planisferio');
  const contenedorEtiquetas = document.getElementById('etiquetas-rios');
  const anuncios = document.getElementById('anuncios');
  const mundo = window.MUNDO;

  let vistaActual = null;
  let rios = [];
  let etiquetas = [];

  // 1. Planisferios. El de la bienvenida va de fondo, oscuro y difuso, y el del menú en blanco.
  function dibujarMundo(svg) {
    if (!mundo) return;
    svg.setAttribute('viewBox', `0 0 ${mundo.ancho} ${mundo.alto}`);
    const camino = document.createElementNS(SVG, 'path');
    camino.setAttribute('d', mundo.tierra);
    svg.appendChild(camino);
  }
  dibujarMundo(document.getElementById('bienvenida-mundo'));
  dibujarMundo(document.getElementById('rios-mundo'));
  if (mundo) planisferio.style.aspectRatio = `${mundo.ancho} / ${mundo.alto}`;

  // 2. Etiquetas de los ríos. Cada una va sobre el punto medio del cauce. Si dos se pisan (pasa en
  // Asia y en Siberia) se separan en vertical y una línea fina las une con su río.
  const guias = document.createElementNS(SVG, 'svg');
  guias.classList.add('guias');
  guias.setAttribute('aria-hidden', 'true');
  planisferio.appendChild(guias);

  function crearEtiquetas() {
    contenedorEtiquetas.innerHTML = '';
    etiquetas = rios.map((rio, k) => {
      const enlace = document.createElement('a');
      enlace.className = 'etiqueta-rio';
      enlace.href = `#rio/${rio.id}`;
      enlace.textContent = `${k + 1}. ${rio.nombre}`;
      enlace.setAttribute('aria-label', `${k + 1}, ${rio.nombre}. Key ${(k + 1) % 10}`);
      const punto = document.createElement('span');
      punto.className = 'punto-rio';
      punto.setAttribute('aria-hidden', 'true');
      contenedorEtiquetas.append(punto, enlace);
      return { rio, enlace, punto, ancla: (mundo && mundo.rios[rio.id]) || null };
    });
    ubicarEtiquetas();
  }

  function ubicarEtiquetas() {
    if (!mundo || vistaActual !== 'rios') return;
    const { width, height } = planisferio.getBoundingClientRect();
    if (width === 0) return;
    const escala = width / mundo.ancho;
    const cajas = etiquetas.filter((e) => e.ancla).map((e) => {
      const ancho = e.enlace.offsetWidth;
      const alto = e.enlace.offsetHeight;
      const x = e.ancla[0] * escala;
      const y = e.ancla[1] * escala;
      return { e, x, y, ancho, alto, cx: x, cy: y - alto * 0.9 };
    });
    // Relajación simple, empuja en vertical las que se pisan
    const SEPARACION = 6;
    for (let vuelta = 0; vuelta < 80; vuelta++) {
      let movio = false;
      for (let i = 0; i < cajas.length; i++) {
        for (let j = i + 1; j < cajas.length; j++) {
          const a = cajas[i], b = cajas[j];
          const solapeX = (a.ancho + b.ancho) / 2 + SEPARACION - Math.abs(a.cx - b.cx);
          const solapeY = (a.alto + b.alto) / 2 + SEPARACION - Math.abs(a.cy - b.cy);
          if (solapeX > 0 && solapeY > 0) {
            const empuje = solapeY / 2 + 0.5;
            const signo = a.cy <= b.cy ? -1 : 1;
            a.cy += signo * empuje;
            b.cy -= signo * empuje;
            movio = true;
          }
        }
      }
      if (!movio) break;
    }
    guias.setAttribute('viewBox', `0 0 ${width} ${height}`);
    guias.innerHTML = '';
    for (const caja of cajas) {
      caja.cx = Math.max(caja.ancho / 2, Math.min(width - caja.ancho / 2, caja.cx));
      caja.e.enlace.style.left = `${caja.cx}px`;
      caja.e.enlace.style.top = `${caja.cy}px`;
      caja.e.punto.style.left = `${caja.x}px`;
      caja.e.punto.style.top = `${caja.y}px`;
      const linea = document.createElementNS(SVG, 'line');
      linea.setAttribute('x1', caja.x);
      linea.setAttribute('y1', caja.y);
      linea.setAttribute('x2', caja.cx);
      linea.setAttribute('y2', caja.cy + (caja.cy < caja.y ? caja.alto / 2 : -caja.alto / 2));
      guias.appendChild(linea);
    }
  }

  window.addEventListener('resize', ubicarEtiquetas);
  document.fonts.ready.then(ubicarEtiquetas);

  // 3. Vistas
  function ruta() {
    const hash = location.hash.replace(/^#/, '');
    if (hash === 'rios') return { vista: 'rios' };
    const rio = hash.match(/^rio\/([a-z0-9_-]+)$/i);
    if (rio) return { vista: 'rio', id: rio[1] };
    return { vista: 'bienvenida' };
  }

  function mostrar() {
    let { vista, id } = ruta();
    if (vista === 'rio' && rios.length > 0 && !rios.some((rio) => rio.id === id)) {
      ir('rios', true);
      return;
    }
    if (vistaActual === 'rio' && vista !== 'rio') window.Tablero.cerrar();
    for (const [nombre, elemento] of Object.entries(vistas)) elemento.hidden = nombre !== vista;
    const anterior = vistaActual;
    vistaActual = vista;
    if (vista === 'bienvenida') {
      document.title = 'The Melody of Water';
      if (anterior) document.getElementById('boton-continuar').focus({ preventScroll: true });
    } else if (vista === 'rios') {
      document.title = 'Rivers · The Melody of Water';
      ubicarEtiquetas();
      anuncios.textContent = 'Choose a river. Keys 1 to 9 and 0, or Tab and Enter.';
    } else if (vista === 'rio') {
      window.Tablero.abrir(id);
    }
  }

  function ir(destino, reemplazar) {
    const hash = destino === 'bienvenida' ? '' : `#${destino}`;
    const direccion = `${location.pathname}${location.search}${hash}`;
    if (reemplazar) history.replaceState(null, '', direccion);
    else history.pushState(null, '', direccion);
    mostrar();
  }

  window.addEventListener('popstate', mostrar);
  window.addEventListener('hashchange', mostrar);

  // 4. Entrada con mouse y teclado
  document.getElementById('boton-continuar').addEventListener('click', () => ir('rios'));
  contenedorEtiquetas.addEventListener('click', (evento) => {
    const enlace = evento.target.closest('.etiqueta-rio');
    if (!enlace) return;
    evento.preventDefault();
    ir(enlace.getAttribute('href').slice(1));
  });
  window.Tablero.alVolver(() => ir('rios'));
  window.Tablero.alCambiarRio((id) => ir(`rio/${id}`, true));

  window.addEventListener('keydown', (evento) => {
    // demo.js escucha antes; si la tecla ya cambió de vista (Escape en el tablero) no se usa de nuevo
    if (evento.defaultPrevented || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (vistaActual === 'bienvenida') {
      if (['Enter', ' ', 'ArrowRight'].includes(evento.key) || evento.key.toLowerCase() === 'n') {
        evento.preventDefault();
        ir('rios');
      }
    } else if (vistaActual === 'rios') {
      if (evento.key === 'Escape') {
        ir('bienvenida');
        return;
      }
      if (/^[0-9]$/.test(evento.key)) {
        const indice = evento.key === '0' ? 9 : Number(evento.key) - 1;
        if (rios[indice]) ir(`rio/${rios[indice].id}`);
      }
    }
  });

  // 5. Arranque. La orquesta empieza a cargar enseguida, así cuando se elige un río ya está.
  const viejo = new URLSearchParams(location.search).get('rio');
  if (viejo && !location.hash) {
    const parametros = new URLSearchParams(location.search);
    parametros.delete('rio');
    const consulta = parametros.toString();
    history.replaceState(null, '', `${location.pathname}${consulta ? `?${consulta}` : ''}#rio/${viejo}`);
  }

  window.Tablero.cargarOrquesta();
  window.Tablero.leerRios().then((lista) => {
    rios = lista;
    crearEtiquetas();
    mostrar();
  }).catch((error) => {
    rios = [];
    contenedorEtiquetas.innerHTML = '';
    const aviso = document.createElement('p');
    aviso.className = 'aviso-rios';
    aviso.textContent = `${error.titulo || 'Could not read the rivers'}. ${error.message}`;
    contenedorEtiquetas.appendChild(aviso);
    mostrar();
  });
})();
