// Locuciones. Reproduce voces neuronales pregrabadas con los scripts de voces:
//   - la presentación de cada río, audios/<idioma>/<id>.mp3 (scripts/generar_voces.py)
//   - las de la interfaz (navegación por voz, tutorial), audios/<idioma>/ui/<id>.mp3 (scripts/generar_voces_ui.py)
// Si un mp3 no carga, dice el mismo texto (de audios/textos.js) con la síntesis de voz del navegador.
// Una locución nueva corta la anterior. Mientras habla, baja la orquesta y la devuelve al terminar, y
// avisa con el evento "locucion" de window (detail.hablando), así voz.js no escucha mientras habla.
// Usa un <audio> y no fetch, así que también anda desde file://.

(function () {
  const IDIOMAS = { es: 'es-AR', en: 'en-US' };
  const TEXTOS = (window.TEXTOS_LOCUCION && window.TEXTOS_LOCUCION.textos) || {};
  const TEXTOS_UI = (window.TEXTOS_LOCUCION && window.TEXTOS_LOCUCION.ui) || {};

  let audio = null;
  let pedido = 0; // cada locución nueva o detener() invalida las anteriores
  let ultima = null; // { rioId, idioma } de la última presentación de río, para repetir
  let hablando = false;

  const atenuar = (activo) => {
    if (window.Sonido && window.Sonido.atenuar) window.Sonido.atenuar(activo);
    if (activo === hablando) return;
    hablando = activo;
    window.dispatchEvent(new CustomEvent('locucion', { detail: { hablando } }));
  };

  function soltarAudio() {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
  }

  function detener() {
    pedido++;
    soltarAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    atenuar(false);
  }

  // Plan B, la voz del navegador con el mismo texto
  function hablarConElNavegador(texto, idioma, miPedido, alTerminar) {
    if (!texto || !window.speechSynthesis || miPedido !== pedido) {
      alTerminar();
      return;
    }
    const enunciado = new SpeechSynthesisUtterance(texto);
    enunciado.lang = IDIOMAS[idioma];
    const voces = window.speechSynthesis.getVoices();
    const voz = voces.find((v) => v.lang === IDIOMAS[idioma]) || voces.find((v) => v.lang.startsWith(idioma));
    if (voz) enunciado.voice = voz;
    enunciado.onend = alTerminar;
    enunciado.onerror = alTerminar;
    window.speechSynthesis.speak(enunciado);
  }

  // Reproduce un mp3 (o su texto con la voz del navegador) y llama a alTerminar cuando termina o
  // falla, salvo que otra locución lo haya cortado. Devuelve una promesa que se resuelve al arrancar:
  // false si el navegador no deja sonar todavía (falta un clic o una tecla), true si no.
  function reproducir(ruta, texto, idioma, miPedido, alTerminar) {
    let fallo = false;
    const terminar = () => { if (miPedido === pedido) alTerminar(); };
    const pasarAlNavegador = () => {
      if (fallo || miPedido !== pedido) return;
      fallo = true;
      audio = null;
      hablarConElNavegador(texto, idioma, miPedido, terminar);
    };
    audio = new Audio(ruta);
    audio.preload = 'auto';
    audio.onended = terminar;
    audio.onerror = pasarAlNavegador;
    return audio.play().then(() => true, (error) => {
      if (miPedido !== pedido) return true;
      // Sin un gesto del usuario el navegador no deja sonar nada, tampoco la voz del navegador
      if (error && error.name === 'NotAllowedError') {
        atenuar(false);
        return false;
      }
      pasarAlNavegador();
      return true;
    });
  }

  // Corta lo que esté sonando y presenta el río. Devuelve una promesa que se resuelve cuando arranca
  // (o cuando no pudo, por ejemplo si el navegador todavía no deja sonar sin un clic).
  function reproducirPresentacionRio(rioId, idioma) {
    if (!IDIOMAS[idioma]) idioma = 'es';
    detener();
    const miPedido = pedido;
    ultima = { rioId, idioma };
    atenuar(true);
    const texto = TEXTOS[idioma] && TEXTOS[idioma][rioId];
    return reproducir(`audios/${idioma}/${rioId}.mp3`, texto, idioma, miPedido, () => atenuar(false));
  }

  // Corta lo que esté sonando y dice una locución de la interfaz, o varias seguidas (un arreglo de
  // ids, por ejemplo para resumir el estado). No cambia lo que repite repetir(). La promesa se
  // resuelve al arrancar, con false si el navegador todavía no deja sonar.
  function decir(ids, idioma = 'en') {
    if (!IDIOMAS[idioma]) idioma = 'en';
    const lista = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    detener();
    if (lista.length === 0) return Promise.resolve();
    const miPedido = pedido;
    atenuar(true);
    const siguiente = (indice) => {
      if (miPedido !== pedido) return Promise.resolve();
      if (indice >= lista.length) {
        atenuar(false);
        return Promise.resolve();
      }
      const id = lista[indice];
      const texto = TEXTOS_UI[idioma] && TEXTOS_UI[idioma][id];
      return reproducir(`audios/${idioma}/ui/${id}.mp3`, texto, idioma, miPedido, () => siguiente(indice + 1));
    };
    return siguiente(0);
  }

  function repetir() {
    if (ultima) return reproducirPresentacionRio(ultima.rioId, ultima.idioma);
    return Promise.resolve();
  }

  // Al cerrar o esconder la pestaña no sigue hablando
  window.addEventListener('pagehide', detener);

  window.Locucion = {
    reproducirPresentacionRio,
    decir,
    detener,
    repetir,
    get hablando() { return hablando; },
    idiomas: Object.keys(IDIOMAS),
  };
  window.reproducirPresentacionRio = reproducirPresentacionRio;
})();
