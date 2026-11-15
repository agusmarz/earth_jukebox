// Banco de pruebas del motor de sonido. Carga sonido.js tal cual, con un Web Audio falso que
// anota cada nota que se dispara (instrumento, altura, momento), y simula recorridos del cuadrado
// sobre los datos reales. No suena nada, mide.
//   node pruebas/experimentos_sonido.js            corre todos los experimentos con todas las músicas
//   node pruebas/experimentos_sonido.js parana     solo ese río
// Se corre desde demo/.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEMO = path.join(__dirname, '..');
const BPM = 80;
const SEMICORCHEA = 60 / BPM / 4;
const COMPAS = SEMICORCHEA * 16;
const CUADRO = 1 / 60;
const MADERAS = ['fagot', 'clarinete', 'oboe', 'flauta'];
const CUERDAS = ['chelos', 'violas', 'violines'];
const ACORDES = [
  [50, 57, 53, 60, 64, 69],
  [46, 53, 50, 57, 60, 65],
  [53, 60, 57, 64, 67, 72],
  [48, 55, 52, 59, 62, 67],
];

// 1. Web Audio falso

function crearMotor(musica) {
  const notas = [];
  const temporizadores = [];
  let intervalo = null;
  const reloj = { ahora: 0 };
  const parametro = () => ({
    value: 0,
    setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {},
    cancelScheduledValues() {}, cancelAndHoldAtTime() {},
  });
  const nodo = (extra = {}) => ({ connect(destino) { return destino; }, disconnect() {}, ...extra });
  const contexto = {
    get currentTime() { return reloj.ahora; },
    sampleRate: 8000,
    destination: nodo(),
    createGain: () => nodo({ gain: parametro() }),
    createBiquadFilter: () => nodo({ frequency: parametro(), Q: parametro(), type: '' }),
    createStereoPanner: () => nodo({ pan: parametro() }),
    createConvolver: () => nodo({ buffer: null }),
    createDynamicsCompressor: () => nodo({ threshold: parametro(), ratio: parametro(), attack: parametro(), release: parametro() }),
    createBuffer: (canales, largo) => ({ getChannelData: () => new Float32Array(largo) }),
    createOscillator: () => nodo({ frequency: parametro(), start() {}, stop() {} }),
    createBufferSource() {
      const fuente = nodo({
        buffer: null, playbackRate: { ...parametro(), value: 1 }, onended: null,
        start(tiempo) {
          const { instrumento, midi } = fuente.buffer;
          if (!instrumento) return; // el golpe de ruido del triángulo
          const velocidad = fuente.playbackRate.value;
          notas.push({ instrumento, midi: Math.round(midi + 12 * Math.log2(velocidad)), corrimiento: 12 * Math.log2(velocidad), tiempo });
        },
        stop() {},
      });
      return fuente;
    },
    decodeAudioData: async (datos) => ({ ...datos, duration: 6 }),
    resume: async () => {},
    close() {},
  };

  const ventana = {};
  const entorno = {
    window: ventana,
    location: { protocol: 'http:' },
    console,
    Math, Number, Object, Array, Set, Map, Promise, Error, Boolean, Infinity,
    AudioContext: function AudioContext() { return contexto; },
    fetch: async (url) => {
      const archivo = url.replace(/^muestras\//, '');
      for (const [instrumento, datos] of Object.entries(ventana.MUESTRAS.instrumentos)) {
        const nota = datos.notas.find((n) => n.archivo === archivo);
        if (nota) return { ok: true, arrayBuffer: async () => ({ instrumento, midi: nota.midi }) };
      }
      return { ok: false };
    },
    setInterval: (funcion) => { intervalo = funcion; return 1; },
    clearInterval: () => {},
    setTimeout: (funcion, ms) => { temporizadores.push({ momento: reloj.ahora + ms / 1000, funcion }); return temporizadores.length; },
    clearTimeout: () => {},
  };
  vm.createContext(entorno);
  vm.runInContext(fs.readFileSync(path.join(DEMO, 'muestras/indice.js'), 'utf8'), entorno);
  vm.runInContext(fs.readFileSync(path.join(DEMO, 'sonido.js'), 'utf8'), entorno);
  const sonido = ventana.Sonido;

  return {
    sonido, notas, reloj,
    async iniciar() {
      await sonido.iniciar();
      sonido.fijarMusica(musica);
      sonido.fijarCercania(1, 0, 1);
    },
    // Avanza un cuadro de animación
    avanzar() {
      reloj.ahora += CUADRO;
      if (intervalo) intervalo();
      for (const t of temporizadores.splice(0)) {
        if (t.momento <= reloj.ahora) t.funcion();
        else temporizadores.push(t);
      }
    },
  };
}

// 2. Datos

function cargarRio(id, normalizacion) {
  const datos = JSON.parse(fs.readFileSync(path.join(DEMO, 'datos', `${id}.json`), 'utf8'));
  for (const tramo of datos.tramos) {
    tramo.norma = tramo.normas[normalizacion];
    tramo.tieneDatos = Object.values(tramo.norma).some((v) => v !== null && v !== undefined);
  }
  // Cauce en orden, de aguas arriba hacia la desembocadura. Los brazos dudosos quedan afuera.
  const cauce = datos.tramos.filter((t) => t.tipo !== 'topología dudosa' && t.tieneDatos).sort((a, b) => b.km - a.km);
  return { datos, cauce };
}

// 3. Simulaciones

// El cuadrado se queda sobre cada tramo, moviéndose, durante segundos. Devuelve las notas por tramo.
async function simularQuedarse(musica, cauce, segundos = 2 * COMPAS) {
  const motor = crearMotor(musica);
  await motor.iniciar();
  motor.sonido.fijarQuieto(false);
  const resultado = [];
  for (const tramo of cauce) {
    const desde = motor.notas.length;
    const inicio = motor.reloj.ahora;
    motor.sonido.fijarTramo(tramo);
    motor.sonido.registrarTramo(tramo);
    while (motor.reloj.ahora - inicio < segundos) motor.avanzar();
    resultado.push({ tramo, notas: motor.notas.slice(desde), inicio });
  }
  return { resultado, motor };
}

// El cuadrado recorre el cauce a velocidad tramos por segundo. Devuelve la secuencia de notas
// de melodía y qué tramos se cruzaron antes de cada una.
async function simularBarrido(musica, cauce, velocidad) {
  const motor = crearMotor(musica);
  await motor.iniciar();
  motor.sonido.fijarQuieto(false);
  let indice = -1;
  const inicio = motor.reloj.ahora;
  const cruces = [];
  while (indice < cauce.length - 1) {
    const nuevo = Math.min(cauce.length - 1, Math.floor((motor.reloj.ahora - inicio) * velocidad));
    while (indice < nuevo) {
      indice += 1;
      motor.sonido.registrarTramo(cauce[indice]);
      cruces.push({ tiempo: motor.reloj.ahora, tramo: cauce[indice] });
    }
    motor.sonido.fijarTramo(cauce[indice]);
    motor.avanzar();
  }
  for (let k = 0; k < 30; k++) motor.avanzar();
  return { notas: motor.notas, cruces, inicio };
}

// 4. Medidas

const promedio = (lista) => lista.reduce((s, v) => s + v, 0) / (lista.length || 1);
function spearman(a, b) {
  const rangos = (v) => {
    const orden = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length);
    orden.forEach(([, i], k) => { r[i] = k; });
    return r;
  };
  const ra = rangos(a);
  const rb = rangos(b);
  const ma = promedio(ra);
  const mb = promedio(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

// Para cada par de tramos con valores distintos, si la nota promedio los ordena igual que el dato
function ordenCorrecto(valores, alturas, diferenciaMinima = 0.05) {
  let bien = 0;
  let total = 0;
  for (let i = 0; i < valores.length; i++) {
    for (let j = i + 1; j < valores.length; j++) {
      if (Math.abs(valores[i] - valores[j]) < diferenciaMinima) continue;
      total += 1;
      if (Math.sign(valores[i] - valores[j]) === Math.sign(alturas[i] - alturas[j])) bien += 1;
    }
  }
  return bien / total;
}

const pct = (x) => `${(100 * x).toFixed(0)} %`;
const f2 = (x) => x.toFixed(2);

// Choques de la melodía con el acorde. Una nota que no es del acorde y queda a un semitono (o
// novena menor) de una voz audible suena áspera. Las voces audibles salen de la característica
// que tocan las cuerdas, como en sonido.js.
function choca(nota, acorde, u) {
  const audibles = acorde.filter((_, k) => 1 + u * 5 - k >= 0.5).map((v) => v % 12);
  if (acorde.some((v) => v % 12 === nota % 12)) return false;
  return audibles.some((clase) => [1, 11].includes((((nota - clase) % 12) + 12) % 12));
}

const cuartil = (lista, q) => [...lista].sort((a, b) => a - b)[Math.floor(q * (lista.length - 1))];
const valorDe = (tramo, variable) => tramo.norma[variable] ?? 0;

// Correlación media en ventanas de 16 tramos seguidos, si se oye el detalle y no solo la tendencia
function correlacionLocal(pares) {
  const locales = [];
  const ultimo = Math.max(...pares.map((p) => p.indice));
  for (let desde = 0; desde + 16 <= ultimo + 1; desde += 16) {
    const ventana = pares.filter((p) => p.indice >= desde && p.indice < desde + 16);
    const valores = ventana.map((p) => p.valor);
    if (ventana.length >= 6 && Math.max(...valores) - Math.min(...valores) > 0.05) locales.push(spearman(valores, ventana.map((p) => p.midi)));
  }
  return promedio(locales.filter((x) => !Number.isNaN(x)));
}

async function medir(rioId, normalizacion, musica) {
  const { cauce } = cargarRio(rioId, normalizacion);
  const m = {};
  const { resultado, motor } = await simularQuedarse(musica, cauce);
  const v = { cuerdas: motor.sonido.variableDe('cuerdas'), maderas: motor.sonido.variableDe('maderas') };
  m.variableMelodia = v.maderas;
  const t0 = resultado[0].inicio + 0.05;
  const acordeEn = (tiempo) => ACORDES[Math.floor(Math.round((tiempo - t0) / SEMICORCHEA) / 16) % 4];

  const filas = resultado.map(({ tramo, notas }) => ({
    tramo,
    melodia: notas.filter((n) => MADERAS.includes(n.instrumento)),
    arpa: notas.filter((n) => n.instrumento === 'arpa'),
    bajo: notas.filter((n) => n.instrumento === 'contrabajo').length,
  })).filter((f) => f.melodia.length > 0);
  filas.forEach((f) => { f.altura = promedio(f.melodia.map((n) => n.midi)); });
  const uMel = filas.map((f) => valorDe(f.tramo, v.maderas));
  const notasMel = filas.flatMap((f) => f.melodia.map((n) => n.midi));

  m.rango = `${Math.min(...notasMel)}-${Math.max(...notasMel)}`;
  m.alturas = new Set(notasMel).size;
  m.correlacion = spearman(uMel, filas.map((f) => f.altura));
  m.ordenPrimera = ordenCorrecto(uMel, filas.map((f) => f.melodia[0].midi));
  m.ruidoInterno = promedio(filas.map((f) => Math.max(...f.melodia.map((n) => n.midi)) - Math.min(...f.melodia.map((n) => n.midi))));
  m.cambioVecinos = promedio(filas.slice(1).map((f, i) => Math.abs(f.altura - filas[i].altura)));
  let iguales = 0;
  let distintos = 0;
  for (let i = 1; i < filas.length; i++) {
    if (Math.abs(uMel[i] - uMel[i - 1]) < 0.02) continue;
    distintos += 1;
    if (Math.round(filas[i].altura) === Math.round(filas[i - 1].altura)) iguales += 1;
  }
  m.vecinosIguales = iguales / distintos;
  const saltosDato = uMel.slice(1).map((u, i) => Math.abs(u - uMel[i]));
  m.saltoDatoVecino = cuartil(saltosDato, 0.5);

  m.choques = promedio(filas.flatMap((f) => f.melodia.map((n) => Number(choca(n.midi, acordeEn(n.tiempo), valorDe(f.tramo, v.cuerdas))))));
  m.arpaTapa = promedio(filas.flatMap((f) => f.melodia.map((n) => Number(f.arpa.some((a) => Math.abs(a.tiempo - n.tiempo) < 0.2 && Math.abs(a.midi - n.midi) <= 2)))));
  m.arpaDensidad = spearman(filas.map((f) => valorDe(f.tramo, 'pendiente')), filas.map((f) => f.arpa.length));
  m.bajoDensidad = spearman(filas.map((f) => valorDe(f.tramo, 'amplitud')), filas.map((f) => f.bajo));
  m.bajoNiveles = new Set(filas.map((f) => f.bajo)).size;
  const voces = filas.map((f) => 1 + valorDe(f.tramo, v.cuerdas) * 5);
  m.vocesCuartiles = `${cuartil(voces, 0.25).toFixed(1)}/${cuartil(voces, 0.75).toFixed(1)}`;
  const corr = motor.notas.map((n) => Math.abs(n.corrimiento));
  m.corrimiento = promedio(corr.map((c) => Number(c > 2)));

  for (const velocidad of [2, 6, 20]) {
    const { notas, cruces } = await simularBarrido(musica, cauce, velocidad);
    const melodia = notas.filter((n) => MADERAS.includes(n.instrumento));
    const pares = [];
    let k = 0;
    for (const nota of melodia) {
      while (k + 1 < cruces.length && cruces[k + 1].tiempo <= nota.tiempo) k += 1;
      pares.push({ midi: nota.midi, valor: valorDe(cruces[k].tramo, v.maderas), indice: k });
    }
    m[`local${velocidad}`] = correlacionLocal(pares);
    m[`propias${velocidad}`] = new Set(pares.map((p) => p.indice)).size / cauce.length;
  }
  return m;
}

const FILAS = [
  ['variableMelodia', 'Característica que toca la melodía', (x) => x],
  ['rango', 'Rango de la melodía (MIDI)', (x) => x],
  ['alturas', 'Alturas distintas usadas', (x) => x],
  ['correlacion', 'Correlación dato / nota promedio del tramo', f2],
  ['ordenPrimera', 'Pares bien ordenados por la 1a nota al cruzar', pct],
  ['ruidoInterno', 'Salto dentro de un mismo tramo (semitonos)', f2],
  ['cambioVecinos', 'Cambio de nota entre tramos vecinos (semitonos)', f2],
  ['saltoDatoVecino', 'Cambio del dato entre vecinos, mediana (0 a 1)', (x) => x.toFixed(3)],
  ['vecinosIguales', 'Vecinos con dato distinto y la misma nota', pct],
  ['local2', 'Correlación local barriendo a 2 tramos/s', f2],
  ['local6', 'Correlación local barriendo a 6 tramos/s', f2],
  ['propias20', 'Tramos con nota propia a 20 tramos/s', pct],
  ['choques', 'Notas de melodía que rozan el acorde', pct],
  ['arpaTapa', 'Notas de melodía tapadas por el arpa', pct],
  ['arpaDensidad', 'Correlación pendiente / notas de arpa', f2],
  ['bajoDensidad', 'Correlación amplitud / notas de bajo', f2],
  ['bajoNiveles', 'Densidades de bajo distintas', (x) => x],
  ['vocesCuartiles', 'Voces de cuerdas, cuartiles 25/75 (de 6)', (x) => x],
  ['corrimiento', 'Notas con la muestra corrida más de 2 semitonos', pct],
];

async function main() {
  const rios = process.argv[2] ? [process.argv[2]] : ['parana', 'mississippi'];
  const musicas = crearMotor('original').sonido.musicas;
  for (const rio of rios) {
    for (const normalizacion of ['propia', 'global']) {
      const columnas = [];
      for (const musica of musicas) columnas.push(await medir(rio, normalizacion, musica));
      console.log(`\n${rio}, normalización ${normalizacion}`);
      console.log(`${''.padEnd(50)}${musicas.map((n) => n.padStart(13)).join('')}`);
      for (const [clave, titulo, formatear] of FILAS) {
        console.log(`${titulo.padEnd(50)}${columnas.map((c) => String(formatear(c[clave])).padStart(13)).join('')}`);
      }
    }
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
