// Reproduce el tramo del video del EIC que corresponde a cada río.
// Si existe el recorte local (app_video/rios/<id>.webm, generado con los scripts
// de preprocesamiento) usa ese. Si no, reproduce el tramo directo desde la NASA.
// El video va siempre en silencio porque el sonido lo pone la sonificación.

const ANCHO_ORIGINAL = 3840;
const ALTO_ORIGINAL = 2160;

export function crearReproductor(elementoVideo, urlRemota, { alActualizar, alTerminar }) {
  let rioActual = null;
  let inicio = 0;
  let fin = 0;
  let cuadro = null;
  let terminado = false;

  elementoVideo.muted = true;
  elementoVideo.playsInline = true;
  elementoVideo.preload = 'auto';

  async function existeLocal(ruta) {
    try {
      const respuesta = await fetch(ruta, { method: 'HEAD' });
      return respuesta.ok;
    } catch {
      return false;
    }
  }

  function aplicarRecorte(recorte) {
    // object-view-box recorta sin reprocesar el video (Chrome y Edge)
    if (!recorte) {
      elementoVideo.style.objectViewBox = '';
      return;
    }
    const { x, y, ancho, alto } = recorte;
    const derecha = ANCHO_ORIGINAL - x - ancho;
    const abajo = ALTO_ORIGINAL - y - alto;
    elementoVideo.style.objectViewBox = `inset(${(y / ALTO_ORIGINAL) * 100}% ${(derecha / ANCHO_ORIGINAL) * 100}% ${(abajo / ALTO_ORIGINAL) * 100}% ${(x / ANCHO_ORIGINAL) * 100}%)`;
  }

  function esperarMetadatos() {
    if (elementoVideo.readyState >= 1) return Promise.resolve();
    return new Promise((resolver, rechazar) => {
      elementoVideo.addEventListener('loadedmetadata', resolver, { once: true });
      elementoVideo.addEventListener('error', rechazar, { once: true });
    });
  }

  function bucle() {
    const tiempo = elementoVideo.currentTime - inicio;
    const duracion = fin - inicio;
    alActualizar?.(tiempo, Math.min(1, Math.max(0, tiempo / duracion)));
    if (!terminado && elementoVideo.currentTime >= fin - 0.05) {
      terminado = true;
      elementoVideo.pause();
      alTerminar?.();
      return;
    }
    cuadro = requestAnimationFrame(bucle);
  }

  return {
    get rio() {
      return rioActual;
    },

    get enPausa() {
      return elementoVideo.paused;
    },

    async cargar(rio) {
      this.detener();
      rioActual = rio;
      const rutaLocal = `rios/${rio.id}.webm`;
      if (await existeLocal(rutaLocal)) {
        elementoVideo.src = rutaLocal;
        aplicarRecorte(null); // el recorte local ya viene recortado
        await esperarMetadatos();
        inicio = 0;
        fin = elementoVideo.duration;
      } else {
        if (!elementoVideo.src.startsWith(urlRemota)) elementoVideo.src = urlRemota;
        aplicarRecorte(rio.recorte);
        await esperarMetadatos();
        inicio = rio.inicio;
        fin = rio.fin;
      }
      elementoVideo.currentTime = inicio;
    },

    async reproducir() {
      terminado = false;
      cancelAnimationFrame(cuadro);
      await elementoVideo.play();
      cuadro = requestAnimationFrame(bucle);
    },

    pausar() {
      elementoVideo.pause();
      cancelAnimationFrame(cuadro);
    },

    async reanudar() {
      if (terminado) return this.repetir();
      await this.reproducir();
    },

    async repetir() {
      elementoVideo.currentTime = inicio;
      await this.reproducir();
    },

    detener() {
      cancelAnimationFrame(cuadro);
      elementoVideo.pause();
      terminado = false;
    },
  };
}
