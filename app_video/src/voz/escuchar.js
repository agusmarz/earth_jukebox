// Reconocimiento de voz con la Web Speech API.
// Funciona en Chrome, Edge y Safari. En Firefox no está disponible por defecto.

const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition;

let reconocedorActual = null;

export const oido = {
  disponible: Boolean(Reconocedor),
  escuchando: false,
  bloqueado: false, // queda en true si el usuario negó el micrófono

  // Escucha una sola frase. Resuelve con la lista de alternativas
  // reconocidas, o con null si no se entendió nada.
  escucharUnaVez({ idioma = 'es-AR', alEmpezar, alTerminar } = {}) {
    if (!Reconocedor || this.bloqueado) return Promise.resolve(null);
    this.detener();

    return new Promise((resolver) => {
      const reconocedor = new Reconocedor();
      reconocedorActual = reconocedor;
      reconocedor.lang = idioma;
      reconocedor.continuous = false;
      reconocedor.interimResults = false;
      reconocedor.maxAlternatives = 5;

      let alternativas = null;

      reconocedor.onstart = () => {
        this.escuchando = true;
        alEmpezar?.();
      };
      reconocedor.onresult = (evento) => {
        const resultado = evento.results[0];
        alternativas = Array.from(resultado).map((a) => a.transcript);
      };
      reconocedor.onerror = (evento) => {
        if (evento.error === 'not-allowed' || evento.error === 'service-not-allowed') {
          this.bloqueado = true;
        }
      };
      reconocedor.onend = () => {
        this.escuchando = false;
        if (reconocedorActual === reconocedor) reconocedorActual = null;
        alTerminar?.();
        resolver(alternativas);
      };

      try {
        reconocedor.start();
      } catch {
        this.escuchando = false;
        resolver(null);
      }
    });
  },

  detener() {
    if (reconocedorActual) {
      try {
        reconocedorActual.abort();
      } catch {
        /* ya estaba detenido */
      }
    }
  },
};
