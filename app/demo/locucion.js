// Locución de presentación de cada río. Reproduce audios/<idioma>/<id>.mp3, voces neuronales
// pregrabadas con scripts/generar_voces.py. Si el mp3 no carga, dice el mismo texto (de
// audios/textos.js) con la síntesis de voz del navegador. Mientras habla, baja la orquesta y la
// devuelve al terminar. Usa un <audio> y no fetch, así que también anda desde file://.

(function () {
  const IDIOMAS = { es: 'es-AR', en: 'en-US' };
  const TEXTOS = (window.TEXTOS_LOCUCION && window.TEXTOS_LOCUCION.textos) || {};

  let audio = null;
  let pedido = 0; // cada locución nueva o detener() invalida las anteriores
  let ultima = null; // { rioId, idioma } de la última locución pedida, para repetir

  const atenuar = (activo) => {
    if (window.Sonido && window.Sonido.atenuar) window.Sonido.atenuar(activo);
  };

  function detener() {
    pedido++;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    atenuar(false);
  }

  // Plan B, la voz del navegador con el mismo texto
  function hablarConElNavegador(rioId, idioma, miPedido) {
    const texto = TEXTOS[idioma] && TEXTOS[idioma][rioId];
    if (!texto || !window.speechSynthesis || miPedido !== pedido) {
      atenuar(false);
      return;
    }
    const enunciado = new SpeechSynthesisUtterance(texto);
    enunciado.lang = IDIOMAS[idioma];
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang === IDIOMAS[idioma])
      || window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(idioma));
    if (voz) enunciado.voice = voz;
    const terminar = () => { if (miPedido === pedido) atenuar(false); };
    enunciado.onend = terminar;
    enunciado.onerror = terminar;
    atenuar(true);
    window.speechSynthesis.speak(enunciado);
  }

  // Corta lo que esté sonando y presenta el río. Devuelve una promesa que se resuelve cuando arranca
  // (o cuando no pudo, por ejemplo si el navegador todavía no deja sonar sin un clic).
  function reproducirPresentacionRio(rioId, idioma) {
    if (!IDIOMAS[idioma]) idioma = 'es';
    detener();
    const miPedido = pedido;
    ultima = { rioId, idioma };

    let fallo = false;
    const pasarAlNavegador = () => {
      if (fallo || miPedido !== pedido) return;
      fallo = true;
      audio = null;
      hablarConElNavegador(rioId, idioma, miPedido);
    };

    audio = new Audio(`audios/${idioma}/${rioId}.mp3`);
    audio.preload = 'auto';
    audio.onended = () => { if (miPedido === pedido) atenuar(false); };
    audio.onerror = pasarAlNavegador;
    atenuar(true);
    return audio.play().catch((error) => {
      if (miPedido !== pedido) return;
      // Sin un gesto del usuario el navegador no deja sonar nada, tampoco la voz del navegador
      if (error && error.name === 'NotAllowedError') {
        atenuar(false);
        return;
      }
      pasarAlNavegador();
    });
  }

  function repetir() {
    if (ultima) return reproducirPresentacionRio(ultima.rioId, ultima.idioma);
    return Promise.resolve();
  }

  // Al cerrar o esconder la pestaña no sigue hablando
  window.addEventListener('pagehide', detener);

  window.Locucion = { reproducirPresentacionRio, detener, repetir, idiomas: Object.keys(IDIOMAS) };
  window.reproducirPresentacionRio = reproducirPresentacionRio;
})();
