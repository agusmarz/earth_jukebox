// Sonido de ambiente mientras carga la cámara del control con las manos (manos.js). Arranca cuando
// la cámara empieza a prenderse y se apaga cuando ya manda cuadros, o si falla: así una persona que
// no ve la pantalla sabe que tiene que esperar y cuándo terminó. La nota de voz "inicio" lo explica.
//
// Es agua sintetizada con Web Audio, sin archivos: ruido marrón por un filtro pasabajos que respira
// despacio, más un pasabanda que se mueve al azar como un arroyo, y un acorde muy suave de fondo.
// Usa su propio contexto de audio, porque en la bienvenida la orquesta todavía no arrancó.

(function () {
  const VOLUMEN = 0.16;
  const ENTRADA_S = 0.8;
  const SALIDA_S = 0.9;
  const MINIMO_MS = 1200; // si la cámara prende al toque, igual se llega a oír

  let contexto = null;
  let sonando = null; // { salida, fuentes, temporizador, inicio }
  let esperaApagar = null;
  // Se resuelve cuando el sonido terminó de apagarse (ya en silencio)
  let fin = Promise.resolve();
  let avisarFin = () => {};

  function ruidoMarron(ctx, segundos) {
    const largo = Math.floor(ctx.sampleRate * segundos);
    const buffer = ctx.createBuffer(2, largo, ctx.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const datos = buffer.getChannelData(canal);
      let ultimo = 0;
      for (let i = 0; i < largo; i++) {
        ultimo = (ultimo + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        datos[i] = ultimo * 3.5;
      }
    }
    return buffer;
  }

  function prender() {
    clearTimeout(esperaApagar);
    if (sonando) return;
    fin = new Promise((resolver) => { avisarFin = resolver; });
    try {
      contexto = contexto || new (window.AudioContext || window.webkitAudioContext)();
      if (contexto.state === 'suspended') contexto.resume();
    } catch (error) {
      avisarFin();
      return; // sin audio, solo queda la pestaña de la pantalla
    }
    const ctx = contexto;
    const t = ctx.currentTime;
    const salida = ctx.createGain();
    salida.gain.setValueAtTime(0, t);
    salida.gain.linearRampToValueAtTime(VOLUMEN, t + ENTRADA_S);
    salida.connect(ctx.destination);
    const fuentes = [];

    // Agua: ruido marrón, pasabajos que respira y pasabanda que salta como un arroyo
    const ruido = ctx.createBufferSource();
    ruido.buffer = ruidoMarron(ctx, 4);
    ruido.loop = true;
    const pasabajos = ctx.createBiquadFilter();
    pasabajos.type = 'lowpass';
    pasabajos.frequency.value = 700;
    const respiro = ctx.createOscillator();
    const hondo = ctx.createGain();
    respiro.frequency.value = 0.09;
    hondo.gain.value = 250;
    respiro.connect(hondo).connect(pasabajos.frequency);
    const arroyo = ctx.createBiquadFilter();
    arroyo.type = 'bandpass';
    arroyo.frequency.value = 900;
    arroyo.Q.value = 2.5;
    const gananciaArroyo = ctx.createGain();
    gananciaArroyo.gain.value = 0.35;
    ruido.connect(pasabajos).connect(salida);
    ruido.connect(arroyo).connect(gananciaArroyo).connect(salida);
    fuentes.push(ruido, respiro);

    // Acorde de fondo, la y mi graves, casi imperceptible
    for (const [frecuencia, ganancia] of [[110, 0.05], [164.81, 0.035], [220, 0.02]]) {
      const oscilador = ctx.createOscillator();
      const g = ctx.createGain();
      oscilador.type = 'sine';
      oscilador.frequency.value = frecuencia;
      g.gain.value = ganancia;
      oscilador.connect(g).connect(salida);
      fuentes.push(oscilador);
    }

    for (const fuente of fuentes) fuente.start(t);
    const temporizador = setInterval(() => {
      const ahora = ctx.currentTime;
      arroyo.frequency.setTargetAtTime(500 + Math.random() * 1100, ahora, 0.25);
      gananciaArroyo.gain.setTargetAtTime(0.2 + Math.random() * 0.3, ahora, 0.3);
    }, 350);
    sonando = { salida, fuentes, temporizador, inicio: performance.now() };
  }

  function apagar() {
    if (!sonando) return;
    const resta = MINIMO_MS - (performance.now() - sonando.inicio);
    if (resta > 0) {
      clearTimeout(esperaApagar);
      esperaApagar = setTimeout(apagar, resta);
      return;
    }
    const { salida, fuentes, temporizador } = sonando;
    sonando = null;
    clearInterval(temporizador);
    const t = contexto.currentTime;
    salida.gain.cancelScheduledValues(t);
    salida.gain.setValueAtTime(salida.gain.value, t);
    salida.gain.linearRampToValueAtTime(0, t + SALIDA_S);
    for (const fuente of fuentes) fuente.stop(t + SALIDA_S + 0.05);
    const avisar = avisarFin;
    setTimeout(() => {
      salida.disconnect();
      avisar();
    }, (SALIDA_S + 0.2) * 1000);
  }

  window.addEventListener('camara', (evento) => {
    if (evento.detail.estado === 'prendiendo') prender();
    else apagar();
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(esperaApagar);
    if (sonando) { sonando.inicio = 0; apagar(); }
  });

  window.Ambiente = {
    prender,
    apagar,
    get sonando() { return Boolean(sonando); },
    // Promesa que se resuelve cuando ya no suena (al toque si no estaba sonando)
    alTerminar: () => (sonando || esperaApagar ? fin : Promise.resolve()),
  };
})();
