import { crearMapa } from './mapa/mapaMercator.js';
import { crearReproductor } from './reproductor/video.js';
import { crearApp } from './estado/maquina.js';
import { conectarTeclado } from './accesibilidad/teclado.js';
import { sonificador } from './sonificacion/motor.js';

const $ = (selector) => document.querySelector(selector);

// Todo lo que la máquina de estados le pide a la pantalla
function crearInterfaz() {
  const pantallas = {
    inicio: $('#pantalla-inicio'),
    mapa: $('#pantalla-mapa'),
    reproductor: $('#pantalla-reproductor'),
  };
  const anuncios = $('#anuncios');
  let temporizadorOido = null;

  return {
    mostrarPantalla(nombre) {
      Object.entries(pantallas).forEach(([clave, elemento]) => {
        const activa = clave === nombre;
        elemento.hidden = !activa;
      });
      document.body.dataset.pantalla = nombre;
    },

    mostrarEstadoApp(estado) {
      document.body.dataset.estado = estado;
      $('#boton-pausa').textContent = estado === 'pausado' ? 'Seguir' : 'Pausa';
    },

    mostrarSubtitulo(texto) {
      $('#subtitulo').textContent = texto;
    },

    mostrarEscuchando(activo) {
      document.body.classList.toggle('escuchando', activo);
      $('#estado-microfono').textContent = activo ? 'Te escucho' : 'Micrófono cerrado';
      $('#boton-hablar').setAttribute('aria-pressed', String(activo));
    },

    mostrarLoQueOyo(texto) {
      const elemento = $('#lo-que-oyo');
      elemento.textContent = `Entendí “${texto}”`;
      clearTimeout(temporizadorOido);
      temporizadorOido = setTimeout(() => (elemento.textContent = ''), 4000);
    },

    mostrarRio(rio) {
      $('#nombre-rio').textContent = rio.nombre;
      $('#region-rio').textContent = rio.region;
      $('#descripcion-rio').textContent = rio.descripcion;
      $('#progreso').style.transform = 'scaleX(0)';
    },

    mostrarProgreso(progreso) {
      $('#progreso').style.transform = `scaleX(${progreso})`;
    },

    mostrarModoVoz(activada) {
      $('#modo-voz').textContent = activada ? 'Voz de la app activada' : 'Voz de la app desactivada';
    },

    anunciar(texto) {
      // vaciar y volver a escribir hace que el lector lo lea aunque se repita
      anuncios.textContent = '';
      setTimeout(() => (anuncios.textContent = texto), 50);
    },
  };
}

async function iniciar() {
  const datos = await (await fetch('src/datos/rios.json')).json();
  const { rios } = datos;
  const interfaz = crearInterfaz();
  let app = null;

  const mapa = await crearMapa($('#mapa'), rios, {
    alElegir: (rio) => app?.elegirRio(rio),
    alEnfocar: (rio) => app?.anunciarPin(rio),
    alPasar: (rio) => app?.señalarPin(rio),
  });

  const reproductor = crearReproductor($('#video'), datos.fuente.video, {
    alActualizar: (tiempo, progreso) => {
      interfaz.mostrarProgreso(progreso);
      sonificador.actualizar(tiempo, progreso);
    },
    alTerminar: () => app?.alTerminarVideo(),
  });

  app = crearApp({ rios, mapa, reproductor, interfaz });
  conectarTeclado(app);

  // Un toque en cualquier lado de la pantalla de inicio también arranca
  $('#pantalla-inicio').addEventListener('click', () => app.empezar());
  $('#boton-hablar').addEventListener('click', () => app.pulsarParaHablar());
  $('#boton-pausa').addEventListener('click', () => app.alternarPausa());
  $('#boton-repetir').addEventListener('click', () => app.repetir());
  $('#boton-describir').addEventListener('click', () => app.describir());
  $('#boton-volver').addEventListener('click', () => app.volver());

  interfaz.mostrarPantalla('inicio');
  interfaz.mostrarEstadoApp('inicio');
  $('#boton-empezar').focus();
}

iniciar();
