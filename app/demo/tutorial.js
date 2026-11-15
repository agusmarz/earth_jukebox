// Tutorial. Va entre la bienvenida y el menú de ríos (#tutorial) y también se abre con el botón
// Tutorial del menú o diciendo "tutorial". Sigue Tutorial.pdf: una pantalla por gesto, con una nota
// de voz que suena al entrar (audios/<idioma>/ui/tutorial_*.mp3, por Locucion.decir), una barra de
// abajo con el texto, el botón de repetir y el NEXT, y el río Paraná de ejemplo entre Rosario y
// Santa Fe. Antes de las siete pantallas del PDF hay una presentación de la app con el Paraná
// (tutorial_0_parana) y al final un cierre (tutorial_8_fin) que lleva al menú de ríos.
//
// Cada pantalla escucha a la cámara (Manos.estado de manos.js) y responde al gesto que enseña: las
// manos se ponen negras cuando se ven y la flecha gira con el puño, con un timbre corto cuando el
// gesto se reconoce. En la primera pantalla no se avanza hasta que se ven las dos manos (si la cámara
// está prendida). Desde el paso del espacio la persona genera la música: el cuadrado sigue a su mano
// derecha sobre los tramos reales del Paraná y la orquesta (música Relieve) suena solo cuando lo
// acerca al río, con los datos de cada tramo; en los pasos de dedos, cada dedo prende su capa.
//
// Se maneja con voz (voz.js: next, back, repeat, skip), con el teclado (Enter o flecha derecha
// avanza, flecha izquierda vuelve, R repite, Escape saltea el tutorial) y con el mouse.
// El Espacio queda para hablar: el tutorial nunca lo usa.

