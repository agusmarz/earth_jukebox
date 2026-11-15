// Motor de sonido de la demo. Una orquesta de muestras grabadas (VSCO 2 Community Edition, CC0),
// con cuatro capas, una por característica del tramo.
//   ancho      cuerdas, un río angosto suena con los chelos solos y uno ancho con violas y violines
//   nivel      melodía en maderas, al subir el agua pasa del fagot al clarinete, al oboe y a la flauta
//   pendiente  arpa y timbal, más pendiente más notas de arpa por compás
//   amplitud   contrabajo y cornos, cuanto más sube y baja el agua más se mueve el bajo y más crecen los cornos
// Todas las capas suenan siempre en el mismo tempo y la misma armonía. Lo que cambia con el
// tramo son sus parámetros, y lo que cambia con la distancia al río es el volumen, el paneo y
// cuánta sala se escucha.
// Cada tramo que cruza el cuadrado dispara una nota de la melodía en la próxima semicorchea, así
// que la melodía nunca toca más rápido que eso. Si en una semicorchea se cruzaron varios tramos,
// suena una sola nota que los resume (promedio de ancho y nivel, máximo de pendiente y amplitud).
// Si el cuadrado se queda quieto, la orquesta hace una fermata sobre el acorde que estaba
// sonando. Cada nota se sostiene hasta que su grabación se apaga del todo y ahí se vuelve a
// disparar, en bucle. Al volver a moverse vuelve la música.
// Hay tres lógicas musicales, que se eligen con Sonido.fijarMusica.
//   original      la de siempre, el nivel mueve la melodía unos 22 semitonos y el motivo de cada
//                 tramo suma saltos de hasta una octava, la pendiente solo cambia cuántas notas
//                 toca el arpa
//   dos_octavas   el nivel lleva la melodía exactamente de re3 a re5 y el motivo queda como un
//                 adorno chico, así se escucha el dato y no el azar. La pendiente además sube el
//                 registro del arpa dos octavas, de la2 a la4. Ancho y amplitud no cambian.
//   relieve       la melodía toma el ancho (que cambia de tramo a tramo) y las cuerdas el nivel
//                 (que baja parejo hacia la desembocadura). Ver MUSICAS.
// Las muestras se leen con fetch, así que la demo tiene que abrirse desde un servidor local.

