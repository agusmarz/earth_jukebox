// Interfaz de la demo. Un cuadrado que se mueve con el mouse (o con las flechas) sobre el mapa.
// Si el cuadrado toca el río suena fuerte, si se aleja baja el volumen, y el paneo indica
// hacia qué lado quedó el río.
// Los ríos se leen de CARPETA_DATOS/indice.json y CARPETA_DATOS/<id>.json. La dirección acepta
// ?rio=<id>, ?normalizacion=global, ?musica=dos_octavas, ?estacion=invierno, ?idioma=en (idioma de la
// presentación hablada de cada río) y ?carpeta=pruebas (para usar los datos de demo/pruebas). Las estaciones, si el río las tiene, están en CARPETA_DATOS/estaciones/<id>.json.

(function () {
  const CARPETA_DATOS = 'datos';
  const TECLA_NORMALIZACION = 'n';
  const MODOS_NORMALIZACION = {
    propia: { titulo: 'Propia', detalle: 'Cada río usa todo el rango sonoro' },
    global: { titulo: 'Global', detalle: 'La misma escala para todos los ríos' },
  };
  // Lógicas musicales de sonido.js, en el orden en que se recorren con la tecla M
  const TECLA_MUSICA = 'm';
  // Presentación hablada de cada río (locucion.js), en español o en inglés
  const TECLA_IDIOMA = 'l';
  const TECLA_REPETIR = 'r';
  const IDIOMAS = {
    es: { titulo: 'Español', detalle: 'Una voz presenta cada río al abrirlo, en español' },
    en: { titulo: 'Inglés', detalle: 'Una voz presenta cada río al abrirlo, en inglés' },
  };
  const MODOS_MUSICA = {
    original: { titulo: 'Original', detalle: 'El nivel mueve la melodía, la pendiente la cantidad de notas' },
    dos_octavas: { titulo: 'Dos octavas', detalle: 'Nivel y pendiente recorren dos octavas, de re a re y de la a la' },
    relieve: { titulo: 'Relieve', detalle: 'La melodía sigue el ancho, que cambia de tramo a tramo, y el nivel pasa a las cuerdas' },
  };
  // Estaciones de estaciones/<id>.json, en el orden del selector
  const ESTACIONES = {
    verano: 'Verano',
    otono: 'Otoño',
    invierno: 'Invierno',
    primavera: 'Primavera',
  };
  const NOMBRES_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // Lo que cambia de un tramo al pasar de una estación a otra. El resto (geometría, km, tipo) es igual.
  const CAMPOS_ESTACION = ['pasadas', 'valor', 'normas', 'corregido', 'medido', 'interpolado'];
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
    titulo: document.getElementById('titulo-rio'),
    selector: document.getElementById('selector-rio'),
    selectorEstacion: document.getElementById('selector-estacion'),
    botonNormalizacion: document.getElementById('boton-normalizacion'),
    modoNormalizacion: document.getElementById('modo-normalizacion'),
    detalleNormalizacion: document.getElementById('detalle-normalizacion'),
    botonMusica: document.getElementById('boton-musica'),
    modoMusica: document.getElementById('modo-musica'),
    detalleMusica: document.getElementById('detalle-musica'),
    botonIdioma: document.getElementById('boton-idioma'),
    detalleIdioma: document.getElementById('detalle-idioma'),
    marcasIdioma: { es: document.getElementById('idioma-es'), en: document.getElementById('idioma-en') },
    botonLocucion: document.getElementById('boton-locucion'),
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

  // Parámetros de la dirección. Solo se aceptan nombres simples, para que no se pueda pedir
  // cualquier ruta
  const parametros = new URLSearchParams(location.search);
  const nombreSimple = (texto) => (texto && /^[a-z0-9_-]+$/i.test(texto) ? texto : null);
  const carpetaDatos = nombreSimple(parametros.get('carpeta')) || CARPETA_DATOS;
  let modoNormalizacion = parametros.get('normalizacion') === 'global' ? 'global' : 'propia';
  let modoMusica = MODOS_MUSICA[parametros.get('musica')] ? parametros.get('musica') : 'original';
  let idiomaActual = IDIOMAS[parametros.get('idioma')] ? parametros.get('idioma') : 'es';
  let rioActual = null;
  let rios = [];
  let pedidoRio = 0;
  // Estación elegida, que se mantiene al cambiar de río, y estaciones del río cargado (null si no tiene).
  // Sin el parámetro arranca con la primera de ESTACIONES.
  const ESTACION_INICIAL = Object.keys(ESTACIONES)[0];
  let estacionActual = ESTACIONES[parametros.get('estacion')] ? parametros.get('estacion') : ESTACION_INICIAL;
  let estacionesRio = null;
  // Estación que suena en el río cargado, o null si el río no tiene estaciones
  const estacionDelRio = () => (estacionesRio && estacionesRio[estacionActual] ? estacionActual : null);

  function moverCursor(x, y) {
    if (Math.abs(x - cursor.x) < 0.5 && Math.abs(y - cursor.y) < 0.5) return;
    cursor = { x, y };
    ultimoMovimiento = performance.now();
  }

  const formato = (numero, decimales) =>
    numero.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const DECIMALES = { ancho: 0, nivel: 1, pendiente: 1, amplitud: 1 };

  // 1. Lista de capas en el panel
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
      instrumento: boton.querySelector('.instrumento'),
      relleno: boton.querySelector('.relleno'),
    };
  }

  const filasCapas = {};
  for (const capa of CAPAS) {
    filasCapas[capa.nombre] = crearFila(capa.tecla, capa.titulo, capa.instrumento, 'Sin tramo', () => alternar(capa));
  }

  function alternar(capa) {
    const activa = window.Sonido.alternarCapa(capa.nombre);
    filasCapas[capa.nombre].boton.setAttribute('aria-pressed', String(activa));
    window.Sonido.confirmar(activa);
    anunciar(`${capa.titulo} ${activa ? 'prendido' : 'apagado'}`, true);
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
    // Los tramos que cierran huecos son de SWORD pero no tienen el nombre del río
    const encabezado = `Tramo ${tramo.id}, ${tramo.tipo}${tramo.de_hueco ? ', sin nombre en SWORD, cierra un hueco del cauce' : ''}`;
    if (!tramo.tieneDatos) {
      elementos.detalle.textContent = `${encabezado}, sin pasadas buenas, no suena`;
    } else if (tramo.pasadas === 0) {
      elementos.detalle.textContent = `${encabezado}, sin pasadas buenas, valores interpolados entre los tramos vecinos`;
    } else {
      const periodo = estacionDelRio() ? ` en ${ESTACIONES[estacionDelRio()].toLowerCase()}` : '';
      elementos.detalle.textContent = `${encabezado}, ${tramo.pasadas} pasadas buenas${periodo}`;
    }
    for (const capa of CAPAS) {
      const fila = filasCapas[capa.nombre];
      const valor = tramo.valor ? tramo.valor[capa.nombre] : null;
      if (valor === null || valor === undefined) {
        fila.valor.textContent = 'Sin dato';
        fila.relleno.style.width = '0%';
        continue;
      }
      let texto = `${formato(valor, DECIMALES[capa.nombre])} ${window.Mapa.unidades[capa.nombre]}`;
      if (tramo.interpolado && tramo.interpolado[capa.nombre]) {
        texto += ', interpolado';
      } else if (tramo.corregido && tramo.corregido[capa.nombre] && tramo.medido) {
        texto += `, suavizado (SWOT midió ${formato(tramo.medido[capa.nombre], DECIMALES[capa.nombre])})`;
      }
      fila.valor.textContent = texto;
      fila.relleno.style.width = `${Math.round((tramo.norma[capa.nombre] || 0) * 100)}%`;
    }
  }

  // Panel sin tramo, al cargar un río
  function limpiarPanel() {
    elementos.tramo.textContent = 'Mové el cuadrado sobre el río';
    elementos.detalle.textContent = '';
    for (const capa of CAPAS) {
      filasCapas[capa.nombre].valor.textContent = 'Sin tramo';
      filasCapas[capa.nombre].relleno.style.width = '0%';
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
    if (!window.Mapa.cargado) {
      dibujar(0);
      requestAnimationFrame(actualizar);
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
      elementos.estado.textContent = quieto ? 'Quieto, la orquesta sostiene el acorde' : 'En movimiento, suena la música';
    }

    if (consulta.indice !== indiceAnterior) {
      indiceAnterior = consulta.indice;
      window.Sonido.fijarTramo(consulta.tramo);
      mostrarTramo(consulta.tramo);
      if (cercania > 0.5) anunciar(`A ${formato(consulta.tramo.km, 0)} kilómetros de la desembocadura`);
    }
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
      throw new ErrorDatos('No se pudieron leer los datos del río', `Falló la lectura de ${ruta}`);
    }
    if (!respuesta.ok) {
      const pista = carpetaDatos === CARPETA_DATOS
        ? 'Generá los datos con scripts/procesar_rio.py o probá con ?carpeta=pruebas'
        : `Revisá que exista la carpeta demo/${carpetaDatos}`;
      throw new ErrorDatos(`No encontré ${ruta}`, pista);
    }
    try {
      return await respuesta.json();
    } catch (error) {
      throw new ErrorDatos('Los datos del río están dañados', `${ruta} no es un JSON válido`);
    }
  }

  async function cargarIndice() {
    const indice = await leerJson('indice.json');
    rios = (indice.rios || []).filter((rio) => nombreSimple(rio.id));
    if (rios.length === 0) throw new ErrorDatos('No hay ríos para mostrar', `${carpetaDatos}/indice.json está vacío`);
    elementos.selector.innerHTML = '';
    for (const rio of rios) {
      const opcion = document.createElement('option');
      opcion.value = rio.id;
      opcion.textContent = rio.nombre;
      elementos.selector.appendChild(opcion);
    }
    elementos.selector.disabled = rios.length < 2;
    const pedido = nombreSimple(parametros.get('rio'));
    return rios.some((rio) => rio.id === pedido) ? pedido : rios[0].id;
  }

  // Lleva el título al ancho del panel, los nombres largos achican la letra
  function ajustarTitulo() {
    const titulo = elementos.titulo;
    titulo.style.fontSize = '';
    let tamano = parseFloat(getComputedStyle(titulo).fontSize);
    while (titulo.scrollWidth > titulo.clientWidth && tamano > 36) {
      tamano -= 2;
      titulo.style.fontSize = `${tamano}px`;
    }
  }

  function actualizarDireccion() {
    const nueva = new URLSearchParams(location.search);
    nueva.set('rio', rioActual);
    if (modoNormalizacion === 'global') nueva.set('normalizacion', 'global');
    else nueva.delete('normalizacion');
    if (modoMusica !== 'original') nueva.set('musica', modoMusica);
    else nueva.delete('musica');
    if (estacionDelRio()) nueva.set('estacion', estacionDelRio());
    else nueva.delete('estacion');
    if (idiomaActual !== 'es') nueva.set('idioma', idiomaActual);
    else nueva.delete('idioma');
    history.replaceState(null, '', `${location.pathname}?${nueva}`);
  }

  // Carga un río y lo deja listo para escuchar. Si mientras tanto se pidió otro, este se descarta.
  async function cargarRio(id) {
    const pedido = ++pedidoRio;
    const datos = await leerJson(`${id}.json`);
    if (pedido !== pedidoRio) return false;
    if (!Array.isArray(datos.tramos) || datos.tramos.length === 0) {
      throw new ErrorDatos('El río no tiene tramos', `${carpetaDatos}/${id}.json no trae tramos`);
    }
    const estaciones = await leerEstaciones(id);
    if (pedido !== pedidoRio) return false;
    const nombre = datos.nombre || id;
    window.Sonido.reiniciar();
    window.Mapa.cargar(datos, modoNormalizacion);
    rioActual = id;
    consultaActual = null;
    indiceAnterior = -1;
    cursorAnterior = null;
    estacionesRio = estaciones;
    mostrarEstaciones();
    aplicarEstacion();
    document.title = `${nombre}, mapa sonoro`;
    elementos.titulo.textContent = nombre;
    ajustarTitulo();
    lienzo.setAttribute('aria-label', `Mapa del río ${nombre}. Mové el cuadrado con el mouse o las flechas para escuchar el río.`);
    elementos.selector.value = id;
    limpiarPanel();
    actualizarDireccion();
    redimensionar();
    return true;
  }

  elementos.selector.addEventListener('change', async () => {
    const id = elementos.selector.value;
    const nombre = elementos.selector.selectedOptions[0].textContent;
    // Si se cambia rápido de río, la presentación del anterior se corta enseguida
    window.Locucion.detener();
    try {
      if (await cargarRio(id)) {
        anunciar(`Río ${nombre}`, true);
        presentarRio();
      }
    } catch (error) {
      elementos.selector.value = rioActual;
      elementos.detalle.textContent = `${error.titulo || 'No se pudo cargar el río'}. ${error.message}`;
      anunciar(`No se pudo cargar el río ${nombre}`, true);
    }
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
    return `${NOMBRES_MESES[meses[0] - 1]} a ${NOMBRES_MESES[meses[meses.length - 1] - 1]}`;
  }

  function mostrarEstaciones() {
    const selector = elementos.selectorEstacion;
    selector.innerHTML = '';
    for (const [clave, titulo] of Object.entries(ESTACIONES)) {
      if (!estacionesRio || !estacionesRio[clave]) continue;
      const opcion = document.createElement('option');
      opcion.value = clave;
      opcion.textContent = `${titulo}, ${textoMeses(estacionesRio[clave].meses)}`;
      selector.appendChild(opcion);
    }
    if (selector.options.length === 0) {
      const sinEstaciones = document.createElement('option');
      sinEstaciones.textContent = 'Este río todavía no tiene estaciones';
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
    window.Mapa.dibujarBase(contextoBase);
    if (consultaActual) {
      window.Sonido.fijarTramo(consultaActual.tramo);
      mostrarTramo(consultaActual.tramo);
    }
  }

  elementos.selectorEstacion.addEventListener('change', () => {
    estacionActual = elementos.selectorEstacion.value;
    aplicarEstacion();
    actualizarDireccion();
  });

  // 7. Normalización. Cada tramo trae las dos y tramo.norma apunta a la elegida, que es lo que
  // leen el dibujo y el sonido. Lo que está sonando no se corta, el cambio entra en la nota siguiente.
  function mostrarNormalizacion() {
    const modo = MODOS_NORMALIZACION[modoNormalizacion];
    const otro = MODOS_NORMALIZACION[modoNormalizacion === 'propia' ? 'global' : 'propia'];
    elementos.modoNormalizacion.textContent = modo.titulo;
    elementos.detalleNormalizacion.textContent = modo.detalle;
    elementos.botonNormalizacion.setAttribute(
      'aria-label', `Normalización ${modo.titulo.toLowerCase()}, ${modo.detalle.toLowerCase()}. Tecla N para pasar a ${otro.titulo.toLowerCase()}`,
    );
  }

  function alternarNormalizacion() {
    modoNormalizacion = modoNormalizacion === 'propia' ? 'global' : 'propia';
    mostrarNormalizacion();
    if (window.Mapa.cargado) {
      window.Mapa.fijarNormalizacion(modoNormalizacion);
      window.Mapa.dibujarBase(contextoBase);
      if (consultaActual) {
        window.Sonido.fijarTramo(consultaActual.tramo);
        mostrarTramo(consultaActual.tramo);
      }
      actualizarDireccion();
    }
    const modo = MODOS_NORMALIZACION[modoNormalizacion];
    anunciar(`Normalización ${modo.titulo.toLowerCase()}, ${modo.detalle.toLowerCase()}`, true);
  }

  elementos.botonNormalizacion.addEventListener('click', alternarNormalizacion);
  mostrarNormalizacion();

  // 7b. Lógica musical. Pasa a la siguiente de MODOS_MUSICA, el cambio entra en la nota siguiente.
  function mostrarMusica() {
    const nombres = Object.keys(MODOS_MUSICA);
    const modo = MODOS_MUSICA[modoMusica];
    const otro = MODOS_MUSICA[nombres[(nombres.indexOf(modoMusica) + 1) % nombres.length]];
    elementos.modoMusica.textContent = modo.titulo;
    // Con relieve, ancho y nivel cambian de instrumentos
    for (const capa of CAPAS) {
      capa.instrumento = window.Sonido.instrumentosDe(capa.nombre);
      filasCapas[capa.nombre].instrumento.textContent = capa.instrumento;
    }
    elementos.detalleMusica.textContent = modo.detalle;
    elementos.botonMusica.setAttribute(
      'aria-label', `Música ${modo.titulo.toLowerCase()}, ${modo.detalle.toLowerCase()}. Tecla M para pasar a ${otro.titulo.toLowerCase()}`,
    );
  }

  function alternarMusica() {
    const nombres = Object.keys(MODOS_MUSICA);
    modoMusica = nombres[(nombres.indexOf(modoMusica) + 1) % nombres.length];
    window.Sonido.fijarMusica(modoMusica);
    mostrarMusica();
    if (rioActual) actualizarDireccion();
    const modo = MODOS_MUSICA[modoMusica];
    anunciar(`Música ${modo.titulo.toLowerCase()}, ${modo.detalle.toLowerCase()}`, true);
  }

  elementos.botonMusica.addEventListener('click', alternarMusica);
  window.Sonido.fijarMusica(modoMusica);
  mostrarMusica();

  // 7c. Presentación hablada del río. Suena al empezar a escuchar y cada vez que se abre un río, y
  // mientras habla la orquesta baja (locucion.js le pide a sonido.js que atenúe la ganancia maestra).
  function presentarRio() {
    if (iniciado && rioActual) window.Locucion.reproducirPresentacionRio(rioActual, idiomaActual);
  }

  function mostrarIdioma() {
    const otro = idiomaActual === 'es' ? 'en' : 'es';
    for (const [clave, marca] of Object.entries(elementos.marcasIdioma)) {
      marca.classList.toggle('idioma-activo', clave === idiomaActual);
    }
    elementos.detalleIdioma.textContent = IDIOMAS[idiomaActual].detalle;
    elementos.botonIdioma.setAttribute(
      'aria-label', `Idioma de la presentación, ${IDIOMAS[idiomaActual].titulo.toLowerCase()}. Tecla L para pasar a ${IDIOMAS[otro].titulo.toLowerCase()}`,
    );
  }

  // Al cambiar el idioma se vuelve a presentar el río, así se escucha el cambio
  function alternarIdioma() {
    idiomaActual = idiomaActual === 'es' ? 'en' : 'es';
    mostrarIdioma();
    if (rioActual) actualizarDireccion();
    presentarRio();
  }

  function repetirPresentacion() {
    if (!iniciado) {
      iniciar();
      return;
    }
    presentarRio();
  }

  elementos.botonIdioma.addEventListener('click', alternarIdioma);
  elementos.botonLocucion.addEventListener('click', repetirPresentacion);
  mostrarIdioma();

  // 8. Carga inicial de la orquesta y del primer río. Todo se lee con fetch, así que hace falta
  // un servidor local.
  const tituloPortada = portada.querySelector('.portada-titulo');
  const textoPortada = portada.querySelector('.portada-texto');
  const textoListo = textoPortada.textContent;
  tituloPortada.textContent = 'Cargando la orquesta';

  function mostrarErrorPortada(titulo, texto) {
    portada.disabled = true;
    tituloPortada.textContent = titulo;
    textoPortada.textContent = texto;
  }

  if (location.protocol === 'file:') {
    mostrarErrorPortada('Abrí la demo desde un servidor local', 'En esta carpeta corré python -m http.server y entrá a http://localhost:8000');
  } else {
    const cargaOrquesta = window.Sonido.cargar((avance) => {
      if (!portada.disabled) textoPortada.textContent = `${Math.round(avance * 100)} %`;
    });
    const cargaPrimerRio = cargarIndice().then(cargarRio);
    Promise.all([cargaOrquesta, cargaPrimerRio]).then(() => {
      listo = true;
      tituloPortada.textContent = 'Tocá para escuchar el río';
      textoPortada.textContent = textoListo;
    }).catch((error) => {
      if (error instanceof ErrorDatos) mostrarErrorPortada(error.titulo, error.message);
      else mostrarErrorPortada('No se pudo cargar la orquesta', error.message);
    });
  }

  // 9. Entrada
  async function iniciar() {
    if (iniciado || !listo) return;
    iniciado = true;
    portada.hidden = true;
    dentroDelMapa = true;
    await window.Sonido.iniciar();
    indiceAnterior = -1;
    presentarRio();
    anunciar('Mové el mouse o las flechas por el mapa. Teclas 1 a 4 para prender y apagar instrumentos, N para cambiar la normalización, M para cambiar la música, L para el idioma de la presentación y R para repetirla.', true);
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
    // En los selectores de río y de estación las teclas son del selector
    if (evento.target === elementos.selector || evento.target === elementos.selectorEstacion) return;
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
    if (evento.key.toLowerCase() === TECLA_NORMALIZACION && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
      alternarNormalizacion();
      return;
    }
    if (evento.key.toLowerCase() === TECLA_MUSICA && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
      alternarMusica();
      return;
    }
    if (evento.key.toLowerCase() === TECLA_IDIOMA && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
      alternarIdioma();
      return;
    }
    if (evento.key.toLowerCase() === TECLA_REPETIR && !evento.ctrlKey && !evento.metaKey && !evento.altKey) {
      repetirPresentacion();
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

  window.addEventListener('resize', () => {
    redimensionar();
    ajustarTitulo();
  });
  document.fonts.ready.then(() => {
    redimensionar();
    ajustarTitulo();
  });
  redimensionar();
  requestAnimationFrame(actualizar);
})();
