// Comandos de voz. Escucha con la Web Speech API del navegador (Chrome y Edge; en Chrome el audio
// lo procesa Google, en Edge Microsoft), entiende la frase con voz_intenciones.js y llama a las
// mismas funciones que las teclas (App.ir de app.js y Tablero.acciones de demo.js).
//
// Al abrir la página en la bienvenida pide apretar la C para prender la cámara (clip "inicio") y
// pide el permiso del micrófono (sección 7). Recién con la cámara prendida dice que hay que decir
// "next" (clip "camara_activada"): de la bienvenida no se sale sin la cámara (app.js). El "next" de la
// bienvenida lleva al tutorial (tutorial.js), que habla solo; ahí next, back, repeat y skip lo manejan.
//
// Cómo se activa:
//   - Barra espaciadora apretada: escucha mientras está apretada y actúa al soltarla. Un toque
//     corto (menos de MINIMO_APRETADO_MS) no hace nada. Mientras escucha, la orquesta casi se apaga.
//   - Clic en la pestaña del micrófono del menú: escucha una frase.
//   - Botón "Activate your microphone": además, en la bienvenida y en el menú escucha sin tecla
//     (manos libres), salvo mientras habla una locución, para no oírse a sí mismo.
//
// Solo los comandos hablados reciben respuesta hablada ("Width off", "Winter"...): las teclas no.
// Las respuestas son mp3 de audios/en/ui/ (scripts/generar_voces_ui.py), por Locucion.decir().