(function () {
  const BPM = 80;
  const SEMICORCHEA = 60 / BPM / 4;
  const COMPAS = SEMICORCHEA * 16;
  const ANTICIPACION = 0.12;

  // Progresión en re menor, i VI III VII. Las voces de las cuerdas van ordenadas por importancia,
  // así un río angosto suena con la fundamental sola y uno ancho con el acorde completo.
  const ACORDES = [
    { bajo: 38, voces: [50, 57, 53, 60, 64, 69] },
    { bajo: 34, voces: [46, 53, 50, 57, 60, 65] },
    { bajo: 41, voces: [53, 60, 57, 64, 67, 72] },
    { bajo: 36, voces: [48, 55, 52, 59, 62, 67] },
  ];
  const PENTATONICA = [0, 3, 5, 7, 10];
  const NOTA_BASE_MELODIA = 50;
  const MADERAS = ['fagot', 'clarinete', 'oboe', 'flauta'];

  // Lógicas musicales. gradosNivel es cuántos grados de la pentatónica recorre la nota base de la
  // melodía entre el nivel mínimo y el máximo (5 grados son una octava). adorno lleva el grado del
  // motivo (0 a 5) a lo que se suma sobre esa nota base. El arpa del modo dos_octavas arranca su
  // arpegio en PISO_ARPA más hasta RANGO_ARPA semitonos según la pendiente.
  // variables dice qué característica del tramo toca cada grupo de instrumentos. Las teclas 1 a 4
  // prenden y apagan características, así que siempre apagan el grupo que la está tocando.
  const VARIABLES_CLASICAS = { cuerdas: 'ancho', maderas: 'nivel', arpa: 'pendiente', bajo: 'amplitud' };
  const MUSICAS = {
    original: { variables: VARIABLES_CLASICAS, gradosNivel: 9, adorno: (grado) => grado, arpa: 'fija', bajo: 'patrones' },
    dos_octavas: { variables: VARIABLES_CLASICAS, gradosNivel: 10, adorno: (grado) => Math.floor(grado / 2), arpa: 'amplia', bajo: 'patrones' },
    // relieve. El nivel es la altura del agua sobre el mar y baja parejo hacia la desembocadura,
    // así que entre dos tramos vecinos casi no cambia (dice dónde estás, no cómo es el tramo).
    // Por eso pasa a las cuerdas, que dan el color de fondo, y la melodía toma el ancho, que
    // cambia de un tramo a otro. La melodía recorre dos octavas de la escala menor (el doble de
    // notas que la pentatónica), no tiene saltos al azar (el motivo solo pone el ritmo) y corre
    // las notas que rozan el acorde a un semitono. El arpa va arriba de la melodía para no taparla
    // y el bajo cambia de a una nota por compás en lugar de tener tres patrones.
    relieve: {
      variables: { cuerdas: 'nivel', maderas: 'ancho', arpa: 'pendiente', bajo: 'amplitud' },
      arpa: 'arriba', bajo: 'continuo',
    },
  };
  const PISO_ARPA = 45;
  const RANGO_ARPA = 24;
  const PISO_ARPA_ARRIBA = 74; // re5, la nota más aguda de la melodía en relieve
  const ESCALA_MENOR = [0, 2, 3, 5, 7, 8, 10];
  const GRADOS_RELIEVE = 14; // dos octavas de la escala menor, de re3 a re5
  const NOTAS_BAJO = [0, 7, 12, 7, 0, 12, 7, 12]; // fundamental, quinta y octava, en este orden

  // Patrones del contrabajo según la amplitud, [paso, semitonos sobre la fundamental, duración en semicorcheas]
  const PATRONES_BAJO = [
    [[0, 0, 15]],
    [[0, 0, 7], [8, 7, 7]],
    [[0, 0, 3], [4, 12, 3], [8, 7, 3], [12, 12, 2], [14, 0, 2]],
  ];

  // Nivel de cada instrumento en la mezcla, sobre la ganancia que ya los empareja en sonoridad
  const MEZCLA = {
    violines: 0.2, violas: 0.2, chelos: 0.24, contrabajo: 0.5, arpa: 0.22,
    fagot: 0.85, clarinete: 0.72, oboe: 0.72, flauta: 0.8, corno: 0.32, timbal: 0.2,
  };

  // Ganancia maestra, y cuánto baja (en veces) mientras habla la locución de presentación del río
  const GANANCIA_MAESTRA = 1.5;
  const ATENUACION_LOCUCION = 0.2;
  // Cómo se resumen varios tramos cruzados en una misma semicorchea. Pendiente y amplitud toman
  // el máximo para que un pico no se pierda entre tramos comunes.
  const RESUMEN = { ancho: 'promedio', nivel: 'promedio', pendiente: 'maximo', amplitud: 'maximo' };

  const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

  let contexto = null;
  let nodos = null;
  let carga = null;
  let tramoActual = null;
  let pasoActual = 0;
  let proximoPaso = 0;
  let reloj = null;
  let quieto = true;
  let golpesArpa = 0;
  let cruzados = [];
  let ultimoRegistrado = null;
  let pasosDesdeEntrada = Infinity;
  let vozMelodia = null;
  let retomarAlFijar = false;
  let musica = 'original';
  const motivos = new Map();
  // Todas las notas que están sonando o programadas, para poder cortarlas al cambiar de río
  const vocesActivas = new Set();
  const muestras = {};

  const capas = {
    ancho: { activa: true },
    nivel: { activa: true },
    pendiente: { activa: true },
    amplitud: { activa: true },
  };

  // 1. Carga de las muestras

  async function cargarMuestras(alProgresar) {
    if (location.protocol === 'file:') {
      throw new Error('servidor');
    }
    const indice = window.MUESTRAS.instrumentos;
    const pedidos = [];
    for (const [nombre, instrumento] of Object.entries(indice)) {
      muestras[nombre] = { ganancia: instrumento.ganancia, notas: [] };
      for (const nota of instrumento.notas) pedidos.push({ nombre, nota });
    }
    let listas = 0;
    await Promise.all(pedidos.map(async ({ nombre, nota }) => {
      const respuesta = await fetch(`muestras/${nota.archivo}`);
      if (!respuesta.ok) throw new Error(`No se pudo leer muestras/${nota.archivo}`);
      const buffer = await contexto.decodeAudioData(await respuesta.arrayBuffer());
      muestras[nombre].notas.push({ midi: nota.midi, buffer });
      listas += 1;
      if (alProgresar) alProgresar(listas / pedidos.length);
    }));
    for (const instrumento of Object.values(muestras)) instrumento.notas.sort((a, b) => a.midi - b.midi);
  }

  // 2. Sampler. Busca la grabación más cercana a la nota pedida y la acelera o la frena
  // para llegar a la altura justa, 2^(1/12) veces por semitono.

  function muestraMasCercana(nombre, midi) {
    let mejor = null;
    for (const nota of muestras[nombre].notas) {
      if (!mejor || Math.abs(nota.midi - midi) < Math.abs(mejor.midi - midi)) mejor = nota;
    }
    return mejor;
  }

  // Toca una nota. Sin duración, la grabación suena entera hasta apagarse sola.
  // Devuelve la voz, con el momento en que termina y una función para cortarla.
  function tocar(nombre, midi, tiempo, opciones) {
    const { destino, volumen = 1, duracion = null, ataque = 0.02, liberacion = 0.4, forma = null } = opciones;
    const muestra = muestraMasCercana(nombre, midi);
    const velocidad = 2 ** ((midi - muestra.midi) / 12);
    const fuente = contexto.createBufferSource();
    fuente.buffer = muestra.buffer;
    fuente.playbackRate.value = velocidad;
    const ganancia = contexto.createGain();
    const nivel = volumen * MEZCLA[nombre] * Math.min(muestras[nombre].ganancia, 1.6);
    const largo = muestra.buffer.duration / velocidad;
    let fin = tiempo + largo;

    ganancia.gain.setValueAtTime(0, tiempo);
    if (forma) {
      forma(ganancia.gain, tiempo, nivel);
    } else {
      ganancia.gain.linearRampToValueAtTime(nivel, tiempo + ataque);
    }
    if (duracion !== null) {
      const corte = tiempo + Math.max(duracion, ataque);
      if (!forma) ganancia.gain.setValueAtTime(nivel, corte);
      ganancia.gain.setTargetAtTime(0, corte, liberacion / 4);
      fin = Math.min(fin, corte + liberacion * 1.5);
    }
    fuente.connect(ganancia).connect(destino);
    fuente.start(tiempo);
    fuente.stop(fin);

    const voz = {
      fin,
      apagar(momento, salida = 0.4) {
        if (momento >= fin) return;
        if (ganancia.gain.cancelAndHoldAtTime) ganancia.gain.cancelAndHoldAtTime(momento);
        else ganancia.gain.cancelScheduledValues(momento);
        ganancia.gain.setTargetAtTime(0, momento, salida / 4);
        try { fuente.stop(Math.max(momento, tiempo) + salida * 1.5); } catch (error) { /* ya estaba detenida */ }
      },
    };
    vocesActivas.add(voz);
    fuente.onended = () => vocesActivas.delete(voz);
    return voz;
  }

  // 3. Grafo de audio

  function crearReverb() {
    const duracion = 3.2;
    const largo = Math.floor(contexto.sampleRate * duracion);
    const impulso = contexto.createBuffer(2, largo, contexto.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const datos = impulso.getChannelData(canal);
      for (let k = 0; k < largo; k++) datos[k] = (Math.random() * 2 - 1) * (1 - k / largo) ** 4;
    }
    const convolucion = contexto.createConvolver();
    convolucion.buffer = impulso;
    return convolucion;
  }

  function crearGrafo() {
    const maestro = contexto.createGain();
    maestro.gain.value = GANANCIA_MAESTRA;
    const compresor = contexto.createDynamicsCompressor();
    compresor.threshold.value = -14;
    compresor.ratio.value = 3;
    compresor.attack.value = 0.02;
    compresor.release.value = 0.3;
    maestro.connect(compresor).connect(contexto.destination);

    // La cercanía al río controla el volumen, el paneo indica hacia qué lado está y la
    // distancia suma sala y apaga los agudos, como escuchar el ensayo desde el pasillo
    const cercania = contexto.createGain();
    cercania.gain.value = 0;
    const distancia = contexto.createBiquadFilter();
    distancia.type = 'lowpass';
    distancia.frequency.value = 18000;
    distancia.Q.value = 0.5;
    const paneo = contexto.createStereoPanner();
    const seco = contexto.createGain();
    const envioReverb = contexto.createGain();
    envioReverb.gain.value = 0.3;
    const reverb = crearReverb();
    cercania.connect(distancia).connect(paneo);
    paneo.connect(seco).connect(maestro);
    paneo.connect(envioReverb).connect(reverb).connect(maestro);

    // Cada capa pasa por dos ganancias, una de dato (se apaga si el tramo no tiene ese valor)
    // y otra de usuario (las teclas 1 a 4). Adelante tiene dos entradas, la de la música en
    // movimiento y la de la fermata, que se cruzan cuando el cuadrado se queda quieto.
    for (const nombre of Object.keys(capas)) {
      const movimiento = contexto.createGain();
      const fermata = contexto.createGain();
      fermata.gain.value = 0;
      const dato = contexto.createGain();
      const salida = contexto.createGain();
      salida.gain.value = capas[nombre].activa ? 1 : 0;
      movimiento.connect(dato);
      fermata.connect(dato);
      dato.connect(salida).connect(cercania);
      Object.assign(capas[nombre], { movimiento, fermata, dato, salida });
    }

    // Cuerdas, una ganancia por voz del acorde (así el ancho prende y apaga voces al instante)
    // y un filtro que da el brillo, más cerrado en un río angosto
    const filtroCuerdas = contexto.createBiquadFilter();
    filtroCuerdas.type = 'lowpass';
    filtroCuerdas.frequency.value = 2000;
    filtroCuerdas.Q.value = 0.5;
    const vocesCuerdas = ACORDES[0].voces.map(() => {
      const ganancia = contexto.createGain();
      ganancia.gain.value = 0;
      ganancia.connect(filtroCuerdas);
      return ganancia;
    });
    const filtroFermata = contexto.createBiquadFilter();
    filtroFermata.type = 'lowpass';
    filtroFermata.frequency.value = 2000;
    filtroFermata.Q.value = 0.5;
    const vocesFermata = ACORDES[0].voces.map(() => {
      const ganancia = contexto.createGain();
      ganancia.gain.value = 0;
      ganancia.connect(filtroFermata);
      return ganancia;
    });

    return {
      maestro, cercania, distancia, paneo, seco, envioReverb, filtroCuerdas, vocesCuerdas, filtroFermata, vocesFermata,
    };
  }

  // 4. Valores del tramo y alturas

  const valor = (nombre, tramo = tramoActual) => (tramo && tramo.norma[nombre] !== null ? tramo.norma[nombre] : 0);
  const hayDatos = () => Boolean(tramoActual && tramoActual.tieneDatos);
  const acordeDe = (paso) => ACORDES[Math.floor(paso / 16) % ACORDES.length];
  const cuerdaPara = (midi) => (midi < 52 ? 'chelos' : midi < 60 ? 'violas' : 'violines');
  const maderaPara = (u) => MADERAS[Math.min(MADERAS.length - 1, Math.floor(u * MADERAS.length))];

  function midiPentatonica(grado) {
    return NOTA_BASE_MELODIA + 12 * Math.floor(grado / 5) + PENTATONICA[grado % 5];
  }

  const variableDe = (grupo) => MUSICAS[musica].variables[grupo];

  // Relieve. Nota de la escala menor para el valor, y si roza a un semitono una voz del acorde
  // sin ser ella misma nota del acorde, pasa a la nota de la escala más cercana que no roce
  // (ante un empate, la de abajo).
  function midiRelieve(u, acorde) {
    const clases = acorde.voces.map((midi) => midi % 12);
    const deGrado = (g) => NOTA_BASE_MELODIA + 12 * Math.floor(g / 7) + ESCALA_MENOR[((g % 7) + 7) % 7];
    const roza = (midi) => !clases.includes(midi % 12)
      && clases.some((clase) => [1, 11].includes((((midi - clase) % 12) + 12) % 12));
    const grado = Math.round(u * GRADOS_RELIEVE);
    for (const desvio of [0, -1, 1, -2, 2]) {
      const midi = deGrado(grado + desvio);
      if (!roza(midi)) return midi;
    }
    return deGrado(grado);
  }

  // Altura de la melodía para un valor, un grado del motivo y el acorde, según la lógica elegida
  function midiMelodia(u, grado, acorde) {
    const logica = MUSICAS[musica];
    if (musica === 'relieve') return midiRelieve(u, acorde);
    return midiPentatonica(Math.round(u * logica.gradosNivel) + logica.adorno(grado));
  }

  // Altura de la nota fija, la misma escala que la melodía pero sin el motivo
  const midiNotaFija = (acorde) => midiMelodia(valor(variableDe('maderas')), 0, acorde);

  // Arpegio del arpa. En la lógica original recorre las cuatro primeras voces del acorde y su
  // octava. En dos_octavas toma ocho notas del acorde desde un piso que sube con la pendiente.
  // En relieve recorre las cuatro voces arriba de la melodía, en un registro fijo.
  function arpegioArpa(acorde, u) {
    const voces = acorde.voces.slice(0, 4);
    const modo = MUSICAS[musica].arpa;
    if (modo === 'fija') {
      const arpegio = [...voces].sort((a, b) => a - b);
      return [...arpegio, ...arpegio.map((midi) => midi + 12)].map((midi) => midi + 12);
    }
    const clases = voces.map((midi) => midi % 12);
    const notas = [];
    const piso = modo === 'arriba' ? PISO_ARPA_ARRIBA : PISO_ARPA + Math.round(u * RANGO_ARPA);
    const cantidad = modo === 'arriba' ? 5 : 8;
    for (let midi = piso; notas.length < cantidad; midi++) {
      if (clases.includes(midi % 12)) notas.push(midi);
    }
    return notas;
  }

  // Generador pseudoaleatorio con semilla, para que cada tramo tenga siempre el mismo motivo
  function aleatorio(semilla) {
    let estado = semilla >>> 0;
    return () => {
      estado = (estado + 0x6d2b79f5) >>> 0;
      let t = estado;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Motivo de 16 corcheas (dos compases) propio de cada tramo
  function motivoDe(tramo) {
    if (!motivos.has(tramo.id)) {
      const azar = aleatorio(Number(tramo.id.slice(-7)) * 2654435761);
      const motivo = [];
      for (let k = 0; k < 16; k++) {
        const silencio = k % 8 !== 0 && azar() < 0.42;
        motivo.push(silencio ? null : Math.floor(azar() * 6));
      }
      motivos.set(tramo.id, motivo);
    }
    return motivos.get(tramo.id);
  }

  // Ritmo euclídeo, reparte golpes lo más parejo posible en 16 semicorcheas
  function euclideo(golpes, pasos) {
    const patron = [];
    for (let k = 0; k < pasos; k++) patron.push(Math.floor((k * golpes) / pasos) !== Math.floor(((k - 1) * golpes) / pasos));
    return patron;
  }

  // 5. Música en movimiento

  // Ancho. Cuerdas que vuelven a atacar el acorde en cada compás, pisando un poco el anterior,
  // como un cambio de arco. Suenan las seis voces y el ancho decide cuáles se escuchan.
  function tocarCuerdas(acorde, tiempo, duracion) {
    acorde.voces.forEach((midi, k) => {
      tocar(cuerdaPara(midi), midi, tiempo, {
        destino: nodos.vocesCuerdas[k], duracion, ataque: 0.35, liberacion: 0.9,
      });
    });
  }

  // Las cuerdas entran en la capa de la característica que tocan, que depende de la música
  function conectarCuerdas() {
    const capa = capas[variableDe('cuerdas')];
    nodos.filtroCuerdas.disconnect();
    nodos.filtroFermata.disconnect();
    nodos.filtroCuerdas.connect(capa.movimiento);
    nodos.filtroFermata.connect(capa.fermata);
  }

  function actualizarCuerdas(tiempo) {
    const u = valor(variableDe('cuerdas'));
    const vocesAudibles = 1 + u * 5;
    nodos.vocesCuerdas.forEach((voz, k) => {
      voz.gain.setTargetAtTime(limitar(vocesAudibles - k, 0, 1), tiempo, 0.25);
    });
    nodos.vocesFermata.forEach((voz, k) => {
      voz.gain.setTargetAtTime(limitar(vocesAudibles - k, 0, 1), tiempo, 0.25);
    });
    const brillo = Math.min(16000, 700 * 2 ** (u * 4.2));
    nodos.filtroCuerdas.frequency.setTargetAtTime(brillo, tiempo, 0.25);
    nodos.filtroFermata.frequency.setTargetAtTime(brillo, tiempo, 0.25);
  }

  // Nivel. Melodía en la madera que corresponde al nivel, con el motivo del tramo. Cada nota
  // se liga hasta la siguiente del motivo.
  function tocarMelodia(paso, tiempo, tramo) {
    const motivo = motivoDe(tramo);
    const indice = (paso / 2) % 16;
    const grado = motivo[indice];
    if (grado === null) return;
    let espera = 1;
    while (espera < 4 && motivo[(indice + espera) % 16] === null) espera += 1;
    const u = valor(variableDe('maderas'), tramo);
    const midi = midiMelodia(u, grado, acordeDe(paso));
    if (vozMelodia) vozMelodia.apagar(tiempo, 0.12);
    vozMelodia = tocar(maderaPara(u), midi, tiempo, {
      destino: capas[variableDe('maderas')].movimiento, volumen: indice % 4 === 0 ? 1 : 0.85,
      duracion: espera * SEMICORCHEA * 2, ataque: 0.04, liberacion: 0.35,
    });
  }

  // Nota de entrada a un tramo. Toma el grado del motivo del tramo en el punto del compás donde
  // cae (o el último grado anterior si ahí hay silencio) y dura una corchea. Corta la nota
  // anterior de la melodía, así la melodía sigue siendo de una sola voz.
  function tocarEntrada(paso, tiempo, tramo) {
    const motivo = motivoDe(tramo);
    let indice = Math.floor(paso / 2) % 16;
    while (motivo[indice] === null) indice = (indice + 15) % 16;
    const u = valor(variableDe('maderas'), tramo);
    const midi = midiMelodia(u, motivo[indice], acordeDe(paso));
    if (vozMelodia) vozMelodia.apagar(tiempo, 0.12);
    vozMelodia = tocar(maderaPara(u), midi, tiempo, {
      destino: capas[variableDe('maderas')].movimiento, volumen: paso % 4 === 0 ? 0.95 : 0.8,
      duracion: SEMICORCHEA * 2, ataque: 0.02, liberacion: 0.25,
    });
  }

  // Junta en un tramo virtual todos los tramos cruzados en una semicorchea
  function resumir(lista) {
    const conDatos = lista.filter((tramo) => tramo.tieneDatos);
    if (conDatos.length <= 1) return conDatos[0] || null;
    const norma = {};
    for (const [nombre, modo] of Object.entries(RESUMEN)) {
      const valores = conDatos.map((tramo) => tramo.norma[nombre]).filter((valorTramo) => valorTramo !== null);
      if (valores.length === 0) norma[nombre] = null;
      else if (modo === 'maximo') norma[nombre] = Math.max(...valores);
      else norma[nombre] = valores.reduce((suma, valorTramo) => suma + valorTramo, 0) / valores.length;
    }
    // El motivo es el del último tramo, el que quedó bajo el cuadrado
    return { id: conDatos[conDatos.length - 1].id, norma, tieneDatos: true };
  }

  // Pendiente. Arpa con un arpegio que sube por el acorde, más notas cuanto más pendiente,
  // y timbal en la fundamental al principio del compás.
  function tocarPendiente(pasoCompas, acorde, tiempo, tramo) {
    const u = valor('pendiente', tramo);
    if (pasoCompas === 0 || (pasoCompas === 8 && u > 0.6)) {
      tocar('timbal', acorde.bajo + 12, tiempo, {
        destino: capas.pendiente.movimiento, volumen: 0.5 + u * 0.7, ataque: 0.005, duracion: 2.5, liberacion: 0.8,
      });
    }
    const golpes = Math.round(2 + u * 10);
    if (!euclideo(golpes, 16)[pasoCompas]) return;
    const notas = arpegioArpa(acorde, u);
    const midi = notas[golpesArpa % notas.length];
    golpesArpa += 1;
    tocar('arpa', midi, tiempo, {
      destino: capas.pendiente.movimiento, volumen: pasoCompas % 4 === 0 ? 1 : 0.75, ataque: 0.003, duracion: 1.6, liberacion: 1,
    });
  }

  // Amplitud. Contrabajo con un patrón más movido cuanto más varía el agua, y cornos que
  // crecen y vuelven en cada compás, más hondo cuanto mayor la amplitud.
  function tocarAmplitud(pasoCompas, acorde, tiempo, tramo) {
    const u = valor('amplitud', tramo);
    if (MUSICAS[musica].bajo === 'continuo') {
      // De 1 a 8 notas por compás repartidas parejo, cada una dura hasta la siguiente
      const golpes = 1 + Math.round(u * 7);
      const patron = euclideo(golpes, 16);
      if (patron[pasoCompas]) {
        const orden = patron.slice(0, pasoCompas).filter(Boolean).length;
        let largo = 1;
        while (pasoCompas + largo < 16 && !patron[pasoCompas + largo]) largo += 1;
        tocar('contrabajo', acorde.bajo + NOTAS_BAJO[orden % NOTAS_BAJO.length], tiempo, {
          destino: capas.amplitud.movimiento, duracion: (largo - 0.3) * SEMICORCHEA, ataque: 0.03, liberacion: 0.3,
        });
      }
      if (pasoCompas === 0) tocarCornos(acorde, tiempo, COMPAS + 0.3, u);
      return;
    }
    const patron = PATRONES_BAJO[Math.min(2, Math.floor(u * 3))];
    const nota = patron.find(([paso]) => paso === pasoCompas);
    if (nota) {
      const [, semitonos, duracion] = nota;
      tocar('contrabajo', acorde.bajo + semitonos, tiempo, {
        destino: capas.amplitud.movimiento, duracion: duracion * SEMICORCHEA, ataque: 0.03, liberacion: 0.3,
      });
    }
    if (pasoCompas === 0) tocarCornos(acorde, tiempo, COMPAS + 0.3, u);
  }

  function tocarCornos(acorde, tiempo, duracion, u) {
    const base = 0.25;
    const pico = base + u * 0.75;
    tocar('corno', acorde.bajo + 12, tiempo, {
      destino: capas.amplitud.movimiento, duracion, liberacion: 0.6,
      forma: (ganancia, inicio, nivel) => {
        ganancia.linearRampToValueAtTime(nivel * base, inicio + 0.3);
        ganancia.linearRampToValueAtTime(nivel * pico, inicio + duracion / 2);
        ganancia.linearRampToValueAtTime(nivel * base, inicio + duracion);
      },
    });
  }

  // Un paso por semicorchea. Si desde el paso anterior se cruzaron tramos, la melodía toca una
  // nota de entrada que los resume, y la pendiente y la amplitud usan ese resumen. Si el cuadrado
  // sigue dentro del mismo tramo, la melodía sigue el motivo en corcheas.
  function tocarPaso(paso, tiempo) {
    const entrada = resumir(cruzados);
    cruzados = [];
    pasosDesdeEntrada += 1;
    if (quieto) return;
    const tramo = entrada || tramoActual;
    if (!tramo || !tramo.tieneDatos) return;
    const acorde = acordeDe(paso);
    const pasoCompas = paso % 16;
    if (pasoCompas === 0 && hayDatos()) tocarCuerdas(acorde, tiempo, COMPAS + 0.5);
    if (entrada) {
      tocarEntrada(paso, tiempo, entrada);
      pasosDesdeEntrada = 0;
    } else if (paso % 2 === 0 && pasosDesdeEntrada >= 2) {
      tocarMelodia(paso, tiempo, tramo);
    }
    tocarPendiente(pasoCompas, acorde, tiempo, tramo);
    tocarAmplitud(pasoCompas, acorde, tiempo, tramo);
  }

  function programar() {
    while (proximoPaso < contexto.currentTime + ANTICIPACION) {
      tocarPaso(pasoActual, proximoPaso);
      proximoPaso += SEMICORCHEA;
      pasoActual = (pasoActual + 1) % 64;
    }
  }

  // Al volver a moverse, las cuerdas y los cornos no esperan al próximo compás
  function retomarMusica(tiempo) {
    if (!hayDatos()) return;
    const restante = ((16 - (pasoActual % 16)) % 16) * SEMICORCHEA + (proximoPaso - tiempo);
    if (restante < 0.4) return;
    const acorde = acordeDe(pasoActual);
    tocarCuerdas(acorde, tiempo, restante + 0.5);
    if (restante > 0.8) tocarCornos(acorde, tiempo, restante + 0.3, valor('amplitud'));
  }

  // 6. Fermata. Cada voz suena hasta que su grabación se apaga del todo y se vuelve a
  // disparar justo ahí. La generación se renueva al moverse o cambiar de tramo, y los
  // bucles de una generación vieja se cortan solos.

  let generacionFermata = 0;
  let vocesSostenidas = [];
  let relojesFermata = [];

  function sostenerEnBucle(generacion, nombre, midi, destino, volumen, inicio) {
    if (generacion !== generacionFermata) return;
    const voz = tocar(nombre, midi, inicio, { destino, volumen, ataque: 0.25 });
    vocesSostenidas.push(voz);
    const espera = Math.max(0, (voz.fin - contexto.currentTime - 0.3) * 1000);
    relojesFermata.push(setTimeout(() => {
      vocesSostenidas = vocesSostenidas.filter((otra) => otra !== voz);
      sostenerEnBucle(generacion, nombre, midi, destino, volumen, voz.fin);
    }, espera));
  }

  function soltarFermata(tiempo) {
    generacionFermata += 1;
    relojesFermata.forEach(clearTimeout);
    relojesFermata = [];
    vocesSostenidas.forEach((voz) => voz.apagar(tiempo, 0.5));
    vocesSostenidas = [];
  }

  function empezarFermata(tiempo) {
    soltarFermata(tiempo);
    if (!hayDatos()) return;
    const generacion = generacionFermata;
    const acorde = acordeDe(pasoActual);
    const inicio = tiempo + 0.02;
    acorde.voces.forEach((midi, k) => {
      sostenerEnBucle(generacion, cuerdaPara(midi), midi, nodos.vocesFermata[k], 1, inicio);
    });
    const notaFija = midiNotaFija(acorde);
    const capaMaderas = capas[variableDe('maderas')];
    sostenerEnBucle(generacion, maderaPara(valor(variableDe('maderas'))), notaFija, capaMaderas.fermata, 0.9, inicio);
    // En dos_octavas el arpa sostiene la nota más grave de su arpegio, así también la fermata
    // dice cuánta pendiente hay. En relieve sostiene la más grave de su registro, arriba de la melodía.
    const notaArpa = MUSICAS[musica].arpa === 'fija' ? notaFija + 12 : arpegioArpa(acorde, valor('pendiente'))[0];
    sostenerEnBucle(generacion, 'arpa', notaArpa, capas.pendiente.fermata, 0.7, inicio);
    sostenerEnBucle(generacion, 'contrabajo', acorde.bajo, capas.amplitud.fermata, 0.9, inicio);
    sostenerEnBucle(generacion, 'corno', acorde.bajo + 12, capas.amplitud.fermata, 0.3 + valor('amplitud') * 0.5, inicio);
  }

  function aplicarQuietud(tiempo) {
    for (const capa of Object.values(capas)) {
      capa.movimiento.gain.setTargetAtTime(quieto ? 0 : 1, tiempo, 0.15);
      capa.fermata.gain.setTargetAtTime(quieto ? 1 : 0, tiempo, 0.15);
    }
    if (quieto) {
      empezarFermata(tiempo);
    } else {
      soltarFermata(tiempo);
      retomarMusica(tiempo);
    }
  }

  window.Sonido = {
    capas,

    // Crea el contexto de audio y baja las muestras. Se puede llamar apenas carga la página.
    cargar(alProgresar) {
      if (!carga) {
        contexto = new AudioContext();
        carga = cargarMuestras(alProgresar);
      }
      return carga;
    },

    // Hay que llamarlo desde un clic o una tecla, si no el navegador no deja sonar
    async iniciar() {
      await this.cargar();
      if (nodos) return contexto.resume();
      await contexto.resume();
      nodos = crearGrafo();
      conectarCuerdas();
      proximoPaso = contexto.currentTime + 0.05;
      reloj = setInterval(programar, 25);
      if (tramoActual) this.fijarTramo(tramoActual);
      aplicarQuietud(contexto.currentTime);
      return undefined;
    },

    fijarTramo(tramo) {
      const cambio = tramo !== tramoActual;
      tramoActual = tramo;
      if (!nodos) return;
      const ahora = contexto.currentTime;
      for (const [nombre, capa] of Object.entries(capas)) {
        const hayDato = tramo && tramo.norma[nombre] !== null;
        capa.dato.gain.setTargetAtTime(hayDato ? 1 : 0, ahora, 0.15);
      }
      actualizarCuerdas(ahora);
      if (quieto && cambio) empezarFermata(ahora);
      if (retomarAlFijar && tramo) {
        retomarAlFijar = false;
        if (!quieto) retomarMusica(ahora);
      }
    },

    // Al cambiar de río. Corta todo lo que suena y olvida el río anterior (tramo actual, tramos
    // cruzados y motivos). Las capas prendidas y apagadas se mantienen.
    reiniciar() {
      tramoActual = null;
      cruzados = [];
      ultimoRegistrado = null;
      pasosDesdeEntrada = Infinity;
      golpesArpa = 0;
      vozMelodia = null;
      motivos.clear();
      if (!nodos) return;
      const ahora = contexto.currentTime;
      soltarFermata(ahora);
      vocesActivas.forEach((voz) => voz.apagar(ahora, 0.3));
      vocesActivas.clear();
      retomarAlFijar = true;
    },

    // Anota un tramo que el cuadrado acaba de cruzar. Suena en la próxima semicorchea, junto con
    // los demás que se crucen antes
    registrarTramo(tramo) {
      if (!nodos || tramo === ultimoRegistrado) return;
      ultimoRegistrado = tramo;
      cruzados.push(tramo);
    },

    musicas: Object.keys(MUSICAS),

    // Cambia la lógica musical. Lo que está sonando no se corta, el cambio entra en la nota
    // siguiente. Si la orquesta está en fermata, la rearma con las alturas nuevas.
    fijarMusica(nombre) {
      if (!MUSICAS[nombre] || nombre === musica) return;
      musica = nombre;
      if (!nodos) return;
      const ahora = contexto.currentTime;
      // Las cuerdas pueden cambiar de característica. La melodía que está sonando sale por la
      // capa vieja y se apaga sola, la próxima nota ya entra por la nueva.
      conectarCuerdas();
      actualizarCuerdas(ahora);
      if (vozMelodia) vozMelodia.apagar(ahora, 0.15);
      if (quieto) empezarFermata(ahora);
    },

    // Qué característica toca cada grupo de instrumentos (cuerdas, maderas, arpa, bajo)
    variableDe,

    // Qué instrumentos tocan cada característica con la música elegida, para el panel
    instrumentosDe(variable) {
      const nombres = { cuerdas: 'Cuerdas', maderas: 'Maderas', arpa: 'Arpa y timbal', bajo: 'Contrabajo y cornos' };
      const grupo = Object.keys(nombres).find((g) => variableDe(g) === variable);
      return nombres[grupo];
    },

    // true cuando el cuadrado dejó de moverse, false cuando se vuelve a mover
    fijarQuieto(estaQuieto) {
      if (estaQuieto === quieto) return;
      quieto = estaQuieto;
      if (nodos) aplicarQuietud(contexto.currentTime);
    },

    // ganancia entre 0 y 1, paneo entre -1 (izquierda) y 1 (derecha)
    // cercania es la misma cercanía en escala percibida (decibeles llevados a 0 a 1). Maneja el
    // brillo y la sala, así el timbre cambia parejo aunque el volumen caiga rápido al principio.
    fijarCercania(ganancia, paneo, cercania = ganancia) {
      if (!nodos) return;
      const ahora = contexto.currentTime;
      nodos.cercania.gain.setTargetAtTime(ganancia, ahora, 0.05);
      nodos.paneo.pan.setTargetAtTime(paneo, ahora, 0.06);
      nodos.distancia.frequency.setTargetAtTime(1200 + 16800 * cercania ** 1.5, ahora, 0.08);
      nodos.seco.gain.setTargetAtTime(0.55 + 0.45 * cercania, ahora, 0.08);
      nodos.envioReverb.gain.setTargetAtTime(0.25 + 0.55 * (1 - cercania), ahora, 0.08);
    },

    alternarCapa(nombre) {
      const capa = capas[nombre];
      capa.activa = !capa.activa;
      if (nodos) capa.salida.gain.setTargetAtTime(capa.activa ? 1 : 0, contexto.currentTime, 0.12);
      return capa.activa;
    },

    // Nota corta de arpa para confirmar que una capa se prendió (aguda) o se apagó (grave)
    confirmar(prendida) {
      if (!nodos) return;
      tocar('arpa', prendida ? 81 : 57, contexto.currentTime, {
        destino: contexto.destination, volumen: 0.6, ataque: 0.003, duracion: 0.8, liberacion: 0.6,
      });
    },

    // Ducking. true baja la orquesta para que se entienda la locución, false la devuelve. Si el
    // motor todavía no arrancó no hace nada, y arranca a volumen normal.
    atenuar(activo) {
      if (!nodos) return;
      const destino = activo ? GANANCIA_MAESTRA * ATENUACION_LOCUCION : GANANCIA_MAESTRA;
      nodos.maestro.gain.setTargetAtTime(destino, contexto.currentTime, activo ? 0.12 : 0.5);
    },

    detener() {
      clearInterval(reloj);
      soltarFermata(contexto ? contexto.currentTime : 0);
      if (contexto) contexto.close();
    },
  };
})();
