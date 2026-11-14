// Síntesis de voz. Parte el texto en oraciones porque Chrome corta
// los enunciados largos, y avisa cuándo empieza y termina de hablar
// para que el micrófono nunca esté abierto mientras la app habla.

const sintesis = window.speechSynthesis;
const PREFERENCIA_IDIOMAS = ['es-AR', 'es-419', 'es-US', 'es-MX', 'es-ES', 'es'];

let vozElegida = null;
let hablando = false;
let activada = true;
const oyentes = new Set();

function elegirVoz() {
  const voces = sintesis?.getVoices() ?? [];
  for (const idioma of PREFERENCIA_IDIOMAS) {
    const voz = voces.find((v) => v.lang?.toLowerCase().startsWith(idioma.toLowerCase()));
    if (voz) return voz;
  }
  return null;
}

if (sintesis) {
  vozElegida = elegirVoz();
  sintesis.addEventListener?.('voiceschanged', () => (vozElegida = elegirVoz()));
}

function avisar(estado) {
  hablando = estado;
  oyentes.forEach((f) => f(estado));
}

export const voz = {
  disponible: Boolean(sintesis),

  get hablando() {
    return hablando;
  },

  get activada() {
    return activada;
  },

  set activada(valor) {
    activada = valor;
    if (!valor) this.callar();
  },

  alCambiar(funcion) {
    oyentes.add(funcion);
  },

  // Devuelve una promesa que se resuelve cuando termina (o se corta)
  decir(texto) {
    if (!sintesis || !activada || !texto) return Promise.resolve();
    sintesis.cancel();
    const oraciones = texto.match(/[^.!?¿¡]+[.!?]*/g)?.map((o) => o.trim()).filter(Boolean) ?? [texto];

    return new Promise((resolver) => {
      let pendientes = oraciones.length;
      avisar(true);
      oraciones.forEach((oracion) => {
        const enunciado = new SpeechSynthesisUtterance(oracion);
        enunciado.lang = vozElegida?.lang ?? 'es-AR';
        if (vozElegida) enunciado.voice = vozElegida;
        enunciado.rate = 1.0;
        const terminar = () => {
          pendientes -= 1;
          if (pendientes <= 0) {
            avisar(false);
            resolver();
          }
        };
        enunciado.onend = terminar;
        enunciado.onerror = () => {
          pendientes = 0;
          avisar(false);
          resolver();
        };
        sintesis.speak(enunciado);
      });
    });
  },

  callar() {
    if (!sintesis) return;
    sintesis.cancel();
    if (hablando) avisar(false);
  },
};
