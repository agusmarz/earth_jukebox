// Control por gestos con la cámara, en el navegador. Es el port de manos/Mediapipe.py
// (RastreadorManos) a @mediapipe/tasks-vision, sin ningún proceso aparte.
//
// Mano derecha: su nudillo medio (landmark 9) mueve el cuadrado lector sobre el mapa, y sus
// cuatro primeros dedos (pulgar, índice, medio, anular) prenden y apagan las capas 1 a 4
// (ancho, nivel, pendiente, amplitud). El meñique no hace nada.
// Mano izquierda: con el puño cerrado, cada vuelta completa alrededor de un eje que flota con la
// mano cambia la estación. En sentido horario avanza y en antihorario retrocede.
//
// No toca el código de demo.js. Habla con la demo por el DOM: mueve el cuadrado con eventos
// pointermove sintéticos sobre #mapa, aprieta los botones de #capas y cambia #selector-estacion
// disparando su evento change. Mientras se ve la mano derecha, el mouse real no mueve el cuadrado.
// Sin mano, el mouse y las flechas siguen como siempre.

(function () {
  const VERSION_VISION = '0.10.14';
  const URL_VISION = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_VISION}`;
  // El modelo se busca primero en la demo y en la carpeta del prototipo, y si no está se baja de Google
  const RUTAS_MODELO = [
    'hand_landmarker.task',
    '../../manos/hand_landmarker.task',
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  ];
  const TECLA_CAMARA = 'c';

  // Parámetros de RastreadorManos en Mediapipe.py, salvo SENSIBILIDAD (allá 2.4). La zona activa de
  // la mano derecha mide 1 / SENSIBILIDAD del cuadro de la cámara: con 1.6 es el 62,5 %, más cómoda
  // de recorrer que el 42 % del prototipo
  const SENSIBILIDAD = 1.6;
  const SUAVIZADO = 0.22;
  const SUAVIZADO_MANO_IZQ = 0.35; // filtra micro-temblores de la mano
  const SEGUIMIENTO_CENTRO = 0.065; // qué tan rápido el eje sigue la deriva del puño
  const RADIO_MINIMO = 0.035; // movimiento mínimo para considerar que está girando
  const UMBRAL_PUNO_CERRAR = 1.15; // ratio puntas-muñeca / palma por debajo del cual se cierra
  const UMBRAL_PUNO_ABRIR = 1.35; // y por encima del cual se suelta (histéresis)

  // Propios de la web
  const ANTIRREBOTE_DEDOS_MS = 200; // un dedo tiene que quedarse así este tiempo para cambiar la capa
  const ZONA_MUERTA_PX = 1.5; // el temblor de la mano no cuenta como movimiento, así llega la fermata
  const GRADOS_POR_ESTACION = 360;
  const DEDOS_CAPAS = 4; // pulgar, índice, medio y anular. El meñique se ignora
  const NOMBRES_DEDOS = ['Thumb', 'Index', 'Middle', 'Ring'];

  const CONEXIONES = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
  ];

  const contenedor = document.getElementById('contenedor-mapa');
  const lienzo = document.getElementById('mapa');
  if (!contenedor || !lienzo) return;

  // 1. Estado, como EstadoGestos en Mediapipe.py
  const estado = {
    manoDerechaActiva: false,
    posX: 0.5,
    posY: 0.5,
    dedosLevantados: [false, false, false, false, false],
    manoIzquierdaActiva: false,
    punoIzquierdoActivo: false,
    anguloTiempo: 0, // grados acumulados, puede pasar de +-360
    velocidadAngular: 0, // grados por cuadro
    girandoActivamente: false,
  };
  let posSuaveIzq = null;
  let centroDinamicoIzq = null;
  let ultimoAnguloIzq = null;
  // Lo que se dibuja del puño izquierdo en este cuadro
  let ejeIzq = null;

  // 2. Panel de la cámara
  const panel = document.createElement('section');
  panel.className = 'camara';
  panel.setAttribute('aria-label', 'Hand control with the camera');
  panel.innerHTML = `
    <div class="camara-vista" hidden>
      <canvas class="camara-lienzo" aria-hidden="true"></canvas>
      <div class="camara-hud">
        <div class="camara-fila">
          <span class="camara-etiqueta">Right</span>
          <span class="camara-dedos"></span>
        </div>
        <div class="camara-fila">
          <span class="camara-etiqueta">Left</span>
          <span class="camara-giro">Open hand</span>
        </div>
        <span class="camara-pista" aria-hidden="true"><span class="camara-relleno"></span></span>
      </div>
    </div>
    <p class="camara-aviso" aria-live="polite"></p>
    <button class="camara-boton" type="button" aria-pressed="false">
      <span class="camara-tecla" aria-hidden="true">C</span>
      <span class="camara-texto">Camera off</span>
    </button>`;
  // Va abajo a la derecha, en el pie del panel del río, al lado del minimapa. Sin ese pie, sobre el mapa
  const pie = document.querySelector('.panel .pie-panel');
  if (pie) {
    panel.classList.add('camara-en-pie');
    pie.prepend(panel);
  } else {
    contenedor.appendChild(panel);
  }

  const vista = panel.querySelector('.camara-vista');
  const visor = panel.querySelector('.camara-lienzo');
  const contextoVisor = visor.getContext('2d');
  const aviso = panel.querySelector('.camara-aviso');
  const boton = panel.querySelector('.camara-boton');
  const textoBoton = panel.querySelector('.camara-texto');
  const textoGiro = panel.querySelector('.camara-giro');
  const rellenoGiro = panel.querySelector('.camara-relleno');
  const cajaDedos = panel.querySelector('.camara-dedos');
  const marcasDedos = NOMBRES_DEDOS.map((nombre, i) => {
    const marca = document.createElement('span');
    marca.className = 'camara-dedo';
    marca.textContent = String(i + 1);
    marca.title = nombre;
    cajaDedos.appendChild(marca);
    return marca;
  });

  // La imagen espejada que se le pasa a MediaPipe, como cv2.flip(frame, 1)
  const espejo = document.createElement('canvas');
  const contextoEspejo = espejo.getContext('2d');
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;

  let landmarker = null;
  let cargaLandmarker = null;
  let flujo = null;
  let encendida = false;
  let ultimoTiempoVideo = -1;
  let ultimaMarca = -1;
  let cuadro = 0;

  function mostrarAviso(texto) {
    aviso.textContent = texto;
    aviso.hidden = !texto;
  }
  mostrarAviso('');

  // 3. Carga de MediaPipe y del modelo
  async function leerModelo() {
    for (const ruta of RUTAS_MODELO) {
      try {
        const respuesta = await fetch(ruta);
        const tipo = respuesta.headers.get('content-type') || '';
        if (!respuesta.ok || tipo.includes('text/html')) continue;
        const datos = new Uint8Array(await respuesta.arrayBuffer());
        if (datos.length > 100000) return datos;
      } catch (error) {
        // Sigue con la ruta siguiente
      }
    }
    throw new Error('Could not find hand_landmarker.task');
  }

  async function crearLandmarker() {
    const { FilesetResolver, HandLandmarker } = await import(`${URL_VISION}/vision_bundle.mjs`);
    const [archivos, modelo] = await Promise.all([
      FilesetResolver.forVisionTasks(`${URL_VISION}/wasm`),
      leerModelo(),
    ]);
    const opciones = (delegado) => ({
      baseOptions: { modelAssetBuffer: modelo, delegate: delegado },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      return await HandLandmarker.createFromOptions(archivos, opciones('GPU'));
    } catch (error) {
      return HandLandmarker.createFromOptions(archivos, opciones('CPU'));
    }
  }

  // 4. Encender y apagar la cámara
  async function encender() {
    if (encendida) return;
    encendida = true;
    actualizarBoton();
    mostrarAviso('Loading the hand model…');
    try {
      if (!cargaLandmarker) cargaLandmarker = crearLandmarker();
      const [modelo, medio] = await Promise.all([
        cargaLandmarker,
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false }),
      ]);
      landmarker = modelo;
      if (!encendida) {
        for (const pista of medio.getTracks()) pista.stop();
        return;
      }
      flujo = medio;
      video.srcObject = flujo;
      await video.play();
      mostrarAviso('');
      vista.hidden = false;
      ultimoTiempoVideo = -1;
      requestAnimationFrame(procesar);
    } catch (error) {
      if (error && error.name === 'NotAllowedError') mostrarAviso('The browser blocked the camera');
      else if (error && error.name === 'NotFoundError') mostrarAviso('No camera found');
      else mostrarAviso(`Hand control is unavailable. ${error && error.message ? error.message : ''}`);
      if (!landmarker) cargaLandmarker = null;
      apagar(true);
    }
  }

  function apagar(conservarAviso) {
    encendida = false;
    if (flujo) for (const pista of flujo.getTracks()) pista.stop();
    flujo = null;
    video.srcObject = null;
    vista.hidden = true;
    if (!conservarAviso) mostrarAviso('');
    soltarManoDerecha();
    estado.manoIzquierdaActiva = false;
    resetearTrackingIzquierdo();
    actualizarBoton();
  }

  function actualizarBoton() {
    boton.setAttribute('aria-pressed', String(encendida));
    textoBoton.textContent = encendida ? 'Camera on' : 'Camera off';
    boton.setAttribute('aria-label', `Hand control with the camera, ${encendida ? 'on' : 'off'}. Key C`);
  }
  actualizarBoton();

  boton.addEventListener('click', () => (encendida ? apagar() : encender()));
  window.addEventListener('keydown', (evento) => {
    if (evento.key.toLowerCase() !== TECLA_CAMARA || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(evento.target.tagName)) return;
    if (!mapaVisible()) return;
    if (encendida) apagar();
    else encender();
  });

  // 5. Cada cuadro de la cámara
  function procesar() {
    if (!encendida || !landmarker) return;
    requestAnimationFrame(procesar);
    if (video.readyState < 2 || video.currentTime === ultimoTiempoVideo) return;
    ultimoTiempoVideo = video.currentTime;

    const ancho = video.videoWidth;
    const alto = video.videoHeight;
    if (!ancho || !alto) return;
    if (espejo.width !== ancho || espejo.height !== alto) {
      espejo.width = ancho;
      espejo.height = alto;
    }
    contextoEspejo.setTransform(-1, 0, 0, 1, ancho, 0);
    contextoEspejo.drawImage(video, 0, 0, ancho, alto);

    const marca = Math.max(ultimaMarca + 1, Math.round(performance.now()));
    ultimaMarca = marca;
    let resultado;
    try {
      resultado = landmarker.detectForVideo(espejo, marca);
    } catch (error) {
      return;
    }

    ejeIzq = null;
    const { derecha: landmarksDerecha, izquierda: landmarksIzquierda } = asignarManos(resultado, marca);
    const derechaVista = landmarksDerecha !== null;
    const izquierdaVista = landmarksIzquierda !== null;
    if (derechaVista) actualizarManoDerecha(landmarksDerecha);
    if (izquierdaVista) actualizarManoIzquierda(landmarksIzquierda, ancho, alto);

    estado.manoDerechaActiva = derechaVista;
    if (!derechaVista) estado.dedosLevantados = [false, false, false, false, false];
    estado.manoIzquierdaActiva = izquierdaVista;
    if (!izquierdaVista) resetearTrackingIzquierdo();

    aplicarALaDemo();
    dibujar(landmarksDerecha, landmarksIzquierda);
    mostrarHud();
  }

  // 5b. Qué mano es cuál. MediaPipe etiqueta cada mano por su forma, y con el puño cerrado (casi
  // simétrico) o lejos de su lado suele confundir la izquierda con la derecha. Si eso pasa a mitad
  // de un giro, el puño movería el cuadrado y el giro se cortaría. Por eso una mano conserva su
  // identidad mientras siga cerca de donde estaba en los cuadros anteriores, en cualquier parte de
  // la cámara, y la etiqueta solo decide cuando una mano aparece de nuevo. Así solo la derecha mueve
  // el cuadrado y las capas, y solo la izquierda cambia la estación.
  // Una mano que aparece sola se decide por mayoría de la etiqueta en VOTOS_MANO_NUEVA cuadros
  // seguidos, porque un solo cuadro mal etiquetado haría que la izquierda arranque moviendo el
  // cuadrado. Mientras se vota, la mano no hace nada.
  const MEMORIA_MANO_MS = 400; // tras perder una mano, cuánto se recuerda dónde estaba
  const DISTANCIA_MISMA_MANO = 0.2; // en fracción del cuadro, lo más que se mueve una mano entre cuadros
  const VOTOS_MANO_NUEVA = 5; // impar, para que no haya empate
  const ultimaPosicion = { derecha: null, izquierda: null };
  let candidata = null; // mano nueva en votación: { x, y, t, votos: { derecha, izquierda } }

  function asignarManos(resultado, ahora) {
    const manos = resultado.landmarks || [];
    // En espejo, la etiqueta "Left" de MediaPipe es la mano derecha física
    const lados = manos.map((_, i) => {
      const categoria = resultado.handedness && resultado.handedness[i] && resultado.handedness[i][0];
      return categoria && categoria.categoryName === 'Left' ? 'derecha' : 'izquierda';
    });
    const centros = manos.map((lm) => ({ x: (lm[0].x + lm[9].x) / 2, y: (lm[0].y + lm[9].y) / 2 }));
    const reciente = (lado) => {
      const p = ultimaPosicion[lado];
      return p && ahora - p.t < MEMORIA_MANO_MS ? p : null;
    };
    const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const previaDerecha = reciente('derecha');
    const previaIzquierda = reciente('izquierda');
    const asignadas = { derecha: null, izquierda: null };

    if (manos.length !== 1) candidata = null;
    if (manos.length >= 2) {
      const [a, b] = centros;
      let primeraEsDerecha;
      if (previaDerecha && previaIzquierda) {
        primeraEsDerecha = distancia(a, previaDerecha) + distancia(b, previaIzquierda)
          <= distancia(a, previaIzquierda) + distancia(b, previaDerecha);
      } else if (previaDerecha || previaIzquierda) {
        const previa = previaDerecha || previaIzquierda;
        const primeraMasCerca = distancia(a, previa) <= distancia(b, previa);
        primeraEsDerecha = previaDerecha ? primeraMasCerca : !primeraMasCerca;
      } else if (lados[0] !== lados[1]) {
        primeraEsDerecha = lados[0] === 'derecha';
      } else {
        primeraEsDerecha = a.x > b.x; // en espejo, la mano derecha queda a la derecha de la imagen
      }
      asignadas.derecha = primeraEsDerecha ? 0 : 1;
      asignadas.izquierda = primeraEsDerecha ? 1 : 0;
    } else if (manos.length === 1) {
      const c = centros[0];
      const aDerecha = previaDerecha ? distancia(c, previaDerecha) : Infinity;
      const aIzquierda = previaIzquierda ? distancia(c, previaIzquierda) : Infinity;
      if (Math.min(aDerecha, aIzquierda) < DISTANCIA_MISMA_MANO) {
        candidata = null;
        asignadas[aDerecha < aIzquierda ? 'derecha' : 'izquierda'] = 0;
      } else {
        // Mano nueva: se vota su etiqueta, cuadro a cuadro, mientras siga en el mismo lugar
        if (!candidata || ahora - candidata.t > MEMORIA_MANO_MS || distancia(c, candidata) > DISTANCIA_MISMA_MANO) {
          candidata = { votos: { derecha: 0, izquierda: 0 } };
        }
        Object.assign(candidata, c, { t: ahora });
        candidata.votos[lados[0]]++;
        if (candidata.votos.derecha + candidata.votos.izquierda >= VOTOS_MANO_NUEVA) {
          asignadas[candidata.votos.derecha > candidata.votos.izquierda ? 'derecha' : 'izquierda'] = 0;
          candidata = null;
        }
      }
    }

    const salida = { derecha: null, izquierda: null };
    for (const lado of ['derecha', 'izquierda']) {
      const i = asignadas[lado];
      if (i === null) continue;
      salida[lado] = manos[i];
      ultimaPosicion[lado] = { ...centros[i], t: ahora };
    }
    return salida;
  }

  // 6. Matemática de RastreadorManos
  function detectarDedos(lm) {
    const pulgar = (lm[4].x - lm[3].x) * (lm[5].x - lm[17].x) > 0;
    const dedos = [pulgar];
    for (const [punta, articulacion] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
      dedos.push(lm[punta].y < lm[articulacion].y);
    }
    return dedos;
  }

  // Puño: distancia media de las puntas de los cuatro dedos a la muñeca, normalizada por la
  // palma (muñeca a nudillo medio). Funciona en cualquier orientación.
  function detectarPuno(lm, ancho, alto, cerrado) {
    const aspecto = alto / ancho;
    const muneca = lm[0];
    const distancia = (p) => Math.hypot(p.x - muneca.x, (p.y - muneca.y) * aspecto);
    const palma = Math.max(distancia(lm[9]), 1e-5);
    const puntas = [8, 12, 16, 20];
    const ratio = puntas.reduce((suma, i) => suma + distancia(lm[i]), 0) / puntas.length / palma;
    return ratio < (cerrado ? UMBRAL_PUNO_ABRIR : UMBRAL_PUNO_CERRAR);
  }

  const limitar = (v) => Math.max(0, Math.min(1, v));

  function actualizarManoDerecha(lm) {
    estado.dedosLevantados = detectarDedos(lm);
    const objetivoX = limitar((lm[9].x - 0.5) * SENSIBILIDAD + 0.5);
    const objetivoY = limitar((lm[9].y - 0.5) * SENSIBILIDAD + 0.5);
    estado.posX += (objetivoX - estado.posX) * SUAVIZADO;
    estado.posY += (objetivoY - estado.posY) * SUAVIZADO;
  }

  function resetearTrackingIzquierdo() {
    estado.punoIzquierdoActivo = false;
    estado.girandoActivamente = false;
    estado.velocidadAngular = 0;
    posSuaveIzq = null;
    centroDinamicoIzq = null;
    ultimoAnguloIzq = null;
  }

  function actualizarManoIzquierda(lm, ancho, alto) {
    estado.punoIzquierdoActivo = detectarPuno(lm, ancho, alto, estado.punoIzquierdoActivo);
    if (!estado.punoIzquierdoActivo) {
      // Mano abierta: se pausa el giro y se reinicia el eje
      estado.girandoActivamente = false;
      estado.velocidadAngular = 0;
      posSuaveIzq = null;
      centroDinamicoIzq = null;
      ultimoAnguloIzq = null;
      return;
    }

    const crudoX = lm[9].x;
    const crudoY = lm[9].y;
    // El eje arranca en el punto exacto donde se cerró el puño
    if (!posSuaveIzq || !centroDinamicoIzq) {
      posSuaveIzq = { x: crudoX, y: crudoY };
      centroDinamicoIzq = { x: crudoX, y: crudoY };
      ultimoAnguloIzq = null;
      return;
    }

    // 1. Posición suavizada del puño
    posSuaveIzq.x += (crudoX - posSuaveIzq.x) * SUAVIZADO_MANO_IZQ;
    posSuaveIzq.y += (crudoY - posSuaveIzq.y) * SUAVIZADO_MANO_IZQ;
    const { x: sx, y: sy } = posSuaveIzq;

    // 2. Vector del eje al puño, compensando la relación de aspecto
    const dx = sx - centroDinamicoIzq.x;
    const dy = (sy - centroDinamicoIzq.y) * (alto / ancho);
    if (Math.hypot(dx, dy) > RADIO_MINIMO) {
      estado.girandoActivamente = true;
      const angulo = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ultimoAnguloIzq !== null) {
        let delta = angulo - ultimoAnguloIzq;
        if (delta > 180) delta -= 360;
        else if (delta < -180) delta += 360;
        estado.anguloTiempo += delta;
        estado.velocidadAngular = delta;
      } else {
        estado.velocidadAngular = 0;
      }
      ultimoAnguloIzq = angulo;
    } else {
      estado.girandoActivamente = false;
      estado.velocidadAngular = 0;
      ultimoAnguloIzq = null;
    }

    // 3. El eje sigue la deriva del puño en el aire
    centroDinamicoIzq.x += (sx - centroDinamicoIzq.x) * SEGUIMIENTO_CENTRO;
    centroDinamicoIzq.y += (sy - centroDinamicoIzq.y) * SEGUIMIENTO_CENTRO;
    ejeIzq = { cx: centroDinamicoIzq.x, cy: centroDinamicoIzq.y, sx, sy };
  }

  // 7. De los gestos a la demo
  let controlPorMano = false;
  let anguloReferencia = 0; // ángulo en el que se hizo el último cambio de estación
  const dedosEstables = Array.from({ length: DEDOS_CAPAS }, () => ({ candidato: null, desde: 0, confirmado: null }));

  // El mapa solo está en pantalla en el tablero de un río
  function mapaVisible() {
    return !document.hidden && lienzo.getClientRects().length > 0;
  }

  // Mientras se ve la mano derecha, el mouse real no mueve el cuadrado ni lo saca del mapa
  for (const tipo of ['pointermove', 'pointerleave']) {
    window.addEventListener(tipo, (evento) => {
      if (controlPorMano && evento.isTrusted && evento.target === lienzo) evento.stopPropagation();
    }, true);
  }

  // Las esquinas de la zona de la mano van a las esquinas de la parte útil del mapa, la que no tapan
  // el panel gris, el logo ni las fuentes. Si el mapa no la informa, la parte que no tapa el panel
  function areaUtil(caja) {
    const area = window.Mapa && window.Mapa.areaUtil;
    if (area && area.ancho > 1 && area.alto > 1) return area;
    const panelRio = document.querySelector('.panel');
    const tapa = panelRio ? panelRio.getBoundingClientRect() : null;
    const ancho = tapa && tapa.width > 0 ? Math.max(200, tapa.left - caja.left) : caja.width;
    return { x: 0, y: 0, ancho, alto: caja.height };
  }

  function moverCuadrado(x, y) {
    const caja = lienzo.getBoundingClientRect();
    const area = areaUtil(caja);
    // Arriba la mano llega más alto que el río: hasta el mismo margen que a los costados, aunque el
    // río deje libre la altura del logo
    const arriba = Math.min(area.y, area.x);
    const px = area.x + x * area.ancho;
    const py = arriba + y * (area.y + area.alto - arriba);
    if (moverCuadrado.ultimo && Math.hypot(px - moverCuadrado.ultimo.x, py - moverCuadrado.ultimo.y) < ZONA_MUERTA_PX) return;
    moverCuadrado.ultimo = { x: px, y: py };
    lienzo.dispatchEvent(new PointerEvent('pointermove', {
      clientX: caja.left + px, clientY: caja.top + py, bubbles: true, pointerType: 'mouse',
    }));
  }

  function soltarManoDerecha() {
    controlPorMano = false;
    moverCuadrado.ultimo = null;
    for (const dedo of dedosEstables) dedo.candidato = dedo.confirmado = null;
  }

  // Dedo levantado = capa prendida. Un dedo tiene que quedarse igual ANTIRREBOTE_DEDOS_MS para
  // contar, así no parpadean las capas al mover la mano
  function aplicarDedos(ahora) {
    const botones = document.querySelectorAll('#capas .capa');
    for (let i = 0; i < DEDOS_CAPAS; i++) {
      const dedo = dedosEstables[i];
      const levantado = estado.dedosLevantados[i];
      if (levantado !== dedo.candidato) {
        dedo.candidato = levantado;
        dedo.desde = ahora;
      }
      if (ahora - dedo.desde >= ANTIRREBOTE_DEDOS_MS) dedo.confirmado = dedo.candidato;
      const capa = botones[i];
      if (dedo.confirmado === null || !capa) continue;
      if ((capa.getAttribute('aria-pressed') === 'true') !== dedo.confirmado) capa.click();
    }
  }

  // Cada vuelta completa del puño izquierdo es una estación. Horario avanza, antihorario retrocede
  function aplicarGiro() {
    let paso = 0;
    while (estado.anguloTiempo - anguloReferencia >= GRADOS_POR_ESTACION) {
      anguloReferencia += GRADOS_POR_ESTACION;
      paso++;
    }
    while (estado.anguloTiempo - anguloReferencia <= -GRADOS_POR_ESTACION) {
      anguloReferencia -= GRADOS_POR_ESTACION;
      paso--;
    }
    if (paso !== 0) pasarEstacion(paso);
  }

  function pasarEstacion(paso) {
    const selector = document.getElementById('selector-estacion');
    if (!selector || selector.disabled || selector.options.length < 2) return;
    const total = selector.options.length;
    selector.selectedIndex = (((selector.selectedIndex + paso) % total) + total) % total;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function aplicarALaDemo() {
    if (!mapaVisible()) {
      if (controlPorMano) soltarManoDerecha();
      anguloReferencia = estado.anguloTiempo;
      return;
    }
    if (estado.manoDerechaActiva) {
      controlPorMano = true;
      moverCuadrado(estado.posX, estado.posY);
      aplicarDedos(performance.now());
    } else if (controlPorMano) {
      // Sin la mano las capas quedan como estaban y el mouse vuelve a mandar
      soltarManoDerecha();
    }
    aplicarGiro();
  }

  // 8. Dibujo del visor: video en grises, esqueletos, zona activa y eje del puño
  const BLANCO = '#ffffff';
  const GRIS = '#9a9a9a';

  function dibujar(derecha, izquierda) {
    const densidad = window.devicePixelRatio || 1;
    const anchoCss = visor.clientWidth || 220;
    const altoCss = Math.round((anchoCss * espejo.height) / espejo.width);
    if (visor.width !== Math.round(anchoCss * densidad) || visor.height !== Math.round(altoCss * densidad)) {
      visor.width = Math.round(anchoCss * densidad);
      visor.height = Math.round(altoCss * densidad);
    }
    const c = contextoVisor;
    const w = anchoCss;
    const h = altoCss;
    c.setTransform(densidad, 0, 0, densidad, 0, 0);
    c.filter = 'grayscale(1) contrast(1.1) brightness(0.8)';
    c.drawImage(espejo, 0, 0, w, h);
    c.filter = 'none';

    // Zona de la mano derecha que recorre todo el mapa
    const margen = 0.5 - 0.5 / SENSIBILIDAD;
    c.setLineDash([4, 3]);
    c.strokeStyle = BLANCO;
    c.lineWidth = 1;
    c.strokeRect(margen * w + 0.5, margen * h + 0.5, (1 - 2 * margen) * w, (1 - 2 * margen) * h);
    c.setLineDash([]);

    if (derecha) {
      dibujarEsqueleto(derecha, w, h, BLANCO, false);
      // Punto que mueve el cuadrado
      const p = derecha[9];
      c.fillStyle = '#000000';
      c.fillRect(p.x * w - 5, p.y * h - 5, 10, 10);
      c.strokeStyle = BLANCO;
      c.lineWidth = 2;
      c.strokeRect(p.x * w - 5, p.y * h - 5, 10, 10);
    }
    if (izquierda) {
      dibujarEsqueleto(izquierda, w, h, estado.punoIzquierdoActivo ? BLANCO : GRIS, !estado.punoIzquierdoActivo);
    }
    if (ejeIzq) {
      const color = estado.girandoActivamente ? BLANCO : GRIS;
      const cx = ejeIzq.cx * w;
      const cy = ejeIzq.cy * h;
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(cx, cy, RADIO_MINIMO * w, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(cx, cy, 3.5, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(ejeIzq.sx * w, ejeIzq.sy * h);
      c.stroke();
    }
  }

  function dibujarEsqueleto(lm, w, h, color, punteado) {
    const c = contextoVisor;
    c.lineCap = 'round';
    c.setLineDash(punteado ? [3, 3] : []);
    // Contorno negro debajo para que se lea sobre cualquier fondo
    for (const [trazo, ancho] of [['rgba(0,0,0,0.65)', 4], [color, 2]]) {
      c.strokeStyle = trazo;
      c.lineWidth = ancho;
      c.beginPath();
      for (const [a, b] of CONEXIONES) {
        c.moveTo(lm[a].x * w, lm[a].y * h);
        c.lineTo(lm[b].x * w, lm[b].y * h);
      }
      c.stroke();
    }
    c.setLineDash([]);
  }

  // 9. HUD: dedos de la derecha y giro de la izquierda. Se actualiza unas diez veces por segundo
  function mostrarHud() {
    if (cuadro++ % 3 !== 0) return;
    for (let i = 0; i < DEDOS_CAPAS; i++) {
      const confirmado = dedosEstables[i].confirmado;
      const arriba = estado.manoDerechaActiva && (confirmado === null ? estado.dedosLevantados[i] : confirmado);
      marcasDedos[i].classList.toggle('arriba', Boolean(arriba));
      marcasDedos[i].classList.toggle('sin-mano', !estado.manoDerechaActiva);
    }
    const grados = estado.anguloTiempo;
    const vueltas = grados / 360;
    const formato = (n, d) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    let texto;
    if (!estado.manoIzquierdaActiva) texto = 'Not in view';
    else if (!estado.punoIzquierdoActivo) texto = 'Open, make a fist';
    else texto = estado.girandoActivamente ? 'Fist, turning' : 'Fist, still';
    textoGiro.textContent = `${texto} · ${formato(grados, 0)}° · ${formato(vueltas, 2)} turns`;
    // Avance hacia la próxima estación, hacia un lado o el otro
    const avance = (grados - anguloReferencia) / GRADOS_POR_ESTACION;
    rellenoGiro.style.width = `${Math.round(Math.abs(avance) * 100)}%`;
    rellenoGiro.classList.toggle('atras', avance < 0);
  }

  window.addEventListener('pagehide', () => apagar());

  window.Manos = {
    encender,
    apagar,
    get estado() { return { ...estado, dedosLevantados: [...estado.dedosLevantados] }; },
  };
})();
