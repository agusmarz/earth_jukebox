// Flujo de la app. Estados posibles
// inicio        pantalla de bienvenida, espera la primera tecla
// menu          mapa con los cinco ríos, la app escucha sola
// confirmando   la app no está segura de qué río se pidió y pregunta
// reproduciendo suena un río, el micrófono se abre solo con la barra espaciadora
// pausado       río en pausa, la app escucha sola
// fin           terminó el tramo, la app escucha sola

import { voz } from '../voz/hablar.js';
import { oido } from '../voz/escuchar.js';
import { interpretar } from '../voz/interpretar.js';
import { sonificador } from '../sonificacion/motor.js';

const ESCUCHA_AUTOMATICA = ['menu', 'confirmando', 'pausado', 'fin'];
const CONFIANZA_DIRECTA = 0.8;

const NUMEROS = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho'];

const AYUDA =
  'Atajos de teclado. Barra espaciadora para hablar. Flechas para recorrer los ríos y Enter para elegir. ' +
  'Números del uno al cinco para ir directo a un río. P para pausar o seguir, R para repetir, D para escuchar la descripción. ' +
  'Escape vuelve al mapa. V activa o desactiva la voz de la app, por si preferís tu lector de pantalla. H repite esta ayuda.';

export function crearApp({ rios, mapa, reproductor, interfaz }) {
  let estado = 'inicio';
  let turno = 0; // cada acción nueva invalida a las anteriores que quedaron esperando
  let rioActual = null;
  let rioPendiente = null;
  let indiceEnfocado = -1;
  let yaExplicoBarra = false;
  let arrancando = false;
  let falloCarga = false;

  const textoOpciones = () =>
    `Tenés ${rios.length} ríos para escuchar. ` +
    rios.map((r, i) => `${NUMEROS[i]}, ${r.nombre}, en ${r.region}.`).join(' ') +
    ' Decí el nombre o el número del río que querés escuchar.';

  const BIENVENIDA =
    'Bienvenido a Earth Jukebox. Con datos del satélite SWOT de la NASA vas a poder escuchar cómo crecen y bajan algunos de los ríos más grandes del mundo. ';

  function cambiarEstado(nuevo) {
    estado = nuevo;
    interfaz.mostrarEstadoApp(nuevo);
  }

  async function decir(texto, { soloSiHayVoz = false } = {}) {
    interfaz.mostrarSubtitulo(texto);
    if (!voz.activada || !voz.disponible) {
      if (!soloSiHayVoz) interfaz.anunciar(texto);
      return;
    }
    sonificador.atenuar(true);
    await voz.decir(texto);
    sonificador.atenuar(false);
  }

  async function escucharUna() {
    interfaz.mostrarEscuchando(true);
    sonificador.atenuar(true);
    const alternativas = await oido.escucharUnaVez();
    interfaz.mostrarEscuchando(false);
    sonificador.atenuar(false);
    if (alternativas?.length) interfaz.mostrarLoQueOyo(alternativas[0]);
    return { alternativas, intencion: interpretar(alternativas, rios) };
  }

  function vozNoDisponible() {
    if (!oido.disponible) {
      return 'Este navegador no permite comandos de voz. Usá las flechas para recorrer los ríos y Enter para elegir, o abrí la app en Chrome o Edge.';
    }
    if (oido.bloqueado) {
      return 'No tengo permiso para usar el micrófono. Usá las flechas y Enter, o habilitá el micrófono en el navegador.';
    }
    return null;
  }

  async function decirYEscuchar(texto) {
    const miTurno = ++turno;
    oido.detener();
    await decir(texto);
    if (miTurno !== turno) return;
    await bucleDeEscucha(miTurno);
  }

  async function bucleDeEscucha(miTurno) {
    let silencios = 0;
    let fallos = 0;
    while (miTurno === turno && ESCUCHA_AUTOMATICA.includes(estado)) {
      const aviso = vozNoDisponible();
      if (aviso) {
        await decir(aviso);
        return;
      }
      const { alternativas, intencion } = await escucharUna();
      if (miTurno !== turno) return;
      if (!alternativas) {
        silencios += 1;
        if (silencios >= 2) {
          await decir('Cuando quieras hablar, apretá la barra espaciadora. También podés usar las flechas y Enter.');
          return;
        }
        continue;
      }
      if (!intencion) {
        fallos += 1;
        if (fallos >= 3) {
          await decir('No te estoy entendiendo. Probá con las flechas y Enter, o apretá H para escuchar la ayuda.');
          return;
        }
        await decir('No te entendí. Decí el nombre de un río, por ejemplo Amazonas.');
        if (miTurno !== turno) return;
        continue;
      }
      await procesar(intencion);
      return;
    }
  }

  async function procesar(intencion) {
    if (intencion.tipo === 'rio') {
      if (intencion.confianza >= CONFIANZA_DIRECTA) return elegirRio(intencion.rio);
      return confirmar(intencion.rio);
    }

    const comando = intencion.nombre;

    if (comando === 'opciones' && ['menu', 'confirmando', 'fin'].includes(estado)) {
      cambiarEstado('menu');
      return decirYEscuchar(textoOpciones());
    }

    if (estado === 'confirmando') {
      if (comando === 'afirmar') return elegirRio(rioPendiente);
      if (comando === 'negar') {
        cambiarEstado('menu');
        return decirYEscuchar('Bueno. ' + textoOpciones());
      }
    }

    if (comando === 'volver') return irAlMenu();
    if (comando === 'pausa' && estado === 'reproduciendo') return pausar();
    if ((comando === 'seguir' || comando === 'afirmar') && estado === 'pausado') return reanudar();
    if ((comando === 'repetir' || comando === 'seguir') && ['reproduciendo', 'pausado', 'fin'].includes(estado))
      return repetir();
    if (comando === 'describir' && rioActual && estado !== 'menu') return describir();
    if (comando === 'negar' && estado === 'fin') return irAlMenu();

    if (estado === 'menu') return decirYEscuchar('Estás en el mapa. ' + textoOpciones());
    if (ESCUCHA_AUTOMATICA.includes(estado)) return decirYEscuchar('No te entendí. Podés decir repetir, otro río, o volver.');
    return decir('No te entendí.');
  }

  async function confirmar(rio) {
    cambiarEstado('confirmando');
    rioPendiente = rio;
    mapa.resaltar(rio.id);
    await decirYEscuchar(`¿Querés escuchar el ${rio.nombre}?`);
  }

  async function irAlMenu(bienvenida = false) {
    ++turno;
    oido.detener();
    voz.callar();
    reproductor.detener();
    sonificador.detener();
    rioActual = null;
    cambiarEstado('menu');
    interfaz.mostrarPantalla('mapa');
    mapa.resaltar(null);
    const inicio = bienvenida ? BIENVENIDA : 'Volviste al mapa. ';
    await decirYEscuchar(inicio + textoOpciones());
  }

  async function elegirRio(rio) {
    const miTurno = ++turno;
    oido.detener();
    voz.callar();
    rioActual = rio;
    indiceEnfocado = rios.indexOf(rio);
    cambiarEstado('reproduciendo');
    mapa.resaltar(rio.id);
    interfaz.mostrarRio(rio);
    interfaz.mostrarPantalla('reproductor');

    sonificador.cargar(rio);
    const carga = reproductor.cargar(rio).then(
      () => null,
      (error) => error ?? new Error('video')
    );

    let texto = `${rio.nombre}, ${rio.region}. ${rio.descripcion}`;
    if (!yaExplicoBarra) {
      texto += ' Mientras suena, apretá la barra espaciadora para darme una indicación.';
      yaExplicoBarra = true;
    }
    await decir(texto);
    if (miTurno !== turno) return;

    const error = await carga;
    if (miTurno !== turno) return;
    falloCarga = Boolean(error);
    if (error) {
      cambiarEstado('fin');
      return decirYEscuchar('No pude cargar el video. Revisá la conexión a internet. Podés decir repetir para intentar de nuevo, o volver.');
    }
    try {
      await reproductor.reproducir();
      sonificador.iniciar();
      interfaz.mostrarSubtitulo(`Sonando el ${rio.nombre}`);
    } catch {
      cambiarEstado('fin');
      decirYEscuchar('El navegador no dejó reproducir el video. Apretá Enter para intentar de nuevo.');
    }
  }

  async function alTerminarVideo() {
    if (!rioActual) return;
    sonificador.pausar();
    cambiarEstado('fin');
    await decirYEscuchar(
      `Terminó el ${rioActual.nombre}. Decí repetir para escucharlo de nuevo, el nombre de otro río, o volver para ir al mapa.`
    );
  }

  async function pausar() {
    ++turno;
    reproductor.pausar();
    sonificador.pausar();
    cambiarEstado('pausado');
    await decirYEscuchar('En pausa. Decí seguir para continuar.');
  }

  async function reanudar() {
    ++turno;
    oido.detener();
    voz.callar();
    cambiarEstado('reproduciendo');
    await reproductor.reanudar();
    sonificador.reanudar();
  }

  async function repetir() {
    if (!rioActual) return;
    if (falloCarga) return elegirRio(rioActual);
    ++turno;
    oido.detener();
    voz.callar();
    cambiarEstado('reproduciendo');
    await reproductor.repetir();
    sonificador.reanudar();
  }

  async function describir() {
    if (!rioActual) return;
    const miTurno = ++turno;
    oido.detener();
    await decir(rioActual.descripcion);
    if (miTurno === turno && ESCUCHA_AUTOMATICA.includes(estado)) await bucleDeEscucha(miTurno);
  }

  return {
    get estado() {
      return estado;
    },

    async empezar() {
      if (estado !== 'inicio' || arrancando) return;
      arrancando = true;
      await sonificador.desbloquear();
      await irAlMenu(true);
    },

    // Barra espaciadora o botón Hablar
    async pulsarParaHablar() {
      if (estado === 'inicio') return this.empezar();
      if (oido.escuchando) return oido.detener();
      const aviso = vozNoDisponible();
      if (aviso) return decir(aviso);
      const miTurno = ++turno;
      voz.callar();
      const { alternativas, intencion } = await escucharUna();
      if (miTurno !== turno) return;
      if (!alternativas) {
        if (ESCUCHA_AUTOMATICA.includes(estado)) bucleDeEscucha(miTurno);
        return;
      }
      if (!intencion) return decirYEscucharSegunEstado('No te entendí.');
      await procesar(intencion);
    },

    // Flechas sobre el mapa
    moverFoco(paso) {
      if (!['menu', 'confirmando', 'fin'].includes(estado)) return;
      if (estado === 'fin') {
        reproductor.detener();
        sonificador.detener();
        interfaz.mostrarPantalla('mapa');
        cambiarEstado('menu');
      }
      ++turno;
      oido.detener();
      indiceEnfocado = (indiceEnfocado + paso + rios.length) % rios.length;
      mapa.enfocar(rios[indiceEnfocado].id);
    },

    // Se llama cuando un pin recibe el foco del teclado
    anunciarPin(rio) {
      indiceEnfocado = rios.indexOf(rio);
      mapa.resaltar(rio.id);
      sonificador.señalarPin(rio);
      if (estado === 'inicio') return;
      ++turno;
      oido.detener();
      // con el lector de pantalla el pin ya se lee solo por su aria-label
      decir(`${NUMEROS[indiceEnfocado]}, ${rio.nombre}, ${rio.region}. Enter para escuchar.`, { soloSiHayVoz: true });
    },

    señalarPin(rio) {
      sonificador.señalarPin(rio);
    },

    elegirEnfocado() {
      if (estado === 'inicio') return this.empezar();
      if (estado === 'reproduciendo' && voz.hablando) return voz.callar(); // Enter saltea la descripción
      if (['menu', 'confirmando', 'fin'].includes(estado) && indiceEnfocado >= 0) return elegirRio(rios[indiceEnfocado]);
      if (estado === 'fin') return repetir();
    },

    elegirNumero(numero) {
      if (estado === 'inicio') return;
      const rio = rios[numero - 1];
      if (rio) elegirRio(rio);
    },

    elegirRio(rio) {
      if (estado === 'inicio') return;
      elegirRio(rio);
    },

    alternarPausa() {
      if (estado === 'reproduciendo') return pausar();
      if (estado === 'pausado') return reanudar();
    },

    repetir() {
      if (['reproduciendo', 'pausado', 'fin'].includes(estado)) return repetir();
    },

    describir() {
      if (rioActual) return describir();
    },

    volver() {
      if (estado !== 'inicio' && estado !== 'menu') return irAlMenu();
    },

    ayuda() {
      if (estado === 'inicio') return;
      if (ESCUCHA_AUTOMATICA.includes(estado)) return decirYEscuchar(AYUDA);
      return decir(AYUDA);
    },

    alternarVoz() {
      voz.activada = !voz.activada;
      interfaz.mostrarModoVoz(voz.activada);
      if (voz.activada) decir('Voz de la app activada.');
      else interfaz.anunciar('Voz de la app desactivada. Los anuncios van a tu lector de pantalla.');
    },

    alTerminarVideo,
  };

  function decirYEscucharSegunEstado(texto) {
    if (ESCUCHA_AUTOMATICA.includes(estado)) return decirYEscuchar(texto);
    return decir(texto);
  }
}