(function () {
  const IDIOMA = 'en';
  const SVG = 'http://www.w3.org/2000/svg';
  const ESTABLE_MS = 600; // las dos manos tienen que verse este tiempo para dar por cumplido el paso 1

  const vista = document.getElementById('vista-tutorial');
  if (!vista) return;
  const escena = vista.querySelector('.tutorial-escena');
  const progreso = vista.querySelector('.tutorial-progreso-relleno');
  const textoBarra = vista.querySelector('.tutorial-texto');
  const botonRepetir = vista.querySelector('.tutorial-repetir');
  const botonSiguiente = vista.querySelector('.tutorial-siguiente');
  const pastillaCamara = vista.querySelector('[data-estado="camara"]');
  const pastillaMicro = vista.querySelector('[data-estado="micro"]');
  const lienzoCamara = vista.querySelector('.tutorial-camara-lienzo');
  const avisoCamara = vista.querySelector('.tutorial-camara-aviso');
  const anuncios = document.getElementById('anuncios');
  const TEXTOS = (window.TEXTOS_LOCUCION && window.TEXTOS_LOCUCION.ui && window.TEXTOS_LOCUCION.ui[IDIOMA]) || {};

  // 1. Las pantallas. "barra" es el texto corto de la barra de abajo, como en el PDF; la nota de voz
  // dice el texto entero (TEXTOS_LOCUCION.ui), que también queda en el title de la barra.
  const PASOS = [
    {
      clip: 'tutorial_0_parana', mapa: true, tipo: 'intro',
      titulo: 'Paraná River', subtitulo: 'South America · our example',
      barra: 'We will learn with the Paraná. Each measurement of the river is played by instruments.',
    },
    {
      clip: 'tutorial_1_manos', tipo: 'manos',
      barra: 'Place your hands in front of the camera. Both must turn black to continue.',
    },
    {
      clip: 'tutorial_2_estaciones', mapa: true, tipo: 'estaciones',
      titulo: 'Seasons', subtitulo: 'Left hand',
      barra: 'Close your hand and turn it gently to change the season.',
    },
    {
      clip: 'tutorial_3_espacio', mapa: true, tipo: 'espacio',
      titulo: 'Space', subtitulo: 'Right hand',
      barra: 'You make the music: bring the square to the river. At each point it sounds like that stretch of the Paraná.',
    },
    {
      clip: 'tutorial_4_pulgar', mapa: true, tipo: 'dedo', dedo: 0,
      titulo: 'Filters', subtitulo: 'Right hand', nombreDedo: 'Thumb', dato: 'River width', instrumento: 'Woodwinds, the melody',
      barra: 'Finger 1, your thumb, is the river width: woodwinds, the melody. Raise it with the square on the river.',
    },
    {
      clip: 'tutorial_5_indice', mapa: true, tipo: 'dedo', dedo: 1,
      titulo: 'Filters', subtitulo: 'Right hand', nombreDedo: 'Index finger', dato: 'Water level', instrumento: 'Strings',
      barra: 'Finger 2, your index finger, is the water level: you will hear the strings.',
    },
    {
      clip: 'tutorial_6_medio', mapa: true, tipo: 'dedo', dedo: 2,
      titulo: 'Filters', subtitulo: 'Right hand', nombreDedo: 'Middle finger', dato: 'Water slope', instrumento: 'Harp and timpani',
      barra: 'Finger 3, your middle finger, is the slope of the water: harp and timpani.',
    },
    {
      clip: 'tutorial_7_anular', mapa: true, tipo: 'dedo', dedo: 3,
      titulo: 'Filters', subtitulo: 'Right hand', nombreDedo: 'Ring finger', dato: 'Range', instrumento: 'Double basses and horns',
      barra: 'Finger 4, your ring finger, is the range: double basses and horns.',
    },
    {
      clip: 'tutorial_8_fin', mapa: true, tipo: 'fin',
      titulo: 'Play the Paraná', subtitulo: 'You are the conductor',
      barra: 'Move from Rosario toward Santa Fe and listen to the river. Say next to choose your river.',
    },
  ];

  // 2. El Paraná es el del tablero de verdad. En los pasos con río, el mapa del tablero
  // (#contenedor-mapa, con su lienzo y su portada) se muda a la pantalla del tutorial y se abre el
  // Paraná con Tablero.abrir, encuadrado entre Rosario y Santa Fe. Así el dibujo, las ciudades, el
  // sonido (cercanía, paneo, datos de cada tramo, fermata) y el control con la mano (manos.js, que
  // mueve el cuadrado y prende las capas con los dedos cuando el mapa está a la vista) son
  // exactamente los del tablero. El tablero, en modo tutorial, no habla ni suena hasta que la
  // persona mueve el cuadrado: la música la genera ella al acercarse al río.
  const RIO_EJEMPLO = 'parana';
  const ENCUADRE = ['Rosario', 'Santa Fe'];
  const NOMBRES_CAPAS = ['ancho', 'nivel', 'pendiente', 'amplitud'];
  const ranuraMapa = vista.querySelector('.tutorial-mapa');
  const contenedorMapa = document.getElementById('contenedor-mapa');
  const lugarOriginal = { padre: contenedorMapa.parentNode, siguiente: contenedorMapa.nextSibling };
  let mapaMontado = false;
  let capasPrevias = null; // cómo estaban las capas, para devolverlas al cerrar el tutorial

  const capaPrendida = (i) => Boolean(window.Sonido && window.Sonido.capas[NOMBRES_CAPAS[i]].activa);
  function fijarCapa(i, prendida) {
    if (capaPrendida(i) === prendida) return;
    window.Tablero.acciones.fijarCapa(i + 1, prendida ? 'on' : 'off');
  }

  function montarMapa() {
    if (!capasPrevias) capasPrevias = NOMBRES_CAPAS.map((_, i) => capaPrendida(i));
    if (contenedorMapa.parentNode !== ranuraMapa) ranuraMapa.appendChild(contenedorMapa);
    ranuraMapa.hidden = false;
    if (mapaMontado && window.Tablero.abierto && window.Tablero.rio === RIO_EJEMPLO) {
      window.Tablero.redimensionar();
      return;
    }
    mapaMontado = true;
    window.Tablero.acciones.fijarMusica('relieve');
    window.Tablero.abrir(RIO_EJEMPLO, { tutorial: true, encuadre: ENCUADRE });
  }

  function desmontarMapa() {
    if (!mapaMontado) return;
    mapaMontado = false;
    window.Tablero.cerrar();
    lugarOriginal.padre.insertBefore(contenedorMapa, lugarOriginal.siguiente);
    ranuraMapa.hidden = true;
  }

  function devolverCapas() {
    if (!capasPrevias) return;
    capasPrevias.forEach((prendida, i) => fijarCapa(i, prendida));
    capasPrevias = null;
  }

  // Lo que muestra el panel del tablero (escondido) sobre el tramo que suena
  const barraCercania = document.getElementById('barra-cercania');
  const textoTramo = document.getElementById('tramo');
  const textoDetalle = document.getElementById('detalle');
  function cercaniaActual() {
    return barraCercania ? (parseFloat(barraCercania.style.width) || 0) / 100 : 0;
  }

  // Mano dibujada como en el PDF: dedos redondeados sobre una palma. Es la mano derecha vista de
  // frente, con el pulgar a la izquierda; la izquierda es su espejo. dedos: largo de cada dedo
  // (pulgar, índice, medio, anular, meñique), 1 estirado y 0 doblado. resaltado: dedo amarillo.
  const DEDOS = [
    null, // el pulgar va aparte
    { x: 62, ancho: 31, arriba: 46 },
    { x: 97, ancho: 31, arriba: 22 },
    { x: 132, ancho: 31, arriba: 42 },
    { x: 167, ancho: 28, arriba: 82 },
  ];
  const BASE_DEDOS = 150;
  const DOBLADO = 104; // altura de la punta de un dedo doblado (los nudillos del puño)

  function manoSvg({ lado = 'derecha', dedos = [1, 1, 1, 1, 1], resaltado = -1, clase = '' } = {}) {
    const espejo = lado === 'izquierda' ? 'transform="translate(220 0) scale(-1 1)"' : '';
    const partes = [];
    for (let i = 1; i < 5; i++) {
      const d = DEDOS[i];
      const arriba = dedos[i] ? d.arriba : DOBLADO;
      partes.push(`<rect class="${i === resaltado ? 'mano-resaltada' : 'mano-relleno'}" x="${d.x}" y="${arriba}" width="${d.ancho}" height="${BASE_DEDOS + 20 - arriba}" rx="${d.ancho / 2}"></rect>`);
    }
    // El pulgar sale de abajo de la palma hacia arriba y afuera, con la base metida en la palma
    const pulgar = dedos[0]
      ? `<rect class="${resaltado === 0 ? 'mano-resaltada' : 'mano-relleno'}" x="-17" y="-104" width="34" height="122" rx="17" transform="translate(86 236) rotate(-42)"></rect>`
      : '';
    const palma = '<path class="mano-relleno" d="M62 140 H195 V200 C195 248 166 276 124 276 C90 276 70 260 58 236 L52 222 Z"></path>';
    // En el puño, el pulgar doblado cruza la palma (la línea clara del PDF)
    const pulgarDoblado = dedos[0] ? '' : '<path class="mano-linea" d="M70 150 H118 C128 150 132 160 128 170 L116 196 C110 210 102 222 100 240"></path>';
    const delante = resaltado === 0;
    return `<svg class="mano ${clase}" viewBox="0 0 220 290" aria-hidden="true"><g ${espejo}>${delante ? '' : pulgar}${partes.join('')}${palma}${delante ? pulgar : ''}${pulgarDoblado}</g></svg>`;
  }

  const flecha = (direccion) => `<span class="tutorial-flecha tutorial-flecha-${direccion}" aria-hidden="true">${{ arriba: '↑', abajo: '↓', izquierda: '←', derecha: '→' }[direccion]}</span>`;

  // 3. Armado de cada pantalla
  function textoDe(paso) {
    return `
      <div class="tutorial-bloque">
        <h2 class="tutorial-titulo">${paso.titulo}</h2>
        <p class="tutorial-subtitulo">${paso.subtitulo}</p>
        ${paso.nombreDedo ? `<p class="tutorial-dedo">${paso.nombreDedo}</p><p class="tutorial-dato">${paso.dato}<br>${paso.instrumento}</p>` : ''}
        <p class="tutorial-estado" data-estado-gesto></p>
      </div>`;
  }

  function armar(paso) {
    switch (paso.tipo) {
      case 'intro':
        return `
          <div class="tutorial-izquierda tutorial-izquierda-ancha">
            <div class="tutorial-bloque">
              <h2 class="tutorial-titulo">${paso.titulo}</h2>
              <p class="tutorial-subtitulo">${paso.subtitulo}</p>
              <p class="tutorial-parrafo">The SWOT satellite measures every stretch of the river. Each measurement is played by a group of instruments, and you conduct the orchestra with your hands.</p>
              <ul class="tutorial-lista">
                <li><strong>Width</strong><span>Woodwinds, the melody</span></li>
                <li><strong>Level</strong><span>Strings</span></li>
                <li><strong>Slope</strong><span>Harp and timpani</span></li>
                <li><strong>Range</strong><span>Double basses and horns</span></li>
              </ul>
            </div>
          </div>`;
      case 'manos':
        return `
          <div class="tutorial-manos">
            <figure class="tutorial-mano" data-lado="izquierda">
              ${manoSvg({ lado: 'izquierda' })}
              <figcaption><strong>Left</strong><span>Time</span></figcaption>
            </figure>
            <figure class="tutorial-mano" data-lado="derecha">
              ${manoSvg({ lado: 'derecha' })}
              <figcaption><strong>Right</strong><span>Space<br>Filters</span></figcaption>
            </figure>
          </div>
          <p class="tutorial-estado tutorial-estado-centro" data-estado-gesto></p>`;
      case 'estaciones':
        return `
          <div class="tutorial-izquierda">
            <div class="tutorial-ilustracion tutorial-giro" data-lado="izquierda">
              <svg class="tutorial-giro-flecha" viewBox="0 0 300 300" aria-hidden="true">
                <path d="M150 284 A134 134 0 1 1 268 92"></path>
                <path d="M252 98 L268 92 L280 106"></path>
              </svg>
              ${manoSvg({ lado: 'izquierda', dedos: [0, 0, 0, 0, 0] })}
            </div>
            ${textoDe(paso)}
          </div>`;
      case 'espacio':
        return `
          <div class="tutorial-izquierda">
            <div class="tutorial-ilustracion tutorial-cruz" data-lado="derecha">
              ${flecha('arriba')}${flecha('izquierda')}
              ${manoSvg({ lado: 'derecha' })}
              ${flecha('derecha')}${flecha('abajo')}
            </div>
            ${textoDe(paso)}
          </div>`;
      case 'dedo': {
        const dedos = [0, 0, 0, 0, 0];
        dedos[paso.dedo] = 1;
        return `
          <div class="tutorial-izquierda">
            <div class="tutorial-ilustracion" data-lado="derecha">
              ${manoSvg({ lado: 'derecha', dedos, resaltado: paso.dedo })}
            </div>
            ${textoDe(paso)}
          </div>`;
      }
      case 'fin':
        return `
          <div class="tutorial-izquierda tutorial-izquierda-ancha">
            <div class="tutorial-bloque">
              <h2 class="tutorial-titulo">${paso.titulo}</h2>
              <p class="tutorial-subtitulo">${paso.subtitulo}</p>
              <ul class="tutorial-lista">
                <li><strong>Right hand</strong><span>Move along the river</span></li>
                <li><strong>Fingers</strong><span>Bring instruments in and out</span></li>
                <li><strong>Left fist</strong><span>Turn to change the season</span></li>
                <li><strong>Space bar</strong><span>Hold it and speak</span></li>
              </ul>
            </div>
          </div>`;
      default:
        return '';
    }
  }

  // 4. Estado
  let abierto = false;
  let indice = 0;
  let paso = PASOS[0];
  let cuadroAnimacion = null;
  let gesto = null; // lo que cada pantalla recuerda del gesto (ver actualizar)

  function mostrarPaso(nuevo, hablar = true) {
    indice = Math.max(0, Math.min(PASOS.length - 1, nuevo));
    paso = PASOS[indice];
    vista.dataset.paso = String(indice);
    vista.dataset.tipo = paso.tipo;
    escena.innerHTML = armar(paso);
    escena.setAttribute('aria-label', `Step ${indice + 1} of ${PASOS.length}`);
    progreso.style.width = `${((indice + 1) / PASOS.length) * 100}%`;
    textoBarra.textContent = paso.barra;
    textoBarra.title = TEXTOS[paso.clip] || paso.barra;
    botonSiguiente.textContent = indice === PASOS.length - 1 ? 'Choose a river' : 'Next';
    gesto = {
      listo: false, desde: 0, pendienteAviso: false, giroBase: null,
      dedos: NOMBRES_CAPAS.map(() => ({ candidato: false, confirmado: false, desde: 0 })),
    };
    anuncios.textContent = `Tutorial, step ${indice + 1} of ${PASOS.length}. ${TEXTOS[paso.clip] || paso.barra}`;
    prepararPaso();
    if (hablar) decirPaso();
    actualizar();
  }

  function decirPaso() {
    if (window.Locucion) window.Locucion.decir(paso.clip, IDIOMA);
  }

  // Un timbre corto, propio del tutorial, para cada gesto reconocido
  let contextoAudio = null;
  function timbre() {
    try {
      contextoAudio = contextoAudio || new AudioContext();
      const ahora = contextoAudio.currentTime;
      [880, 1318.5].forEach((frecuencia, k) => {
        const osc = contextoAudio.createOscillator();
        const ganancia = contextoAudio.createGain();
        osc.type = 'sine';
        osc.frequency.value = frecuencia;
        const t = ahora + k * 0.09;
        ganancia.gain.setValueAtTime(0, t);
        ganancia.gain.linearRampToValueAtTime(0.18, t + 0.01);
        ganancia.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(ganancia).connect(contextoAudio.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch (error) {
      // Sin audio el tutorial sigue igual
    }
  }

  const camaraActiva = () => Boolean(window.Manos && window.Manos.activa);
  const estadoManos = () => (window.Manos ? window.Manos.estado : null);

  function ponerEstado(texto, listo) {
    const elemento = escena.querySelector('[data-estado-gesto]');
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.classList.toggle('listo', Boolean(listo));
  }

  function reconocido() {
    vista.classList.remove('destello');
    void vista.offsetWidth; // reinicia la animación
    vista.classList.add('destello');
    timbre();
  }

  // Pasos donde la persona genera la música recorriendo el río del tablero
  const CON_SONIDO = ['espacio', 'dedo', 'fin'];

  // Qué está sonando, leído del panel del tablero
  function estadoSonoro(derecha, camara) {
    const acciones = window.Tablero.acciones;
    if (!acciones.orquestaLista) return 'Loading the orchestra…';
    if (!acciones.iniciado) return 'Click the map, or press a key, to turn on the sound';
    const cerca = cercaniaActual();
    if (!derecha && cerca === 0) {
      return camara ? 'Raise your right hand to move the square' : 'Turn on the camera with the C key, or move the mouse over the map';
    }
    if (cerca === 0) return 'Silence. Bring the square to the river';
    const valores = [...document.querySelectorAll('#capas .capa .valor')].map((e) => e.textContent.split(', ')[0]);
    const lugar = cerca > 0.85 ? 'On the river' : 'Getting closer';
    const tramo = `${lugar}, ${textoTramo.textContent}
Width ${valores[0]}
Level ${valores[1]}
Slope ${valores[2]}
Range ${valores[3]}`;
    if (paso.tipo !== 'dedo') return tramo;
    const prendidas = NOMBRES_CAPAS.filter((_, i) => capaPrendida(i)).length;
    if (prendidas === 0) return `All fingers down, the orchestra is quiet. Raise your ${paso.nombreDedo.toLowerCase()}`;
    return capaPrendida(paso.dedo) ? `${paso.instrumento} on
${tramo}` : `Raise your ${paso.nombreDedo.toLowerCase()}
${tramo}`;
  }

  // Al entrar a un paso: el mapa del tablero a la vista o guardado, y las capas según el paso. En el
  // espacio y en el cierre arrancan las cuatro prendidas; en los dedos, apagadas. Con la mano a la
  // vista, manos.js las ajusta a los dedos levantados, igual que en el tablero.
  let tipoAnterior = null;
  function prepararPaso() {
    if (paso.mapa) montarMapa();
    else desmontarMapa();
    if (paso.tipo !== tipoAnterior) {
      if (paso.tipo === 'dedo' && tipoAnterior !== 'dedo') NOMBRES_CAPAS.forEach((_, i) => fijarCapa(i, false));
      if (paso.tipo === 'espacio' || paso.tipo === 'fin') NOMBRES_CAPAS.forEach((_, i) => fijarCapa(i, true));
    }
    tipoAnterior = paso.tipo;
  }

  // 5. Cada cuadro mientras el tutorial está abierto: la cámara, las pastillas y el gesto del paso
  function actualizar() {
    const activa = camaraActiva();
    pastillaCamara.classList.toggle('prendida', activa);
    pastillaCamara.querySelector('.tutorial-pastilla-texto').textContent = activa ? 'Camera activated' : 'Camera off · press C';
    copiarCamara(activa);

    const estado = activa ? estadoManos() : null;
    const ahora = performance.now();
    const derecha = Boolean(estado && estado.manoDerechaActiva);
    const izquierda = Boolean(estado && estado.manoIzquierdaActiva);
    for (const figura of escena.querySelectorAll('[data-lado]')) {
      figura.classList.toggle('detectada', figura.dataset.lado === 'derecha' ? derecha : izquierda);
    }

    // Pasos con sonido: el tablero hace todo (cuadrado, sonido, dedos); acá solo se muestra qué suena
    if (CON_SONIDO.includes(paso.tipo)) {
      const ilustracion = escena.querySelector('.tutorial-ilustracion');
      if (paso.tipo === 'dedo' && ilustracion) ilustracion.classList.toggle('dedo-arriba', capaPrendida(paso.dedo));
      ponerEstado(estadoSonoro(derecha, activa), cercaniaActual() > 0);
      return;
    }

    if (!activa) {
      ponerEstado(paso.tipo === 'intro' ? '' : 'Turn on the camera with the C key to try the gesture');
      return;
    }

    switch (paso.tipo) {
      case 'manos': {
        const ambas = derecha && izquierda;
        if (!ambas) gesto.desde = 0;
        else if (!gesto.desde) gesto.desde = ahora;
        const listo = ambas && ahora - gesto.desde >= ESTABLE_MS;
        if (listo && !gesto.listo) {
          gesto.listo = true;
          reconocido();
          gesto.pendienteAviso = true;
        }
        if (gesto.pendienteAviso && !(window.Locucion && window.Locucion.hablando)) {
          gesto.pendienteAviso = false;
          if (window.Locucion) window.Locucion.decir('tutorial_manos_listas', IDIOMA);
        }
        botonSiguiente.classList.toggle('bloqueado', !gesto.listo);
        const falta = !izquierda && !derecha ? 'Raise both hands' : !izquierda ? 'Raise your left hand' : !derecha ? 'Raise your right hand' : 'Hold them still…';
        ponerEstado(gesto.listo ? 'Both hands in view. Say next to continue' : falta, gesto.listo);
        break;
      }
      case 'estaciones': {
        const puno = Boolean(estado.punoIzquierdoActivo);
        const flechaGiro = escena.querySelector('.tutorial-giro-flecha');
        if (flechaGiro) flechaGiro.style.transform = `rotate(${estado.anguloTiempo}deg)`;
        escena.querySelector('.tutorial-giro').classList.toggle('puno', puno);
        if (!puno) gesto.giroBase = null;
        else if (gesto.giroBase === null) gesto.giroBase = estado.anguloTiempo;
        // Un cuarto de vuelta alcanza para mostrar que el giro se reconoce (la estación cambia con una vuelta entera)
        if (puno && Math.abs(estado.anguloTiempo - gesto.giroBase) >= 90 && !gesto.listo) {
          gesto.listo = true;
          reconocido();
        }
        if (!puno && gesto.listo) gesto.listo = false; // al abrir la mano se puede volver a probar
        ponerEstado(!izquierda ? 'Raise your left hand' : !puno ? 'Close your left hand into a fist' : gesto.listo ? 'Turning! A full turn changes the season' : 'Now turn your fist gently', gesto.listo);
        break;
      }
      default:
        ponerEstado('');
    }
  }

  function bucle() {
    if (!abierto) return;
    actualizar();
    cuadroAnimacion = requestAnimationFrame(bucle);
  }

  // El visor de manos.js se sigue dibujando aunque su panel esté escondido; acá se copia
  const contextoCamara = lienzoCamara.getContext('2d');
  function copiarCamara(activa) {
    avisoCamara.hidden = activa;
    lienzoCamara.hidden = !activa;
    if (!activa) return;
    const visor = document.querySelector('.camara-lienzo');
    if (!visor || !visor.width) return;
    if (lienzoCamara.width !== visor.width || lienzoCamara.height !== visor.height) {
      lienzoCamara.width = visor.width;
      lienzoCamara.height = visor.height;
    }
    contextoCamara.drawImage(visor, 0, 0);
  }

  // El micrófono: prendido si el navegador ya dio el permiso
  async function seguirMicrofono() {
    const poner = (prendido) => {
      pastillaMicro.classList.toggle('prendida', prendido);
      pastillaMicro.querySelector('.tutorial-pastilla-texto').textContent = prendido ? 'Micro activated' : 'Micro off';
    };
    poner(false);
    if (!navigator.permissions || !navigator.permissions.query) return;
    try {
      const permiso = await navigator.permissions.query({ name: 'microphone' });
      poner(permiso.state === 'granted');
      permiso.addEventListener('change', () => poner(permiso.state === 'granted'));
    } catch (error) {
      // Firefox no conoce el permiso "microphone"
    }
  }
  seguirMicrofono();

  // 6. Navegación
  function siguiente(desdeVoz = false) {
    if (paso.tipo === 'manos' && camaraActiva() && !gesto.listo) {
      if (window.Locucion) window.Locucion.decir('tutorial_falta_mano', IDIOMA);
      const manos = escena.querySelector('.tutorial-manos');
      if (manos) {
        manos.classList.remove('sacudir');
        void manos.offsetWidth;
        manos.classList.add('sacudir');
      }
      return false;
    }
    if (indice < PASOS.length - 1) {
      mostrarPaso(indice + 1);
      return true;
    }
    terminar(desdeVoz);
    return true;
  }

  function anterior() {
    if (indice === 0) {
      window.App.ir('bienvenida');
      return;
    }
    mostrarPaso(indice - 1);
  }

  // Al terminar va al menú y lo presenta, como la continuación de la última nota de voz
  function terminar() {
    window.App.ir('rios');
    if (window.Locucion) window.Locucion.decir('vista_menu', IDIOMA);
  }

  function saltar(desdeVoz = false) {
    window.App.ir('rios');
    if (window.Locucion) {
      if (desdeVoz) window.Locucion.decir(['tutorial_saltar', 'vista_menu'], IDIOMA);
      else window.Locucion.detener();
    }
  }

  botonSiguiente.addEventListener('click', () => siguiente());
  botonRepetir.addEventListener('click', decirPaso);
  vista.querySelector('.tutorial-saltar').addEventListener('click', () => saltar());

  // En la fase de captura, antes que el tablero (que también escucha el teclado cuando su mapa está
  // montado acá): Enter, N, Backspace, R y Escape son del tutorial. Con el mapa a la vista, las
  // flechas mueven el cuadrado y 1 a 4 prenden las capas, como en el tablero.
  window.addEventListener('keydown', (evento) => {
    if (!abierto || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(evento.target.tagName)) return;
    const tecla = evento.key;
    // Con el foco en un botón, Enter lo activa: no se avanza dos veces
    if (tecla === 'Enter' && evento.target.closest && evento.target.closest('#vista-tutorial button')) return;
    const flechas = !paso.mapa;
    let accion = null;
    if (tecla === 'Enter' || tecla.toLowerCase() === 'n' || (flechas && tecla === 'ArrowRight')) accion = () => siguiente();
    else if (tecla === 'Backspace' || (flechas && tecla === 'ArrowLeft')) accion = anterior;
    else if (tecla.toLowerCase() === 'r') accion = decirPaso;
    else if (tecla === 'Escape') accion = () => saltar();
    if (!accion) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    accion();
  }, true);

  // 7. Para app.js (abrir y cerrar con la vista) y voz.js (comandos)
  window.Tutorial = {
    abrir() {
      abierto = true;
      mostrarPaso(0);
      cancelAnimationFrame(cuadroAnimacion);
      cuadroAnimacion = requestAnimationFrame(bucle);
      botonSiguiente.focus({ preventScroll: true });
    },
    cerrar() {
      abierto = false;
      cancelAnimationFrame(cuadroAnimacion);
      desmontarMapa();
      devolverCapas();
      tipoAnterior = null;
    },
    siguiente,
    anterior,
    repetir: decirPaso,
    saltar,
    get paso() { return indice; },
    pasos: PASOS.length,
  };
})();
