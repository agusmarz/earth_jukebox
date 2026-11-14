// Interfaz de la demo. Un cuadrado que se mueve con el mouse (o con las flechas) sobre el mapa.
// Si el cuadrado toca el río suena fuerte, si se aleja baja el volumen, y el paneo indica
// hacia qué lado quedó el río.

(function () {
  const LADO_CUADRADO = 34;
  // El volumen cae en forma logarítmica con la distancia, como un sonido real que se aleja.
  // Fuera del cuadrado, cada vez que se duplica (distancia + REFERENCIA_PX) el volumen baja
  // DB_POR_DUPLICACION decibeles. A REFERENCIA_PX del cuadrado ya bajó esos decibeles una vez.
  const REFERENCIA_PX = 30;
  const DB_POR_DUPLICACION = 10;
  const PISO_DB = -36; // por debajo de esto el río ya no suena (a unos 330 px del cuadrado)
  const PANEO_PX = 160; // a esta distancia horizontal el paneo ya es total
  const PASO_FLECHA = 6;
  const RELLENO_MAPA = 36;
  const ESPERA_QUIETO_MS = 350; // sin moverse este tiempo, la música pasa a nota fija
  const PASO_RECORRIDO_PX = 1; // cada cuánto se consulta el río sobre el camino entre dos cuadros
  const SALTO_MAXIMO_PX = 300; // un salto más largo (por ejemplo al volver a entrar al mapa) no se recorre

  const CAPAS = [
    { nombre: 'ancho', tecla: '1', titulo: 'Ancho', instrumento: 'Cuerdas' },
    { nombre: 'nivel', tecla: '2', titulo: 'Nivel', instrumento: 'Maderas' },
    { nombre: 'pendiente', tecla: '3', titulo: 'Pendiente', instrumento: 'Arpa y timbal' },
    { nombre: 'amplitud', tecla: '4', titulo: 'Amplitud', instrumento: 'Contrabajo y cornos' },
  ];

  const lienzo = document.getElementById('mapa');
  const contexto = lienzo.getContext('2d');
  const base = document.createElement('canvas');
  const contextoBase = base.getContext('2d');
  const contenedor = document.getElementById('contenedor-mapa');
  const portada = document.getElementById('portada');
  const anuncios = document.getElementById('anuncios');
  const elementos = {
    tramo: document.getElementById('tramo'),
    detalle: document.getElementById('detalle'),
    barraCercania: document.getElementById('barra-cercania'),
    estado: document.getElementById('estado'),
    listaCapas: document.getElementById('capas'),
  };

  let iniciado = false;
  let listo = false;
  let dentroDelMapa = false;
  let cursor = { x: 0, y: 0 };
  let consultaActual = null;
  let indiceAnterior = -1;
  let ultimoAnuncio = 0;
  let densidad = 1;
  let ultimoMovimiento = 0;
  let quieto = true;
  let cursorAnterior = null;

  function moverCursor(x, y) {
    if (Math.abs(x - cursor.x) < 0.5 && Math.abs(y - cursor.y) < 0.5) return;
    cursor = { x, y };
    ultimoMovimiento = performance.now();
  }

  const formato = (numero, decimales) =>
    numero.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const DECIMALES = { ancho: 0, nivel: 1, pendiente: 1, amplitud: 1 };

  // 1. Lista de capas en el panel, y abajo el triángulo
  function crearFila(tecla, titulo, instrumento, valorInicial, alTocar) {
    const boton = document.createElement('button');
    boton.className = 'capa';
    boton.type = 'button';
    boton.setAttribute('aria-pressed', 'true');
    boton.innerHTML = `
      <span class="tecla">${tecla}</span>
      <span class="texto">
        <span class="titulo">${titulo}</span>
        <span class="instrumento">${instrumento}</span>
        <span class="valor">${valorInicial}</span>
        <span class="pista"><span class="relleno"></span></span>
      </span>`;
    boton.addEventListener('click', alTocar);
    elementos.listaCapas.appendChild(boton);
    return {
      boton,
      valor: boton.querySelector('.valor'),
      relleno: boton.querySelector('.relleno'),
    };
  }

  const filasCapas = {};
  for (const capa of CAPAS) {
    filasCapas[capa.nombre] = crearFila(capa.tecla, capa.titulo, capa.instrumento, 'Sin tramo', () => alternar(capa));
  }

  const TECLA_TRIANGULO = '5';
  const CADA_TRIANGULO = window.Sonido.trianguloCada;
  const filaTriangulo = crearFila(
    TECLA_TRIANGULO, 'Triángulo', `Un golpe cada ${CADA_TRIANGULO} tramos cruzados`, `Faltan ${CADA_TRIANGULO} tramos`, alternarTriangulo,
  );
  let textoTriangulo = '';

  function alternar(capa) {
    const activa = window.Sonido.alternarCapa(capa.nombre);
    filasCapas[capa.nombre].boton.setAttribute('aria-pressed', String(activa));
    window.Sonido.confirmar(activa);
    anunciar(`${capa.titulo} ${activa ? 'prendido' : 'apagado'}`, true);
  }

  function alternarTriangulo() {
    const activa = window.Sonido.alternarTriangulo();
    filaTriangulo.boton.setAttribute('aria-pressed', String(activa));
    window.Sonido.confirmar(activa);
    anunciar(`Triángulo ${activa ? 'prendido' : 'apagado'}`, true);
  }

  // La barra del triángulo se llena con cada tramo cruzado y se vacía cuando suena
  function mostrarTriangulo() {
    const cruzados = window.Sonido.tramosParaTriangulo();
    const faltan = CADA_TRIANGULO - cruzados;
    const texto = faltan === 0 ? 'Suena' : faltan === 1 ? 'Falta 1 tramo' : `Faltan ${faltan} tramos`;
    if (texto !== textoTriangulo) {
      textoTriangulo = texto;
      filaTriangulo.valor.textContent = texto;
      filaTriangulo.relleno.style.width = `${Math.round((cruzados / CADA_TRIANGULO) * 100)}%`;
    }
  }

  // 2. Tamaño del lienzo y dibujo de la base
  function redimensionar() {
    densidad = window.devicePixelRatio || 1;
    const { width, height } = contenedor.getBoundingClientRect();
    for (const elemento of [lienzo, base]) {
      elemento.width = Math.round(width * densidad);
      elemento.height = Math.round(height * densidad);
    }
    lienzo.style.width = `${width}px`;
    lienzo.style.height = `${height}px`;
    window.Mapa.ajustar(width, height, RELLENO_MAPA);
    contextoBase.setTransform(densidad, 0, 0, densidad, 0, 0);
    window.Mapa.dibujarBase(contextoBase);
    if (!iniciado) cursor = { x: width * 0.42, y: height * 0.55 };
  }

  // 3. Panel del tramo actual
  function mostrarTramo(tramo) {
    elementos.tramo.textContent = `A ${formato(tramo.km, 0)} km de la desembocadura`;
    if (tramo.puente) {
      elementos.detalle.textContent = `Hueco de ${formato(tramo.hueco, 0)} km entre dos tramos de SWORD, valores interpolados entre sus puntas`;
    } else if (!tramo.tieneDatos) {
      elementos.detalle.textContent = `Tramo ${tramo.id}, ${tramo.tipo}, sin pasadas buenas, no suena`;
    } else if (tramo.pasadas === 0) {
      elementos.detalle.textContent = `Tramo ${tramo.id}, ${tramo.tipo}, sin pasadas buenas, valores interpolados entre los tramos vecinos`;
    } else {
      elementos.detalle.textContent = `Tramo ${tramo.id}, ${tramo.tipo}, ${tramo.pasadas} pasadas buenas`;
    }
    for (const capa of CAPAS) {
      const fila = filasCapas[capa.nombre];
      const valor = tramo.valor[capa.nombre];
      if (valor === null) {
        fila.valor.textContent = 'Sin dato';
        fila.relleno.style.width = '0%';
        continue;
      }
      let texto = `${formato(valor, DECIMALES[capa.nombre])} ${window.Mapa.unidades[capa.nombre]}`;
      if (tramo.interpolado && tramo.interpolado[capa.nombre]) {
        texto += ', interpolado';
      } else if (tramo.corregido[capa.nombre]) {
        texto += `, suavizado (SWOT midió ${formato(tramo.medido[capa.nombre], DECIMALES[capa.nombre])})`;
      }
      fila.valor.textContent = texto;
      fila.relleno.style.width = `${Math.round(tramo.norma[capa.nombre] * 100)}%`;
    }
  }

  function anunciar(texto, forzar) {
    const ahora = performance.now();
    if (!forzar && ahora - ultimoAnuncio < 1500) return;
    ultimoAnuncio = ahora;
    anuncios.textContent = texto;
  }

  // 4. Recorrido entre dos cuadros. Con el mouse rápido el cuadrado salta varios píxeles de un
  // cuadro al siguiente y los tramos del medio quedarían sin consultar. Por eso se recorre el
  // camino de a un píxel y se le avisa al sonido cada tramo cruzado, en orden.
  function registrarRecorrido(consulta) {
    if (!dentroDelMapa) {
      cursorAnterior = null;
      return;
    }
    const desde = cursorAnterior || cursor;
    const largo = Math.hypot(cursor.x - desde.x, cursor.y - desde.y);
    if (largo <= SALTO_MAXIMO_PX) {
      const pasos = Math.ceil(largo / PASO_RECORRIDO_PX);
      for (let p = 1; p < pasos; p++) {
        const t = p / pasos;
        const intermedia = window.Mapa.consultar(desde.x + (cursor.x - desde.x) * t, desde.y + (cursor.y - desde.y) * t);
        window.Sonido.registrarTramo(intermedia.tramo);
      }
    }
    window.Sonido.registrarTramo(consulta.tramo);
    cursorAnterior = { x: cursor.x, y: cursor.y };
  }

  // 5. Cada cuadro, dónde está el río respecto del cuadrado
  function actualizar() {
    const consulta = window.Mapa.consultar(cursor.x, cursor.y);
    consultaActual = consulta;
    registrarRecorrido(consulta);
    const radio = LADO_CUADRADO / 2;
    const afuera = Math.max(0, consulta.distancia - radio);
    let decibeles = -DB_POR_DUPLICACION * Math.log2(1 + afuera / REFERENCIA_PX);
    if (!dentroDelMapa || decibeles < PISO_DB) decibeles = -Infinity;
    // ganancia es la amplitud que va al audio. cercania es lo mismo en decibeles llevado a 0 a 1,
    // que es como se percibe, y maneja la barra, el brillo y la sala.
    const ganancia = 10 ** (decibeles / 20);
    const cercania = Math.max(0, 1 - decibeles / PISO_DB);
    const paneo = Math.max(-1, Math.min(1, (consulta.rioX - cursor.x) / PANEO_PX));
    window.Sonido.fijarCercania(ganancia, paneo, cercania);
    elementos.barraCercania.style.width = `${Math.round(cercania * 100)}%`;

    const estaQuieto = performance.now() - ultimoMovimiento > ESPERA_QUIETO_MS;
    if (estaQuieto !== quieto) {
      quieto = estaQuieto;
      window.Sonido.fijarQuieto(quieto);
      elementos.estado.textContent = quieto ? 'Quieto, la orquesta sostiene el acorde' : 'En movimiento, suena la música';
    }

    if (consulta.indice !== indiceAnterior) {
      indiceAnterior = consulta.indice;
      window.Sonido.fijarTramo(consulta.tramo);
      mostrarTramo(consulta.tramo);
      if (cercania > 0.5) anunciar(`A ${formato(consulta.tramo.km, 0)} kilómetros de la desembocadura`);
    }
    mostrarTriangulo();
    dibujar(ganancia);
    requestAnimationFrame(actualizar);
  }

  function dibujar(ganancia) {
    contexto.setTransform(1, 0, 0, 1, 0, 0);
    contexto.drawImage(base, 0, 0);
    contexto.setTransform(densidad, 0, 0, densidad, 0, 0);
    if (!consultaActual || !dentroDelMapa) return;

    if (ganancia > 0) window.Mapa.resaltarTramo(contexto, consultaActual.tramo);

    // Marca en el punto del río más cercano, para quien mira la pantalla
    if (consultaActual.distancia > LADO_CUADRADO / 2) {
      contexto.fillStyle = '#000000';
      contexto.fillRect(consultaActual.rioX - 4, consultaActual.rioY - 4, 8, 8);
    }

    // El cuadrado invierte lo que tiene abajo, así se ve sobre el río y sobre el fondo
    contexto.globalCompositeOperation = 'difference';
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(cursor.x - LADO_CUADRADO / 2, cursor.y - LADO_CUADRADO / 2, LADO_CUADRADO, LADO_CUADRADO);
    contexto.globalCompositeOperation = 'source-over';
  }

  // 6. Carga de la orquesta. Las muestras se leen con fetch, así que hace falta un servidor local.
  const tituloPortada = portada.querySelector('.portada-titulo');
  const textoPortada = portada.querySelector('.portada-texto');
  const textoListo = textoPortada.textContent;
  tituloPortada.textContent = 'Cargando la orquesta';
  window.Sonido.cargar((avance) => {
    if (!portada.disabled) textoPortada.textContent = `${Math.round(avance * 100)} %`;
  }).then(() => {
    listo = true;
    tituloPortada.textContent = 'Tocá para escuchar el río';
    textoPortada.textContent = textoListo;
  }).catch((error) => {
    portada.disabled = true;
    if (error.message === 'servidor') {
      tituloPortada.textContent = 'Abrí la demo desde un servidor local';
      textoPortada.textContent = 'En esta carpeta corré python -m http.server y entrá a http://localhost:8000';
    } else {
      tituloPortada.textContent = 'No se pudo cargar la orquesta';
      textoPortada.textContent = error.message;
    }
  });

  // 7. Entrada
  async function iniciar() {
    if (iniciado || !listo) return;
    iniciado = true;
    portada.hidden = true;
    dentroDelMapa = true;
    await window.Sonido.iniciar();
    indiceAnterior = -1;
    anunciar('Mové el mouse o las flechas por el mapa. Teclas 1 a 5 para prender y apagar instrumentos.', true);
  }

  lienzo.addEventListener('pointermove', (evento) => {
    const caja = lienzo.getBoundingClientRect();
    moverCursor(evento.clientX - caja.left, evento.clientY - caja.top);
    dentroDelMapa = true;
  });
  lienzo.addEventListener('pointerleave', () => { dentroDelMapa = false; });
  lienzo.addEventListener('pointerdown', iniciar);
  portada.addEventListener('click', iniciar);

  window.addEventListener('keydown', (evento) => {
    if (!iniciado) {
      if (evento.key === 'Tab') return;
      evento.preventDefault();
      iniciar();
      return;
    }
    const capa = CAPAS.find((c) => c.tecla === evento.key);
    if (capa) {
      alternar(capa);
      return;
    }
    if (evento.key === TECLA_TRIANGULO) {
      alternarTriangulo();
      return;
    }
    const paso = evento.shiftKey ? PASO_FLECHA * 5 : PASO_FLECHA;
    const movimientos = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    if (movimientos[evento.key]) {
      evento.preventDefault();
      const { width, height } = lienzo.getBoundingClientRect();
      moverCursor(
        Math.max(0, Math.min(width, cursor.x + movimientos[evento.key][0])),
        Math.max(0, Math.min(height, cursor.y + movimientos[evento.key][1])),
      );
      dentroDelMapa = true;
    }
  });

  window.addEventListener('resize', redimensionar);
  document.fonts.ready.then(redimensionar);
  redimensionar();
  requestAnimationFrame(actualizar);
})();
