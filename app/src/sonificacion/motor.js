// Motor de sonido.
// PROVISORIO. Por ahora suena un colchón tranquilo con una tónica distinta
// para cada río, solo para poder probar el flujo completo. Cuando definamos
// cómo sonorizar, la lógica nueva va en cargar() y actualizar() sin tocar
// el resto de la app.

const LA_GRAVE = 110; // frecuencia base en Hz
const VOLUMEN_GENERAL = 0.12;

let contexto = null;
let salida = null;
let voces = [];
let filtro = null;
let rioActual = null;
let sonando = false;

const frecuencia = (semitonos) => LA_GRAVE * 2 ** (semitonos / 12);

function rampa(parametro, valor, segundos = 0.4) {
  const ahora = contexto.currentTime;
  parametro.cancelScheduledValues(ahora);
  parametro.setValueAtTime(parametro.value, ahora);
  parametro.linearRampToValueAtTime(valor, ahora + segundos);
}

export const sonificador = {
  // Hay que llamarlo después de un gesto del usuario (tecla o toque)
  desbloquear() {
    if (!contexto) {
      contexto = new AudioContext();
      salida = contexto.createGain();
      salida.gain.value = 0;
      salida.connect(contexto.destination);
    }
    return contexto.resume();
  },

  // Sonidito corto al recorrer los pines, paneado según la longitud del río
  señalarPin(rio) {
    if (!contexto) return;
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();
    const paneo = contexto.createStereoPanner();
    oscilador.type = 'sine';
    oscilador.frequency.value = frecuencia(rio.tono + 24);
    paneo.pan.value = Math.max(-1, Math.min(1, rio.coordenadas.lon / 150));
    const ahora = contexto.currentTime;
    ganancia.gain.setValueAtTime(0, ahora);
    ganancia.gain.linearRampToValueAtTime(0.15, ahora + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.35);
    oscilador.connect(ganancia).connect(paneo).connect(contexto.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.4);
  },

  cargar(rio) {
    this.detener();
    rioActual = rio;
    filtro = contexto.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 600;
    filtro.connect(salida);
    // tónica, quinta y octava
    voces = [0, 7, 12].map((intervalo, i) => {
      const oscilador = contexto.createOscillator();
      const ganancia = contexto.createGain();
      oscilador.type = i === 0 ? 'triangle' : 'sine';
      oscilador.frequency.value = frecuencia(rio.tono + intervalo);
      oscilador.detune.value = (i - 1) * 4;
      ganancia.gain.value = i === 0 ? 0.6 : 0.3;
      oscilador.connect(ganancia).connect(filtro);
      oscilador.start();
      return oscilador;
    });
  },

  iniciar() {
    if (!rioActual) return;
    sonando = true;
    rampa(salida.gain, VOLUMEN_GENERAL, 1.5);
  },

  // Se llama en cada cuadro del video. tiempo en segundos desde el inicio
  // del tramo y progreso entre 0 y 1.
  actualizar(tiempo, progreso) {
    if (!filtro) return;
    // provisorio, el filtro se abre de a poco a lo largo del tramo
    filtro.frequency.setTargetAtTime(500 + progreso * 1500, contexto.currentTime, 0.5);
  },

  pausar() {
    sonando = false;
    if (salida) rampa(salida.gain, 0, 0.3);
  },

  reanudar() {
    if (!salida || !rioActual) return;
    sonando = true;
    rampa(salida.gain, VOLUMEN_GENERAL, 0.5);
  },

  // Baja el volumen mientras el usuario habla o la app habla
  atenuar(activo) {
    if (salida && sonando) rampa(salida.gain, activo ? VOLUMEN_GENERAL * 0.15 : VOLUMEN_GENERAL, 0.25);
  },

  detener() {
    if (!contexto) return;
    sonando = false;
    rampa(salida.gain, 0, 0.3);
    const viejas = voces;
    setTimeout(() => viejas.forEach((o) => o.stop()), 400);
    voces = [];
    filtro = null;
    rioActual = null;
  },
};
