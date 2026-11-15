// Convierte lo que dijo la persona en una acción de la app. Es una función pura, sin DOM, así se
// prueba con node (pruebas/intenciones.test.mjs). La usa voz.js.
//
//   VozIntenciones.interpretar(['go to the parana river', ...alternativas], { vista: 'rios' })
//   → { intencion: 'OPEN_RIVER', parametros: { id: 'parana' }, puntaje: 1, confirmar: false, texto }
//
// Pasos: normalizar (minúsculas, sin tildes ni puntuación, números como cifras), comparar cada
// fragmento de la frase con los alias de voz_alias.js (exacto, o parecido por distancia de edición
// sobre el texto y sobre una clave fonética simple), y elegir el mejor. Si nada se parece lo
// suficiente pero hay un número, el número elige un río (en el menú) o una capa (en el tablero).

(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./voz_alias.js'));
  else raiz.VozIntenciones = fabrica(raiz.VozAlias);
})(typeof self !== 'undefined' ? self : this, function (A) {
  const UMBRAL_EJECUTAR = 0.85; // desde acá se ejecuta sin preguntar
  const UMBRAL_CONFIRMAR = 0.74; // entre este y el anterior, un río se confirma ("Did you mean...?")
  const MARGEN_AMBIGUO = 0.05; // dos ríos distintos así de cerca también se confirman
  const PENALIDAD_ALTERNATIVA = 0.02; // por cada alternativa menos probable del reconocedor
  const FRASE_CORTA = 3; // palabras con contenido para que cuente un alias débil

  const RELLENO = new Set(A.RELLENO);
  const PRENDER = new Set(A.PRENDER);
  const APAGAR = new Set(A.APAGAR);
  const MENCION_RIO = new Set(A.MENCION_RIO);

  // Qué acciones tienen sentido en cada vista
  const VALIDAS = {
    bienvenida: ['NEXT', 'OPEN_RIVER', 'LIST_RIVERS', 'TUTORIAL', 'HELP', 'STOP', 'YES', 'NO'],
    tutorial: ['NEXT', 'BACK', 'SKIP', 'REPEAT_INTRO', 'HELP', 'GO_HOME', 'OPEN_RIVER', 'LIST_RIVERS', 'TUTORIAL', 'STOP', 'YES', 'NO'],
    rios: ['BACK', 'GO_HOME', 'OPEN_RIVER', 'LIST_RIVERS', 'TUTORIAL', 'HELP', 'STOP', 'YES', 'NO'],
    rio: ['NEXT', 'BACK', 'GO_HOME', 'OPEN_RIVER', 'LIST_RIVERS', 'SET_LAYER', 'SET_SEASON', 'SET_SCALE',
      'SET_MUSIC', 'REPEAT_INTRO', 'ZOOM', 'STATUS', 'TUTORIAL', 'HELP', 'STOP', 'YES', 'NO'],
  };

  // 1. Normalización. Devuelve las palabras de la frase.
  function palabras(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9ñ\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((palabra) => {
        if (A.NUMEROS[palabra]) return String(A.NUMEROS[palabra]);
        const ordinal = palabra.match(/^(\d+)(st|nd|rd|th|ro|do|to|vo|no|mo)$/);
        return ordinal ? ordinal[1] : palabra;
      });
  }

  // Clave fonética para castellano e inglés: junta letras que el reconocedor suele confundir
  function clave(texto) {
    return texto
      .replace(/ph/g, 'f').replace(/sh/g, 's').replace(/qu/g, 'k').replace(/c([ei])/g, 's$1')
      .replace(/c/g, 'k').replace(/z/g, 's').replace(/v/g, 'b').replace(/ll/g, 'i').replace(/[yj]/g, 'i')
      .replace(/h/g, '').replace(/w/g, 'u').replace(/x/g, 'ks').replace(/ñ/g, 'n')
      .replace(/(.)\1+/g, '$1');
  }

  // Distancia de Damerau-Levenshtein (versión de transposiciones adyacentes)
  function distancia(a, b) {
    const filas = [];
    for (let i = 0; i <= a.length; i++) filas.push([i]);
    for (let j = 1; j <= b.length; j++) filas[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const costo = a[i - 1] === b[j - 1] ? 0 : 1;
        filas[i][j] = Math.min(filas[i - 1][j] + 1, filas[i][j - 1] + 1, filas[i - 1][j - 1] + costo);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          filas[i][j] = Math.min(filas[i][j], filas[i - 2][j - 2] + 1);
        }
      }
    }
    return filas[a.length][b.length];
  }

  const similitud = (a, b) => 1 - distancia(a, b) / Math.max(a.length, b.length, 1);

  // Los alias, ya normalizados
  const ALIAS = [];
  for (const concepto of A.CONCEPTOS) {
    for (const crudo of concepto.alias) {
      const debil = crudo.startsWith('~');
      const tokens = palabras(debil ? crudo.slice(1) : crudo);
      if (tokens.length === 0) continue;
      const junto = tokens.join('');
      ALIAS.push({ concepto, debil, tokens, junto, clave: clave(junto) });
    }
  }

  function parecido(fragmento, alias) {
    const junto = fragmento.join('');
    if (junto === alias.junto) return 1;
    // Las palabras muy cortas ("own", "si", "no", "7") solo valen exactas
    if (alias.junto.length <= 3 || junto.length <= 3) return 0;
    return Math.max(similitud(junto, alias.junto), similitud(clave(junto), alias.clave));
  }

  // Mejor coincidencia de cada alias en la frase, con dónde termina (para que gane lo último dicho)
  function coincidencias(tokens, contenido) {
    const resultado = [];
    for (const alias of ALIAS) {
      if (alias.debil && contenido > FRASE_CORTA) continue;
      const k = alias.tokens.length;
      let mejor = null;
      for (let n = Math.max(1, k - 1); n <= k + 1; n++) {
        for (let i = 0; i + n <= tokens.length; i++) {
          const fragmento = tokens.slice(i, i + n);
          if (fragmento.every((t) => RELLENO.has(t))) continue;
          const puntaje = parecido(fragmento, alias);
          if (puntaje > 0 && (!mejor || puntaje > mejor.puntaje || (puntaje === mejor.puntaje && i + n > mejor.fin))) {
            mejor = { puntaje, fin: i + n };
          }
        }
      }
      if (mejor) resultado.push({ ...mejor, alias, concepto: alias.concepto });
    }
    // Primero el más parecido; a igual puntaje, el dicho más tarde ("invierno no, verano"), y si
    // terminan en el mismo lugar, el alias más largo ("start screen" antes que "start")
    resultado.sort((x, y) => y.puntaje - x.puntaje || y.fin - x.fin || y.alias.junto.length - x.alias.junto.length);
    return resultado;
  }

  function accion(concepto, estado) {
    switch (concepto.intencion) {
      case 'OPEN_RIVER': return { id: concepto.id };
      case 'SET_LAYER': return { capa: concepto.capa, estado };
      case 'SET_SEASON': return { estacion: concepto.estacion };
      case 'SET_SCALE':
      case 'SET_MUSIC': return { modo: concepto.modo };
      case 'ZOOM': return { direccion: concepto.direccion };
      default: return {};
    }
  }

  const sinIntencion = (texto, puntaje) => ({ intencion: null, parametros: {}, puntaje: puntaje || 0, confirmar: false, texto });

  function interpretarUna(texto, contexto) {
    const vista = contexto.vista || 'rios';
    const ordenRios = contexto.ordenRios || A.ORDEN_RIOS;
    const tokens = palabras(texto);
    if (tokens.length === 0) return sinIntencion(texto, 0);

    const contenido = tokens.filter((t) => !RELLENO.has(t)).length;
    let estado = null; // la última palabra de prender o apagar manda
    for (const t of tokens) {
      if (PRENDER.has(t)) estado = 'on';
      if (APAGAR.has(t)) estado = 'off';
    }
    const mencionaRio = tokens.some((t) => MENCION_RIO.has(t));
    const numeros = tokens.filter((t) => /^\d+$/.test(t)).map(Number).filter((n) => n >= 1 && n <= 10);
    const numero = numeros.length ? numeros[numeros.length - 1] : null;

    const lista = coincidencias(tokens, contenido)
      .filter((c) => contexto.pendiente || (c.concepto.intencion !== 'YES' && c.concepto.intencion !== 'NO'));
    const mejor = lista[0];

    // Un número suelto, si ninguna palabra se reconoció con seguridad
    if (numero && (!mejor || mejor.puntaje < UMBRAL_EJECUTAR)) {
      if (vista === 'rio' && !mencionaRio && numero <= 4) {
        return { intencion: 'SET_LAYER', parametros: { capa: numero, estado }, puntaje: 1, confirmar: false, texto };
      }
      if (ordenRios[numero - 1]) {
        return { intencion: 'OPEN_RIVER', parametros: { id: ordenRios[numero - 1] }, puntaje: 1, confirmar: false, texto };
      }
    }

    if (!mejor || mejor.puntaje < UMBRAL_CONFIRMAR) return sinIntencion(texto, mejor ? mejor.puntaje : 0);
    const { intencion } = mejor.concepto;

    let confirmar = false;
    if (intencion === 'OPEN_RIVER') {
      const otroRio = lista.find((c) => c.concepto.intencion === 'OPEN_RIVER' && c.concepto.id !== mejor.concepto.id);
      const ambiguo = otroRio && mejor.puntaje < 1 && mejor.puntaje - otroRio.puntaje < MARGEN_AMBIGUO;
      confirmar = mejor.puntaje < UMBRAL_EJECUTAR || Boolean(ambiguo);
    } else if (mejor.puntaje < UMBRAL_EJECUTAR) {
      // Para el resto, equivocarse en silencio es peor que preguntar de nuevo
      return sinIntencion(texto, mejor.puntaje);
    }
    return { intencion, parametros: accion(mejor.concepto, estado), puntaje: mejor.puntaje, confirmar, texto };
  }

  // entrada: un texto o las alternativas del reconocedor, de la más probable a la menos.
  // contexto: { vista: 'bienvenida' | 'tutorial' | 'rios' | 'rio', pendiente: hay una pregunta sí/no, ordenRios }
  function interpretar(entrada, contexto = {}) {
    const alternativas = (Array.isArray(entrada) ? entrada : [entrada]).filter((t) => t && String(t).trim());
    let elegido = sinIntencion(alternativas[0] || '', 0);
    let puntajeElegido = -1;
    alternativas.forEach((texto, indice) => {
      const resultado = interpretarUna(texto, contexto);
      if (!resultado.intencion) return;
      const puntaje = resultado.puntaje - indice * PENALIDAD_ALTERNATIVA - (resultado.confirmar ? 0.5 : 0);
      if (puntaje > puntajeElegido) {
        elegido = resultado;
        puntajeElegido = puntaje;
      }
    });
    return elegido;
  }

  const disponible = (intencion, vista) => Boolean(VALIDAS[vista] && VALIDAS[vista].includes(intencion));

  return { interpretar, disponible, palabras, clave, similitud, UMBRAL_EJECUTAR, UMBRAL_CONFIRMAR };
});
