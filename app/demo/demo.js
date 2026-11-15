// Tablero de un río. Un cuadrado que se mueve con el mouse (o con las flechas) sobre el mapa.
// Si el cuadrado toca el río suena fuerte, si se aleja baja el volumen, y el paneo indica
// hacia qué lado quedó el río. La interfaz está en inglés.
// No arranca solo: app.js lo abre con Tablero.abrir(id) al elegir un río y lo cierra al volver al menú.
// Los ríos se leen de <carpeta>/<id>.json y sus estaciones de <carpeta>/estaciones/<id>.json.
// La dirección acepta ?normalizacion=global, ?musica=dos_octavas, ?estacion=invierno y ?carpeta=pruebas.

(function () {
  const MODOS_NORMALIZACION = {
    propia: { titulo: 'Own', detalle: 'Each river uses the whole sound range' },
    global: { titulo: 'Global', detalle: 'The same scale for every river' },
  };
  // Lógicas musicales de sonido.js, en el orden en que se recorren con la tecla M
  const MODOS_MUSICA = {
    original: { titulo: 'Original', detalle: 'Level moves the melody, slope the number of notes' },
    dos_octavas: { titulo: 'Two octaves', detalle: 'Level and slope span two octaves, D to D and A to A' },
    relieve: { titulo: 'Relief', detalle: 'The melody follows the width, which changes reach by reach, and the level moves to the strings' },
  };
  // La presentación hablada de cada río va siempre en inglés
  const IDIOMA_LOCUCION = 'en';
  // Estaciones de estaciones/<id>.json, en el orden del selector
  const ESTACIONES = {
    verano: 'Summer',
    otono: 'Autumn',
    invierno: 'Winter',
    primavera: 'Spring',
  };
  const NOMBRES_MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  // Lo que cambia de un tramo al pasar de una estación a otra. El resto (geometría, km, tipo) es igual.
  const CAMPOS_ESTACION = ['pasadas', 'valor', 'normas', 'corregido', 'medido', 'interpolado'];
  // Los tipos de tramo vienen en castellano en los datos
  const TIPOS_TRAMO = {
    'río': 'river', 'lago o embalse': 'lake or reservoir', presa: 'dam', 'topología dudosa': 'uncertain topology', fantasma: 'ghost',
  };
  const LADO_CUADRADO = 34;
  // El volumen cae en forma logarítmica con la distancia, como un sonido real que se aleja.
  // Fuera del cuadrado, cada vez que se duplica (distancia + REFERENCIA_PX) el volumen baja
  // DB_POR_DUPLICACION decibeles. A REFERENCIA_PX del cuadrado ya bajó esos decibeles una vez.
  const REFERENCIA_PX = 30;
  const DB_POR_DUPLICACION = 10;
  const PISO_DB = -36; // por debajo de esto el río ya no suena (a unos 330 px del cuadrado)
  const PANEO_PX = 160; // a esta distancia horizontal el paneo ya es total
  const PASO_FLECHA = 6;
  const RELLENO_MAPA = 56;
  const ESPERA_QUIETO_MS = 350; // sin moverse este tiempo, la música pasa a nota fija
  const PASO_RECORRIDO_PX = 1; // cada cuánto se consulta el río sobre el camino entre dos cuadros
  const SALTO_MAXIMO_PX = 300; // un salto más largo (por ejemplo al volver a entrar al mapa) no se recorre
  const PASO_ZOOM = 1.35; // teclas + y -

  const CAPAS = [
    { nombre: 'ancho', tecla: '1', titulo: 'Width' },
    { nombre: 'nivel', tecla: '2', titulo: 'Level' },
    { nombre: 'pendiente', tecla: '3', titulo: 'Slope' },
    { nombre: 'amplitud', tecla: '4', titulo: 'Range' },
  ];

  const vistaRio = document.getElementById('vista-rio');
  const lienzo = document.getElementById('mapa');
  const contexto = lienzo.getContext('2d');
  const base = document.createElement('canvas');
  const contextoBase = base.getContext('2d');
  const contenedor = document.getElementById('contenedor-mapa');
  const panel = vistaRio.querySelector('.panel');
  const minimapa = document.getElementById('minimapa');
  const contextoMinimapa = minimapa.getContext('2d');
  const portada = document.getElementById('portada');
  const anuncios = document.getElementById('anuncios');
  const elementos = {
    titulo: document.getElementById('titulo-rio'),
    selector: document.getElementById('selector-rio'),
    selectorEstacion: document.getElementById('selector-estacion'),
    botonNormalizacion: document.getElementById('boton-normalizacion'),
    modoNormalizacion: document.getElementById('modo-normalizacion'),
    botonMusica: document.getElementById('boton-musica'),
    modoMusica: document.getElementById('modo-musica'),
    detalleModos: document.getElementById('detalle-modos'),
    botonLocucion: document.getElementById('boton-locucion'),
    botonVolver: document.getElementById('boton-volver'),
    tramo: document.getElementById('tramo'),
    detalle: document.getElementById('detalle'),
    barraCercania: document.getElementById('barra-cercania'),
    estado: document.getElementById('estado'),
    listaCapas: document.getElementById('capas'),
  };
  const tituloPortada = portada.querySelector('.portada-titulo');
  const textoPortada = portada.querySelector('.portada-texto');
  const TEXTO_PORTADA = textoPortada.textContent;

  let abierto = false; // el tablero está en pantalla
  let iniciado = false; // el audio arrancó (hace falta un clic o una tecla)
  let orquestaLista = false;
  let errorOrquesta = null;
  let dentroDelMapa = false;
  let cursor = { x: 0, y: 0 };
  let consultaActual = null;
  let indiceAnterior = -1;
  let ultimoAnuncio = 0;
  let densidad = 1;
  let ultimoMovimiento = 0;
  let quieto = true;
  let cursorAnterior = null;
  let cuadroPedido = false;
  let minimapaSucio = true;

  // Parámetros de la dirección. Solo se aceptan nombres simples, para que no se pueda pedir
  // cualquier ruta
  const parametros = new URLSearchParams(location.search);
  const nombreSimple = (texto) => (texto && /^[a-z0-9_-]+$/i.test(texto) ? texto : null);
  const carpetaDatos = nombreSimple(parametros.get('carpeta')) || 'datos';
  let modoNormalizacion = parametros.get('normalizacion') === 'global' ? 'global' : 'propia';
  let modoMusica = MODOS_MUSICA[parametros.get('musica')] ? parametros.get('musica') : 'original';
  let rioActual = null;
  let rios = [];
  let pedidoRio = 0;
  const callbacks = { alVolver: null, alCambiarRio: null };
  // Estación elegida, que se mantiene al cambiar de río, y estaciones del río cargado (null si no tiene).
  // Sin el parámetro arranca con la primera de ESTACIONES.
  const ESTACION_INICIAL = Object.keys(ESTACIONES)[0];
  let estacionActual = ESTACIONES[parametros.get('estacion')] ? parametros.get('estacion') : ESTACION_INICIAL;
  let estacionesRio = null;
  // Estación que suena en el río cargado, o null si el río no tiene estaciones
  const estacionDelRio = () => (estacionesRio && estacionesRio[estacionActual] ? estacionActual : null);
  const nombreDe = (id) => (rios.find((rio) => rio.id === id) || { nombre: id }).nombre;

  function moverCursor(x, y) {
    if (Math.abs(x - cursor.x) < 0.5 && Math.abs(y - cursor.y) < 0.5) return;
    cursor = { x, y };
    ultimoMovimiento = performance.now();
  }

  const formato = (numero, decimales) =>
    numero.toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const DECIMALES = { ancho: 0, nivel: 1, pendiente: 1, amplitud: 1 };

  // 1. Filas de las cuatro características, como en el diseño: número grande, nombre,
  // instrumento, valor y barra
  const filasCapas = {};
  for (const capa of CAPAS) {
    const boton = document.createElement('button');
    boton.className = 'capa';
    boton.type = 'button';
    boton.setAttribute('aria-pressed', 'true');
    boton.innerHTML = `
      <span class="numero" aria-hidden="true">${capa.tecla}</span>
      <span class="texto">
        <span class="titulo">${capa.titulo}</span>
        <span class="instrumento"></span>
        <span class="valor">No reach</span>
        <span class="pista"><span class="relleno"></span></span>
      </span>`;
    boton.addEventListener('click', () => alternar(capa));
    elementos.listaCapas.appendChild(boton);
    filasCapas[capa.nombre] = {
      boton,
      valor: boton.querySelector('.valor'),
      instrumento: boton.querySelector('.instrumento'),
      relleno: boton.querySelector('.relleno'),
    };
  }

  function etiquetaCapa(capa) {
    const fila = filasCapas[capa.nombre];
    const activa = fila.boton.getAttribute('aria-pressed') === 'true';
    fila.boton.setAttribute('aria-label',
      `${capa.tecla}, ${capa.titulo}, ${capa.instrumento}, ${fila.valor.textContent}, ${activa ? 'on' : 'off'}`);
  }

  function alternar(capa) {
    const activa = window.Sonido.alternarCapa(capa.nombre);
    filasCapas[capa.nombre].boton.setAttribute('aria-pressed', String(activa));
    etiquetaCapa(capa);
    window.Sonido.confirmar(activa);
    anunciar(`${capa.titulo} ${activa ? 'on' : 'off'}`, true);
  }

  // 2. Tamaño del lienzo y dibujo de la base. El río se ajusta a la parte que no tapa el panel.
  function anchoUtil(ancho) {
    const caja = panel.getBoundingClientRect();
    const tapado = caja.width > 0 ? ancho - caja.left : 0;
    return Math.max(200, ancho - Math.max(0, tapado));
  }

  function redimensionar() {
    if (!abierto) return;
    densidad = window.devicePixelRatio || 1;
    const { width, height } = contenedor.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    for (const elemento of [lienzo, base]) {
      elemento.width = Math.round(width * densidad);
      elemento.height = Math.round(height * densidad);
    }
    lienzo.style.width = `${width}px`;
    lienzo.style.height = `${height}px`;
    // Arriba deja libre el logo y abajo las fuentes, que están sobre el mapa
    const logo = elementos.botonVolver.getBoundingClientRect();
    const fuente = vistaRio.querySelector('.fuente').getBoundingClientRect();
    window.Mapa.ajustar(anchoUtil(width), height, {
      arriba: Math.max(RELLENO_MAPA, logo.bottom + 20),
      abajo: Math.max(RELLENO_MAPA, height - fuente.top + 12),
      izquierda: RELLENO_MAPA,
      derecha: RELLENO_MAPA,
    }, width);
    redibujarBase();
    if (!iniciado) cursor = { x: anchoUtil(width) * 0.5, y: height * 0.55 };
  }

  function redibujarBase() {
    contextoBase.setTransform(densidad, 0, 0, densidad, 0, 0);
    window.Mapa.dibujarBase(contextoBase);
    minimapaSucio = true;
  }

  function dibujarMinimapa() {
    const caja = minimapa.getBoundingClientRect();
    if (caja.width === 0) return;
    const escala = window.devicePixelRatio || 1;
    const ancho = Math.round(caja.width * escala);
    const alto = Math.round(caja.height * escala);
    if (minimapa.width !== ancho || minimapa.height !== alto) {
      minimapa.width = ancho;
      minimapa.height = alto;
    }
    contextoMinimapa.setTransform(escala, 0, 0, escala, 0, 0);
    window.Mapa.dibujarMinimapa(contextoMinimapa, caja.width, caja.height);
    minimapaSucio = false;
  }

  // 3. Panel del tramo actual
  function mostrarTramo(tramo) {
    elementos.tramo.textContent = `${formato(tramo.km, 0)} km from the mouth`;
    // Los tramos que cierran huecos son de SWORD pero no tienen el nombre del río
    const tipo = TIPOS_TRAMO[tramo.tipo] || tramo.tipo;
    const encabezado = `Reach ${tramo.id}, ${tipo}${tramo.de_hueco ? ', unnamed in SWORD, closes a gap' : ''}`;
    if (!tramo.tieneDatos) {
      elementos.detalle.textContent = `${encabezado}, no good passes, silent`;
    } else if (tramo.pasadas === 0) {
      elementos.detalle.textContent = `${encabezado}, no good passes, values interpolated from its neighbours`;
    } else {
      const periodo = estacionDelRio() ? ` in ${ESTACIONES[estacionDelRio()].toLowerCase()}` : '';
      elementos.detalle.textContent = `${encabezado}, ${tramo.pasadas} good passes${periodo}`;
    }
    for (const capa of CAPAS) {
      const fila = filasCapas[capa.nombre];
      const valor = tramo.valor ? tramo.valor[capa.nombre] : null;
      if (valor === null || valor === undefined) {
        fila.valor.textContent = 'No data';
        fila.relleno.style.width = '0%';
        etiquetaCapa(capa);
        continue;
      }
      let texto = `${formato(valor, DECIMALES[capa.nombre])} ${window.Mapa.unidades[capa.nombre]}`;
      if (tramo.interpolado && tramo.interpolado[capa.nombre]) {
        texto += ', interpolated';
      } else if (tramo.corregido && tramo.corregido[capa.nombre] && tramo.medido) {
        texto += `, smoothed (SWOT measured ${formato(tramo.medido[capa.nombre], DECIMALES[capa.nombre])})`;
      }
      fila.valor.textContent = texto;
      fila.relleno.style.width = `${Math.round((tramo.norma[capa.nombre] || 0) * 100)}%`;
      etiquetaCapa(capa);
    }
  }

  // Panel sin tramo, al cargar un río
  function limpiarPanel() {
    elementos.tramo.textContent = 'Move the square over the river';
    elementos.detalle.textContent = '';
    for (const capa of CAPAS) {
      filasCapas[capa.nombre].valor.textContent = 'No reach';
      filasCapas[capa.nombre].relleno.style.width = '0%';
      etiquetaCapa(capa);
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
    cuadroPedido = false;
    if (!abierto) return;
    pedirCuadro();
    if (!window.Mapa.cargado) {
      dibujar(0);
      return;
    }
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
      elementos.estado.textContent = quieto ? 'Still, the orchestra holds the chord' : 'Moving, the music plays';
    }

    if (consulta.indice !== indiceAnterior) {
      indiceAnterior = consulta.indice;
      window.Sonido.fijarTramo(consulta.tramo);
      mostrarTramo(consulta.tramo);
      if (cercania > 0.5) anunciar(`${formato(consulta.tramo.km, 0)} kilometres from the mouth`);
    }
    if (minimapaSucio) dibujarMinimapa();
    dibujar(ganancia);
  }

  function pedirCuadro() {
    if (!cuadroPedido) {
      cuadroPedido = true;
      requestAnimationFrame(actualizar);
    }
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

  // 6. Datos de los ríos

  class ErrorDatos extends Error {
    constructor(titulo, texto) {
      super(texto);
      this.titulo = titulo;
    }
  }

  async function leerJson(nombre) {
    const ruta = `${carpetaDatos}/${nombre}`;
    let respuesta;
    try {
      respuesta = await fetch(ruta);
    } catch (error) {
      throw new ErrorDatos('Could not read the river data', `Reading ${ruta} failed`);
    }
    if (!respuesta.ok) {
      const pista = carpetaDatos === 'datos'
        ? 'Generate the data with scripts/procesar_rio.py or try ?carpeta=pruebas'
        : `Check that demo/${carpetaDatos} exists`;
      throw new ErrorDatos(`${ruta} not found`, pista);
    }
    try {
      return await respuesta.json();
    } catch (error) {
      throw new ErrorDatos('The river data is damaged', `${ruta} is not valid JSON`);
    }
  }

  // Lista de ríos con sus nombres en inglés, en el orden del menú. La usa también app.js.
  async function leerRios() {
    const indice = await leerJson('indice.json');
    const deDatos = (indice.rios || []).filter((rio) => nombreSimple(rio.id));
    if (deDatos.length === 0) throw new ErrorDatos('No rivers to show', `${carpetaDatos}/indice.json is empty`);
    const interfaz = window.RIOS_INTERFAZ || [];
    const ordenados = [];
    for (const rio of interfaz) {
      if (deDatos.some((otro) => otro.id === rio.id)) ordenados.push({ id: rio.id, nombre: rio.nombre });
    }
    for (const rio of deDatos) {
      if (!ordenados.some((otro) => otro.id === rio.id)) ordenados.push({ id: rio.id, nombre: rio.nombre || rio.id });
    }
    rios = ordenados;
    elementos.selector.innerHTML = '';
    rios.forEach((rio, k) => {
      const opcion = document.createElement('option');
      opcion.value = rio.id;
      opcion.textContent = `${k + 1}. ${rio.nombre}`;
      elementos.selector.appendChild(opcion);
    });
    elementos.selector.disabled = rios.length < 2;
    return rios;
  }

  // Lleva el título al ancho del panel, los nombres largos achican la letra
  function ajustarTitulo() {
    const titulo = elementos.titulo;
    titulo.style.fontSize = '';
    let tamano = parseFloat(getComputedStyle(titulo).fontSize);
    while (titulo.scrollWidth > titulo.clientWidth && tamano > 28) {
      tamano -= 2;
      titulo.style.fontSize = `${tamano}px`;
    }
  }

  // Los modos van en la dirección, junto con el hash que maneja app.js
  function actualizarDireccion() {
    const nueva = new URLSearchParams(location.search);
    nueva.delete('rio');
    if (modoNormalizacion === 'global') nueva.set('normalizacion', 'global');
    else nueva.delete('normalizacion');
    if (modoMusica !== 'original') nueva.set('musica', modoMusica);
    else nueva.delete('musica');
    if (estacionDelRio() && estacionDelRio() !== ESTACION_INICIAL) nueva.set('estacion', estacionDelRio());
    else nueva.delete('estacion');
    const consulta = nueva.toString();
    history.replaceState(history.state, '', `${location.pathname}${consulta ? `?${consulta}` : ''}${location.hash}`);
  }

  // Carga un río y lo deja listo para escuchar. Si mientras tanto se pidió otro, este se descarta.
  async function cargarRio(id) {
    const pedido = ++pedidoRio;
    const datos = await leerJson(`${id}.json`);
    if (pedido !== pedidoRio) return false;
    if (!Array.isArray(datos.tramos) || datos.tramos.length === 0) {
      throw new ErrorDatos('The river has no reaches', `${carpetaDatos}/${id}.json has no reaches`);
    }
    const estaciones = await leerEstaciones(id);
    if (pedido !== pedidoRio) return false;
    const nombre = nombreDe(id);
    window.Sonido.reiniciar();
    const traducciones = window.CIUDADES_INTERFAZ || {};
    datos.ciudades = (datos.ciudades || []).map(([ciudad, ...resto]) => [traducciones[ciudad] || ciudad, ...resto]);
    window.Mapa.cargar(datos, modoNormalizacion);
    rioActual = id;
    consultaActual = null;
    indiceAnterior = -1;
    cursorAnterior = null;
    estacionesRio = estaciones;
    mostrarEstaciones();
    aplicarEstacion();
    document.title = `${nombre} · The Melody of Water`;
    elementos.titulo.textContent = nombre;
    ajustarTitulo();
    lienzo.setAttribute('aria-label', `Map of the ${nombre} river. Move the square with the mouse or the arrow keys to listen to the river.`);
    elementos.selector.value = id;
    limpiarPanel();
    actualizarDireccion();
    redimensionar();
    return true;
  }

  elementos.selector.addEventListener('change', () => {
    const id = elementos.selector.value;
    if (callbacks.alCambiarRio) callbacks.alCambiarRio(id);
    else abrir(id);
  });

  // 6b. Estaciones del año. Cada tramo toma los valores de la estación elegida. Como en la
  // normalización, lo que está sonando no se corta, el cambio entra en la nota siguiente. Un río sin
  // archivo de estaciones suena con los valores de <id>.json, que son los del año entero.
  async function leerEstaciones(id) {
    try {
      const datos = await leerJson(`estaciones/${id}.json`);
      return datos && datos.estaciones ? datos.estaciones : null;
    } catch (error) {
      return null;
    }
  }

  function textoMeses(meses) {
    if (!Array.isArray(meses) || meses.length === 0) return '';
    const corto = (mes) => NOMBRES_MESES[mes - 1].slice(0, 3);
    return `${corto(meses[0])}–${corto(meses[meses.length - 1])}`;
  }

  function mostrarEstaciones() {
    const selector = elementos.selectorEstacion;
    selector.innerHTML = '';
    for (const [clave, titulo] of Object.entries(ESTACIONES)) {
      if (!estacionesRio || !estacionesRio[clave]) continue;
      const opcion = document.createElement('option');
      opcion.value = clave;
      opcion.textContent = `${titulo} · ${textoMeses(estacionesRio[clave].meses)}`;
      selector.appendChild(opcion);
    }
    if (selector.options.length === 0) {
      const sinEstaciones = document.createElement('option');
      sinEstaciones.textContent = 'No seasons yet';
      selector.appendChild(sinEstaciones);
      selector.disabled = true;
      return;
    }
    // Si el río no tiene la estación elegida, pasa a la primera que tenga
    if (!estacionDelRio()) estacionActual = selector.options[0].value;
    selector.value = estacionActual;
    selector.disabled = selector.options.length < 2;
  }

  // Copia en cada tramo los valores de la estación actual, y redibuja y actualiza el panel y el sonido
  function aplicarEstacion() {
    if (!estacionDelRio()) return;
    const estacion = estacionesRio[estacionDelRio()];
    for (const tramo of window.Mapa.tramos) {
      const valores = estacion.tramos[tramo.id];
      if (!valores) continue;
      for (const campo of CAMPOS_ESTACION) tramo[campo] = valores[campo];
    }
    window.Mapa.fijarNormalizacion(modoNormalizacion);
    redibujarBase();
    if (consultaActual) {
      window.Sonido.fijarTramo(consultaActual.tramo);
      mostrarTramo(consultaActual.tramo);
    }
  }

  elementos.selectorEstacion.addEventListener('change', () => {
    estacionActual = elementos.selectorEstacion.value;
    aplicarEstacion();
    actualizarDireccion();
    anunciar(ESTACIONES[estacionActual], true);
  });

  // Elige una estación sin pasar por el selector (comandos de voz). false si el río no la tiene.
  function fijarEstacion(clave) {
    if (!estacionesRio || !estacionesRio[clave]) return false;
    estacionActual = clave;
    elementos.selectorEstacion.value = clave;
    aplicarEstacion();
    actualizarDireccion();
    anunciar(ESTACIONES[estacionActual], true);
    return true;
  }

  // 7. Normalización. Cada tramo trae las dos y tramo.norma apunta a la elegida, que es lo que
  // leen el dibujo y el sonido. Lo que está sonando no se corta, el cambio entra en la nota siguiente.
  function mostrarModos() {
    const normalizacion = MODOS_NORMALIZACION[modoNormalizacion];
    const musica = MODOS_MUSICA[modoMusica];
    elementos.modoNormalizacion.textContent = normalizacion.titulo;
    elementos.modoMusica.textContent = musica.titulo;
    elementos.detalleModos.textContent = `${normalizacion.detalle}. ${musica.detalle}.`;
    elementos.botonNormalizacion.title = `${normalizacion.detalle} (N)`;
    elementos.botonMusica.title = `${musica.detalle} (M)`;
    elementos.botonNormalizacion.setAttribute('aria-label',
      `Scale ${normalizacion.titulo}, ${normalizacion.detalle.toLowerCase()}. Key N to switch`);
    elementos.botonMusica.setAttribute('aria-label',
      `Music ${musica.titulo}, ${musica.detalle.toLowerCase()}. Key M to switch`);
    // Con relieve, ancho y nivel cambian de instrumentos
    for (const capa of CAPAS) {
      capa.instrumento = window.Sonido.instrumentosDe(capa.nombre);
      filasCapas[capa.nombre].instrumento.textContent = capa.instrumento;
      etiquetaCapa(capa);
    }
  }

  function alternarNormalizacion() {
    modoNormalizacion = modoNormalizacion === 'propia' ? 'global' : 'propia';
    mostrarModos();
    if (window.Mapa.cargado) {
      window.Mapa.fijarNormalizacion(modoNormalizacion);
      redibujarBase();
      if (consultaActual) {
        window.Sonido.fijarTramo(consultaActual.tramo);
        mostrarTramo(consultaActual.tramo);
      }
      actualizarDireccion();
    }
    const modo = MODOS_NORMALIZACION[modoNormalizacion];
    anunciar(`Scale ${modo.titulo}, ${modo.detalle.toLowerCase()}`, true);
  }

  // 7b. Lógica musical. Pasa a la siguiente de MODOS_MUSICA, el cambio entra en la nota siguiente.
  function alternarMusica() {
    const nombres = Object.keys(MODOS_MUSICA);
    modoMusica = nombres[(nombres.indexOf(modoMusica) + 1) % nombres.length];
    window.Sonido.fijarMusica(modoMusica);
    mostrarModos();
    if (rioActual) actualizarDireccion();
    const modo = MODOS_MUSICA[modoMusica];
    anunciar(`Music ${modo.titulo}, ${modo.detalle.toLowerCase()}`, true);
  }

  elementos.botonNormalizacion.addEventListener('click', alternarNormalizacion);
  elementos.botonMusica.addEventListener('click', alternarMusica);
  window.Sonido.fijarMusica(modoMusica);
  mostrarModos();

  // 7c. Presentación hablada del río, en inglés. Suena al empezar a escuchar y cada vez que se abre
  // un río, y mientras habla la orquesta baja (locucion.js le pide a sonido.js que atenúe).
  function presentarRio() {
    if (iniciado && rioActual && abierto) window.Locucion.reproducirPresentacionRio(rioActual, IDIOMA_LOCUCION);
  }

  function repetirPresentacion() {
    if (!iniciado) {
      iniciar();
      return;
    }
    presentarRio();
  }

  elementos.botonLocucion.addEventListener('click', repetirPresentacion);

  // 7d. Zoom. Rueda del mouse sobre el mapa, teclas + y - (0 vuelve al río entero) y clic en el minimapa.
  function zoomEn(factor, px, py) {
    if (!window.Mapa.cargado) return;
    window.Mapa.fijarZoom(window.Mapa.zoom * factor, px, py);
    redibujarBase();
    indiceAnterior = -1;
  }

  lienzo.addEventListener('wheel', (evento) => {
    evento.preventDefault();
    const caja = lienzo.getBoundingClientRect();
    zoomEn(Math.exp(-evento.deltaY * 0.0015), evento.clientX - caja.left, evento.clientY - caja.top);
  }, { passive: false });

  function moverConMinimapa(evento) {
    const caja = minimapa.getBoundingClientRect();
    const punto = window.Mapa.desdeMinimapa(evento.clientX - caja.left, evento.clientY - caja.top);
    if (!punto) return;
    window.Mapa.centrarEn(...punto);
    redibujarBase();
    indiceAnterior = -1;
  }
  minimapa.addEventListener('pointerdown', (evento) => {
    minimapa.setPointerCapture(evento.pointerId);
    moverConMinimapa(evento);
  });
  minimapa.addEventListener('pointermove', (evento) => {
    if (minimapa.hasPointerCapture(evento.pointerId)) moverConMinimapa(evento);
  });

  // 8. Orquesta. app.js la empieza a cargar apenas abre la página, así cuando se elige un río ya
  // suele estar lista. Todo se lee con fetch, así que hace falta un servidor local.
  function mostrarPortada() {
    if (iniciado) {
      portada.hidden = true;
      return;
    }
    portada.hidden = false;
    if (errorOrquesta) {
      portada.disabled = true;
      tituloPortada.textContent = errorOrquesta.titulo;
      textoPortada.textContent = errorOrquesta.texto;
    } else if (!orquestaLista) {
      portada.disabled = true;
      tituloPortada.textContent = 'Loading the orchestra';
    } else {
      portada.disabled = false;
      tituloPortada.textContent = 'Click to listen to the river';
      textoPortada.textContent = TEXTO_PORTADA;
    }
  }

  function cargarOrquesta() {
    if (location.protocol === 'file:') {
      errorOrquesta = { titulo: 'Open the demo from a local server', texto: 'Run python -m http.server in this folder and go to http://localhost:8000' };
      mostrarPortada();
      return Promise.resolve(false);
    }
    return window.Sonido.cargar((avance) => {
      if (!orquestaLista && !errorOrquesta) textoPortada.textContent = `${Math.round(avance * 100)} %`;
    }).then(() => {
      orquestaLista = true;
      mostrarPortada();
      return true;
    }).catch((error) => {
      errorOrquesta = { titulo: 'Could not load the orchestra', texto: error.message };
      mostrarPortada();
      return false;
    });
  }

  // 9. Entrada
  async function iniciar() {
    if (iniciado || !orquestaLista || !abierto) return;
    iniciado = true;
    portada.hidden = true;
    dentroDelMapa = true;
    await window.Sonido.iniciar();
    indiceAnterior = -1;
    presentarRio();
    anunciar('Move the mouse or the arrow keys over the map. Keys 1 to 4 turn instruments on and off, N switches the scale, M the music, R replays the intro, plus and minus zoom, Escape goes back to the rivers.', true);
  }

  lienzo.addEventListener('pointermove', (evento) => {
    const caja = lienzo.getBoundingClientRect();
    moverCursor(evento.clientX - caja.left, evento.clientY - caja.top);
    dentroDelMapa = true;
  });
  lienzo.addEventListener('pointerleave', () => { dentroDelMapa = false; });
  lienzo.addEventListener('pointerdown', iniciar);
  portada.addEventListener('click', iniciar);
  elementos.botonVolver.addEventListener('click', () => { if (callbacks.alVolver) callbacks.alVolver(); });

  window.addEventListener('keydown', (evento) => {
    if (!abierto) return;
    // En los selectores de río y de estación las teclas son del selector
    if (evento.target === elementos.selector || evento.target === elementos.selectorEstacion) return;
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (evento.key === 'Escape') {
      evento.preventDefault();
      if (callbacks.alVolver) callbacks.alVolver();
      return;
    }
    if (!iniciado) {
      if (evento.key === 'Tab' || evento.key === 'Shift') return;
      evento.preventDefault();
      iniciar();
      return;
    }
    const capa = CAPAS.find((c) => c.tecla === evento.key);
    if (capa) {
      alternar(capa);
      return;
    }
    const tecla = evento.key.toLowerCase();
    if (tecla === 'n') { alternarNormalizacion(); return; }
    if (tecla === 'm') { alternarMusica(); return; }
    if (tecla === 'r') { repetirPresentacion(); return; }
    if (evento.key === '+' || evento.key === '=') { zoomEn(PASO_ZOOM, cursor.x, cursor.y); return; }
    if (evento.key === '-' || evento.key === '_') { zoomEn(1 / PASO_ZOOM, cursor.x, cursor.y); return; }
    if (evento.key === '0') { zoomEn(1 / window.Mapa.zoom); return; }
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

  window.addEventListener('resize', () => {
    redimensionar();
    if (abierto) ajustarTitulo();
  });
  document.fonts.ready.then(() => {
    redimensionar();
    if (abierto) ajustarTitulo();
  });

  // 10. Abrir y cerrar el tablero
  async function abrir(id) {
    abierto = true;
    // Si ya hubo un clic o una tecla en la página, el audio puede arrancar solo
    const conGesto = navigator.userActivation ? navigator.userActivation.hasBeenActive : false;
    mostrarPortada();
    window.Locucion.detener();
    try {
      if (!(await cargarRio(id))) return;
    } catch (error) {
      elementos.detalle.textContent = `${error.titulo || 'Could not load the river'}. ${error.message}`;
      anunciar(`Could not load the ${nombreDe(id)} river`, true);
      return;
    }
    anunciar(`${nombreDe(id)} river`, true);
    pedirCuadro();
    if (iniciado) {
      dentroDelMapa = true;
      presentarRio();
    } else if (conGesto) {
      await (orquestaListaPromesa || Promise.resolve());
      if (abierto && rioActual === id) iniciar();
    }
  }

  function cerrar() {
    abierto = false;
    dentroDelMapa = false;
    pedidoRio++;
    window.Locucion.detener();
    window.Sonido.fijarCercania(0, 0, 0);
    window.Sonido.reiniciar();
  }

  let orquestaListaPromesa = null;
  window.Tablero = {
    leerRios,
    abrir,
    cerrar,
    cargarOrquesta() {
      if (!orquestaListaPromesa) orquestaListaPromesa = cargarOrquesta();
      return orquestaListaPromesa;
    },
    // Lo mismo que hacen las teclas, para los comandos de voz (voz.js) u otros controles
    acciones: {
      iniciar,
      get iniciado() { return iniciado; },
      get orquestaLista() { return orquestaLista; },
      // Capa 1 a 4. estado 'on', 'off' o null para alternar. Devuelve si quedó prendida.
      fijarCapa(numero, estado) {
        const capa = CAPAS[numero - 1];
        if (!capa) return null;
        const activa = () => filasCapas[capa.nombre].boton.getAttribute('aria-pressed') === 'true';
        if (!estado || (estado === 'on') !== activa()) alternar(capa);
        return activa();
      },
      fijarEstacion,
      // 'propia', 'global' o null para alternar. Devuelve la que quedó.
      fijarNormalizacion(modo) {
        if (!modo || modo !== modoNormalizacion) alternarNormalizacion();
        return modoNormalizacion;
      },
      // Una de MODOS_MUSICA, o null para pasar a la siguiente. Devuelve la que quedó.
      fijarMusica(modo) {
        if (!modo || !MODOS_MUSICA[modo]) {
          alternarMusica();
        } else if (modo !== modoMusica) {
          const nombres = Object.keys(MODOS_MUSICA);
          // alternarMusica pasa a la siguiente; se cae justo en la pedida
          modoMusica = nombres[(nombres.indexOf(modo) - 1 + nombres.length) % nombres.length];
          alternarMusica();
        }
        return modoMusica;
      },
      repetirPresentacion,
      // 'in', 'out' o 'reset' (el río entero), como + − y 0
      zoom(direccion) {
        if (direccion === 'in') zoomEn(PASO_ZOOM, cursor.x, cursor.y);
        else if (direccion === 'out') zoomEn(1 / PASO_ZOOM, cursor.x, cursor.y);
        else if (window.Mapa.cargado) zoomEn(1 / window.Mapa.zoom);
      },
      estado() {
        return {
          rio: rioActual,
          capas: CAPAS.map((capa) => ({
            numero: Number(capa.tecla),
            titulo: capa.titulo,
            activa: filasCapas[capa.nombre].boton.getAttribute('aria-pressed') === 'true',
          })),
          estacion: estacionDelRio(),
          normalizacion: modoNormalizacion,
          musica: modoMusica,
        };
      },
    },
    alVolver(funcion) { callbacks.alVolver = funcion; },
    alCambiarRio(funcion) { callbacks.alCambiarRio = funcion; },
    get rios() { return rios; },
    get carpeta() { return carpetaDatos; },
  };
})();