(function () {
  const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
  const IDIOMA = 'en';
  const LANG = 'en-US';
  const MINIMO_APRETADO_MS = 250;
  const COLA_MS = 200; // al soltar la tecla sigue escuchando un poco, para no cortar la última sílaba
  const ATENUACION_ESCUCHA = 0.03;
  const PAUSA_MANOS_LIBRES_MS = 400;
  const VIGENCIA_PREGUNTA_MS = 20000;
  const VISTAS_MANOS_LIBRES = ['bienvenida', 'tutorial', 'rios'];

  const botonMicrofono = document.querySelector('.boton-microfono');
  const textoMicrofono = botonMicrofono ? botonMicrofono.querySelector('.texto-microfono') : null;
  const pestanaVoz = document.querySelector('.pestana-voz');
  const indicador = document.getElementById('voz-indicador');
  const textoIndicador = document.getElementById('voz-texto');

  let sesion = null; // { rec, modo: 'tecla' | 'clic' | 'libre', finales, inicio, abortada, error }
  let manosLibres = false;
  let teclaApretada = false;
  let pendiente = null; // { accion, hasta } esperando sí o no
  let esperaManosLibres = null;

  const decir = (ids) => window.Locucion.decir(ids, IDIOMA);

  // 1. Sonidos cortos: empieza a escuchar, terminó, error. Con su propio contexto de audio, porque
  // en la bienvenida la orquesta todavía no arrancó.
  let contextoEarcon = null;
  function earcon(tipo) {
    const notas = { inicio: [660, 880], fin: [880, 660], error: [330, 247] }[tipo];
    try {
      contextoEarcon = contextoEarcon || new (window.AudioContext || window.webkitAudioContext)();
      if (contextoEarcon.state === 'suspended') contextoEarcon.resume();
      notas.forEach((frecuencia, indice) => {
        const oscilador = contextoEarcon.createOscillator();
        const ganancia = contextoEarcon.createGain();
        const t = contextoEarcon.currentTime + indice * 0.09;
        oscilador.type = 'sine';
        oscilador.frequency.value = frecuencia;
        ganancia.gain.setValueAtTime(0, t);
        ganancia.gain.linearRampToValueAtTime(0.18, t + 0.01);
        ganancia.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        oscilador.connect(ganancia).connect(contextoEarcon.destination);
        oscilador.start(t);
        oscilador.stop(t + 0.14);
      });
    } catch (error) {
      // Sin audio no hay sonido de aviso; el indicador en pantalla sigue andando
    }
  }

  // 2. Indicador en pantalla
  function mostrarIndicador(texto, estado) {
    if (!indicador) return;
    indicador.hidden = !texto;
    indicador.dataset.estado = estado || '';
    textoIndicador.textContent = texto || '';
    if (pestanaVoz) pestanaVoz.classList.toggle('escuchando', estado === 'escuchando');
  }

  const atenuarParaEscuchar = (activo) => {
    if (window.Sonido && window.Sonido.atenuar) window.Sonido.atenuar(activo, 'escucha', ATENUACION_ESCUCHA);
  };

  // 3. Una sesión de reconocimiento
  function escuchar(modo) {
    if (!Reconocimiento) {
      if (modo !== 'libre') decir('error_sin_reconocimiento');
      return;
    }
    cancelarSesion();
    const rec = new Reconocimiento();
    rec.lang = LANG;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.continuous = modo === 'tecla'; // con la tecla, una pausa al hablar no corta
    const s = { rec, modo, finales: [], inicio: performance.now(), abortada: false, error: null };

    rec.onresult = (evento) => {
      const finales = [];
      let parcial = '';
      for (let i = 0; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        if (resultado.isFinal) finales.push(Array.from(resultado, (alternativa) => alternativa.transcript.trim()));
        else parcial += resultado[0].transcript;
      }
      s.finales = finales;
      const dicho = `${finales.map((f) => f[0]).join(' ')} ${parcial}`.trim();
      if (modo !== 'libre' || dicho) mostrarIndicador(dicho ? `“${dicho}”` : 'Listening…', 'escuchando');
      // Sin tecla, una frase alcanza
      if (modo !== 'tecla' && finales.length) rec.stop();
    };
    rec.onerror = (evento) => { s.error = evento.error; };
    rec.onend = () => {
      if (s.alCerrar) s.alCerrar();
      if (sesion === s) sesion = null;
      // Una sesión con la tecla que Chrome cortó al arrancar ("aborted" sin que la app la cortara)
      // se vuelve a abrir si la tecla sigue apretada
      if (!s.abortada && s.error === 'aborted' && s.modo === 'tecla' && teclaApretada && !s.reintentada) {
        escuchar('tecla');
        if (sesion) sesion.reintentada = true;
        return;
      }
      terminar(s);
    };

    if (modo !== 'libre') {
      window.Locucion.detener();
      atenuarParaEscuchar(true);
      earcon('inicio');
      mostrarIndicador('Listening…', 'escuchando');
    }
    sesion = s;
    // Chrome admite una sola sesión de reconocimiento por página: si la anterior (por ejemplo la de
    // manos libres que se acaba de cortar) todavía no terminó, la nueva no arranca o termina enseguida
    // con "aborted". Se espera a que la anterior cierre, con un tope, y si el arranque falla se
    // reintenta una vez.
    const arrancar = (intento) => {
      if (sesion !== s || s.abortada) return;
      try {
        rec.start();
        s.arranco = true;
        if (s.pararAlArrancar) setTimeout(() => { try { rec.stop(); } catch (error) { /* ya terminó */ } }, COLA_MS);
      } catch (error) {
        if (intento === 0) {
          setTimeout(() => arrancar(1), 250);
          return;
        }
        console.warn('Comandos de voz: no arrancó el reconocimiento', error);
        sesion = null;
        atenuarParaEscuchar(false);
        mostrarError('could not start listening, try again');
      }
    };
    const anterior = cierrePendiente;
    if (!anterior) arrancar(0);
    else Promise.race([anterior, new Promise((r) => setTimeout(r, 400))]).then(() => arrancar(0));
  }

  // Se resuelve cuando la última sesión cortada termina de verdad (su onend)
  let cierrePendiente = null;

  function cancelarSesion() {
    if (!sesion) return;
    const s = sesion;
    sesion = null;
    s.abortada = true;
    if (s.arranco) {
      const cierre = new Promise((resolver) => { s.alCerrar = resolver; });
      cierrePendiente = cierre;
      cierre.then(() => { if (cierrePendiente === cierre) cierrePendiente = null; });
      try { s.rec.abort(); } catch (error) { if (s.alCerrar) s.alCerrar(); }
    }
    atenuarParaEscuchar(false);
  }

  // El error queda escrito unos segundos en el indicador, además de la respuesta hablada
  function mostrarError(texto) {
    mostrarIndicador(`Voice: ${texto}`, 'error');
    setTimeout(() => {
      if (!sesion && indicador && indicador.dataset.estado === 'error') mostrarIndicador('');
    }, 5000);
  }

  // Las alternativas del reconocedor, de la más probable a la menos
  function alternativasDe(finales) {
    if (finales.length === 0) return [];
    if (finales.length === 1) return finales[0];
    // Varias frases con la tecla apretada: todo junto, y también solo la última
    return [finales.map((f) => f[0]).join(' '), ...finales[finales.length - 1]];
  }

  function terminar(s) {
    const verboso = s.modo !== 'libre';
    // Una sesión cortada puede terminar cuando ya empezó otra: no le toca el indicador ni la orquesta
    if (s.abortada) {
      if (!sesion) {
        mostrarIndicador('');
        sincronizarManosLibres();
      }
      return;
    }
    if (verboso && !sesion) atenuarParaEscuchar(false);
    if (s.error && s.error !== 'no-speech' && s.error !== 'aborted') {
      mostrarIndicador('');
      manejarError(s.error, verboso);
      return;
    }
    const alternativas = alternativasDe(s.finales);
    if (alternativas.length === 0) {
      mostrarIndicador('');
      if (verboso) {
        earcon('error');
        decir('error_no_entendi');
      }
      sincronizarManosLibres();
      return;
    }
    procesar(alternativas, verboso);
    sincronizarManosLibres();
  }

  function manejarError(error, verboso) {
    const clip = {
      'not-allowed': 'error_permiso',
      'service-not-allowed': 'error_permiso',
      'audio-capture': 'error_sin_mic',
      network: 'error_red',
      'language-not-supported': 'error_sin_reconocimiento',
    }[error];
    console.warn(`Comandos de voz: ${error}`);
    const motivos = {
      'not-allowed': 'the microphone is blocked, allow it in the browser',
      'service-not-allowed': 'the browser does not allow speech recognition here',
      'audio-capture': 'no microphone found',
      network: 'the speech service did not answer, check your internet connection',
      'language-not-supported': 'this browser cannot recognize English',
    };
    mostrarError(motivos[error] || error);
    // Sin manos libres si el error se repetiría en cada intento
    if (manosLibres) desactivarManosLibres();
    if (verboso || clip) {
      earcon('error');
      decir(clip || 'error_no_entendi');
    }
  }

  // 4. De la frase a la acción
  function procesar(alternativas, verboso) {
    const vista = window.App.vista;
    const conPregunta = Boolean(pendiente && performance.now() < pendiente.hasta);
    const resultado = window.VozIntenciones.interpretar(alternativas, {
      vista,
      pendiente: conPregunta,
      ordenRios: window.App.rios.map((rio) => rio.id),
    });
    console.debug('Comandos de voz', alternativas, resultado);
    mostrarIndicador(`“${alternativas[0]}”`, resultado.intencion ? 'entendido' : 'error');
    setTimeout(() => { if (!sesion) mostrarIndicador(''); }, 1800);

    if (conPregunta) {
      const accion = pendiente.accion;
      pendiente = null;
      if (resultado.intencion === 'YES') {
        ejecutar(accion);
        return;
      }
      if (resultado.intencion === 'NO') {
        decir('cancelado');
        return;
      }
    }
    pendiente = null;

    if (!resultado.intencion) {
      // Sin tecla, lo que no se entiende se ignora: puede ser una charla cerca del micrófono
      if (verboso) {
        earcon('error');
        decir('error_no_entendi');
      }
      return;
    }
    if (!window.VozIntenciones.disponible(resultado.intencion, vista)) {
      if (verboso) decir('error_no_disponible');
      return;
    }
    if (resultado.confirmar) {
      pendiente = { accion: resultado, hasta: performance.now() + VIGENCIA_PREGUNTA_MS };
      decir(`confirmar_${resultado.parametros.id}`);
      return;
    }
    ejecutar(resultado);
  }

  // Arranca la orquesta si hace falta. false si todavía no se puede.
  async function asegurarInicio() {
    const acciones = window.Tablero.acciones;
    if (acciones.iniciado) return true;
    if (!acciones.orquestaLista) {
      decir('error_cargando');
      return false;
    }
    await acciones.iniciar();
    return acciones.iniciado;
  }

  const CLIP_AYUDA = { bienvenida: 'vista_bienvenida', rios: 'vista_menu' };
  const ACCIONES_TABLERO = ['SET_LAYER', 'SET_SEASON', 'SET_SCALE', 'SET_MUSIC', 'REPEAT_INTRO', 'ZOOM', 'STATUS'];

  async function ejecutar({ intencion, parametros }) {
    const app = window.App;
    const vista = app.vista;
    const acciones = window.Tablero.acciones;
    const tutorial = window.Tutorial;

    if (vista === 'tutorial' && tutorial) {
      switch (intencion) {
        case 'NEXT': tutorial.siguiente(true); return;
        case 'BACK': tutorial.anterior(); return;
        case 'REPEAT_INTRO':
        case 'HELP': tutorial.repetir(); return;
        case 'SKIP': tutorial.saltar(true); return;
        case 'TUTORIAL': tutorial.abrir(); return;
        default: break; // el resto (ríos, inicio, stop) como en las demás vistas
      }
    }
    if (intencion === 'TUTORIAL') {
      app.ir('tutorial'); // desde la bienvenida sin cámara no pasa: pide la cámara
      return;
    }

    if (ACCIONES_TABLERO.includes(intencion) && !acciones.iniciado) {
      // Si la orquesta arranca ahora suena la presentación del río; la confirmación la cortaría
      if (await asegurarInicio()) ejecutarEnTablero(intencion, parametros, false);
      return;
    }
    switch (intencion) {
      case 'NEXT':
        if (vista === 'bienvenida') {
          app.ir('tutorial'); // el tutorial dice su primera nota de voz
        } else if (vista === 'rio' && !acciones.iniciado) {
          await asegurarInicio();
        } else {
          decir('error_no_disponible');
        }
        return;
      case 'BACK':
        if (vista === 'rio') {
          app.ir('rios');
          decir('volver_menu');
        } else if (vista === 'rios') {
          app.ir('bienvenida');
          decir('volver_inicio');
        }
        return;
      case 'GO_HOME':
        app.ir('bienvenida');
        decir('volver_inicio');
        return;
      case 'LIST_RIVERS':
        if (vista !== 'rios' && !app.ir('rios')) return;
        decir('vista_menu');
        return;
      case 'OPEN_RIVER': {
        const actual = vista === 'rio' && location.hash === `#rio/${parametros.id}`;
        if (vista === 'bienvenida' && !app.camaraLista) {
          app.ir('rios'); // no pasa: pide la cámara
          return;
        }
        if (actual) acciones.repetirPresentacion();
        else app.ir(`rio/${parametros.id}`, vista === 'rio');
        return;
      }
      case 'HELP':
        if (vista === 'bienvenida') {
          decir(['vista_bienvenida', app.camaraLista ? 'decir_next' : 'camara_pedir']);
          return;
        }
        decir(CLIP_AYUDA[vista] || (acciones.iniciado ? 'vista_tablero_comandos' : 'vista_tablero_portada'));
        return;
      case 'STOP':
        window.Locucion.detener();
        return;
      default:
        ejecutarEnTablero(intencion, parametros, true);
    }
  }

  const NOMBRE_CAPA = { 1: 'width', 2: 'level', 3: 'slope', 4: 'range' };

  function ejecutarEnTablero(intencion, parametros, responder) {
    const acciones = window.Tablero.acciones;
    let clip = null;
    switch (intencion) {
      case 'SET_LAYER': {
        const prendida = acciones.fijarCapa(parametros.capa, parametros.estado);
        clip = `capa_${NOMBRE_CAPA[parametros.capa]}_${prendida ? 'on' : 'off'}`;
        break;
      }
      case 'SET_SEASON':
        clip = acciones.fijarEstacion(parametros.estacion) ? `estacion_${parametros.estacion}` : 'error_sin_estacion';
        break;
      case 'SET_SCALE':
        clip = `escala_${acciones.fijarNormalizacion(parametros.modo)}`;
        break;
      case 'SET_MUSIC':
        clip = `musica_${acciones.fijarMusica(parametros.modo)}`;
        break;
      case 'ZOOM':
        acciones.zoom(parametros.direccion);
        clip = `zoom_${parametros.direccion}`;
        break;
      case 'REPEAT_INTRO':
        acciones.repetirPresentacion();
        return;
      case 'STATUS': {
        const estado = acciones.estado();
        clip = [
          ...estado.capas.map((capa) => `capa_${NOMBRE_CAPA[capa.numero]}_${capa.activa ? 'on' : 'off'}`),
          estado.estacion ? `estacion_${estado.estacion}` : null,
          `escala_${estado.normalizacion}`,
          `musica_${estado.musica}`,
        ];
        break;
      }
      default:
        return;
    }
    if (responder && clip) decir(clip);
  }

  // 5. Manos libres en la bienvenida y el menú
  function sincronizarManosLibres() {
    const deberia = manosLibres && Reconocimiento && !teclaApretada && !window.Locucion.hablando
      && VISTAS_MANOS_LIBRES.includes(window.App.vista) && document.visibilityState === 'visible';
    clearTimeout(esperaManosLibres);
    if (!deberia) {
      if (sesion && sesion.modo === 'libre') cancelarSesion();
      return;
    }
    if (sesion) return;
    esperaManosLibres = setTimeout(() => {
      if (!sesion && manosLibres && !window.Locucion.hablando && !teclaApretada) escuchar('libre');
    }, PAUSA_MANOS_LIBRES_MS);
  }

  async function activarManosLibres() {
    if (!Reconocimiento) {
      decir('error_sin_reconocimiento');
      return;
    }
    // Pide el permiso del micrófono ahora, con el clic, y no en medio del primer comando
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      flujo.getTracks().forEach((pista) => pista.stop());
    } catch (error) {
      decir(error && error.name === 'NotFoundError' ? 'error_sin_mic' : 'error_permiso');
      return;
    }
    manosLibres = true;
    if (botonMicrofono) {
      botonMicrofono.setAttribute('aria-pressed', 'true');
      if (textoMicrofono) textoMicrofono.textContent = 'Microphone on';
    }
    decir('mic_activado'); // al terminar de hablar empieza a escuchar
  }

  function desactivarManosLibres() {
    manosLibres = false;
    if (botonMicrofono) {
      botonMicrofono.setAttribute('aria-pressed', 'false');
      if (textoMicrofono) textoMicrofono.textContent = 'Activate your microphone';
    }
    sincronizarManosLibres();
  }

  // 6. Entrada
  const esEspacio = (evento) => evento.code === 'Space' || evento.key === ' ';
  const esCampoDeTexto = (elemento) => elemento && (elemento.isContentEditable
    || (elemento.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'range'].includes(elemento.type))
    || elemento.tagName === 'TEXTAREA');

  // En la fase de captura, así ni app.js ni demo.js ven el Espacio (y un botón con foco no se activa)
  window.addEventListener('keydown', (evento) => {
    if (!esEspacio(evento) || evento.ctrlKey || evento.metaKey || evento.altKey || esCampoDeTexto(evento.target)) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    if (evento.repeat || teclaApretada) return;
    teclaApretada = true;
    introPendiente = false; // ya sabe cómo hablar
    escuchar('tecla');
  }, true);

  function soltarTecla() {
    if (!teclaApretada) return;
    teclaApretada = false;
    const s = sesion;
    if (!s || s.modo !== 'tecla') {
      sincronizarManosLibres();
      return;
    }
    if (performance.now() - s.inicio < MINIMO_APRETADO_MS) {
      cancelarSesion();
      mostrarIndicador('');
      sincronizarManosLibres();
      return;
    }
    earcon('fin');
    setTimeout(() => {
      // Si todavía espera a que cierre la sesión anterior, se detiene apenas arranque
      if (!s.arranco) s.pararAlArrancar = true;
      else try { s.rec.stop(); } catch (error) { /* ya terminó */ }
    }, COLA_MS);
  }

  window.addEventListener('keyup', (evento) => {
    if (!esEspacio(evento) || !teclaApretada) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    soltarTecla();
  }, true);
  // Si la ventana pierde el foco con la tecla apretada, el keyup no llega
  window.addEventListener('blur', soltarTecla);

  if (botonMicrofono) {
    botonMicrofono.addEventListener('click', () => {
      if (manosLibres) desactivarManosLibres();
      else activarManosLibres();
    });
  }
  if (pestanaVoz) pestanaVoz.addEventListener('click', () => escuchar('clic'));

  // 7. Al abrir la página: en la bienvenida dice cómo hablar (clip "inicio") y, a la vez, pide el
  // permiso del micrófono, así la ventana de Chrome aparece enseguida y no en medio del primer
  // comando. Chrome no deja sonar nada hasta el primer clic o tecla, salvo en sitios que la persona
  // ya visitó seguido; si bloquea el audio, se vuelve a intentar al aceptar el micrófono y, si
  // sigue bloqueado, con el primer clic o tecla.
  let introPendiente = false;

  // Al cargar, app.js todavía no mostró ninguna vista (espera la lista de ríos): sale de la dirección
  const enBienvenida = () => (window.App.vista ? window.App.vista === 'bienvenida' : !location.hash.replace(/^#/, ''));

  async function decirInicio() {
    // Si ya apretó la C, lo que suena es la respuesta de la cámara (sección 8)
    if (!enBienvenida() || sesion || teclaApretada || (window.Manos && window.Manos.encendida)) return true;
    return (await decir('inicio')) !== false;
  }

  function esperarPrimerGesto() {
    const alGesto = () => {
      window.removeEventListener('pointerdown', alGesto, true);
      window.removeEventListener('keydown', alGesto, true);
      // Después de que app.js procese la tecla o el clic, por si cambió de vista
      setTimeout(() => {
        if (!introPendiente) return;
        introPendiente = false;
        if (!window.Locucion.hablando) decirInicio();
      }, 0);
    };
    window.addEventListener('pointerdown', alGesto, true);
    window.addEventListener('keydown', alGesto, true);
  }

  async function pedirMicrofono() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'sin_mic';
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      flujo.getTracks().forEach((pista) => pista.stop());
      return 'ok';
    } catch (error) {
      return error && error.name === 'NotFoundError' ? 'sin_mic' : 'denegado';
    }
  }

  async function alAbrir() {
    if (!Reconocimiento) {
      if ((await decir('error_sin_reconocimiento')) === false) esperarPrimerGesto();
      return;
    }
    mostrarIndicador('Hold Space and speak', 'pista');
    setTimeout(() => { if (!sesion && indicador && indicador.dataset.estado === 'pista') mostrarIndicador(''); }, 8000);
    if (!(await decirInicio())) {
      introPendiente = true;
      esperarPrimerGesto();
    }
    const permiso = await pedirMicrofono();
    if (permiso !== 'ok') {
      // Si el audio sigue bloqueado no se oye; el error vuelve a sonar al apretar el Espacio
      if (!sesion) decir(permiso === 'sin_mic' ? 'error_sin_mic' : 'error_permiso');
      return;
    }
    // Aceptar el permiso a veces alcanza para que Chrome deje sonar
    if (introPendiente && !sesion && !window.Locucion.hablando && (await decirInicio())) introPendiente = false;
  }

  // 8. La cámara (manos.js). En la bienvenida, al prenderse pide el "next", y si falla dice por qué
  // Habla cuando el sonido de ambiente de la carga (ambiente.js) ya se apagó: el silencio es la señal
  // de que la cámara cargó, y la voz lo confirma
  window.addEventListener('camara', async (evento) => {
    const { estado, error } = evento.detail;
    if (window.App.vista !== 'bienvenida') return;
    if (estado === 'prendiendo') {
      introPendiente = false;
      return;
    }
    if (window.Ambiente) await window.Ambiente.alTerminar();
    if (window.App.vista !== 'bienvenida' || (window.Manos && window.Manos.activa !== (estado === 'prendida'))) return;
    if (estado === 'prendida') {
      decir('camara_activada');
    } else if (estado === 'error') {
      decir(error === 'permiso' ? 'camara_error_permiso' : error === 'sin_camara' ? 'camara_error_sin_camara' : 'camara_error');
    }
  });

  window.addEventListener('locucion', sincronizarManosLibres);
  window.addEventListener('hashchange', sincronizarManosLibres);
  window.addEventListener('popstate', sincronizarManosLibres);
  document.addEventListener('visibilitychange', sincronizarManosLibres);

  alAbrir();

  window.Voz = {
    disponible: Boolean(Reconocimiento),
    escuchar: () => escuchar('clic'),
    activarManosLibres,
    desactivarManosLibres,
    // Para probar sin micrófono desde la consola: Voz.probar('go to the parana river')
    probar(texto) {
      procesar([texto], true);
    },
  };
})();
