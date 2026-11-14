// Convierte lo que dijo el usuario en una intención concreta.
// Acepta errores del reconocedor comparando con distancia de edición.

const COMANDOS = {
  volver: ['volver', 'volve', 'mapa', 'menu', 'atras', 'salir', 'inicio'],
  pausa: ['pausa', 'pausar', 'parar', 'para', 'detener', 'stop', 'frenar', 'freno'],
  seguir: ['seguir', 'segui', 'continuar', 'continua', 'play', 'reproducir', 'arrancar'],
  repetir: ['repetir', 'repeti', 'de nuevo', 'otra vez', 'reiniciar', 'desde el principio'],
  opciones: ['opciones', 'lista', 'cuales', 'que hay', 'que rios', 'ayuda', 'rios'],
  describir: ['describir', 'descripcion', 'que es', 'contame', 'informacion', 'info', 'explicame'],
  afirmar: ['si', 'dale', 'ok', 'okey', 'claro', 'correcto', 'eso', 'exacto', 'confirmo'],
  negar: ['no', 'cancelar', 'otro', 'ninguno'],
};

export function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distancia(a, b) {
  const filas = a.length + 1;
  const columnas = b.length + 1;
  const tabla = Array.from({ length: filas }, (_, i) => [i, ...Array(columnas - 1).fill(0)]);
  for (let j = 1; j < columnas; j++) tabla[0][j] = j;
  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      tabla[i][j] = Math.min(tabla[i - 1][j] + 1, tabla[i][j - 1] + 1, tabla[i - 1][j - 1] + costo);
    }
  }
  return tabla[filas - 1][columnas - 1];
}

// Qué tan bien aparece una frase clave dentro de lo dicho (0 a 1)
function parecido(frase, clave) {
  if (` ${frase} `.includes(` ${clave} `)) return 1;
  const palabras = frase.split(' ');
  const largoClave = clave.split(' ').length;
  let mejor = 0;
  for (let i = 0; i + largoClave <= palabras.length; i++) {
    const trozo = palabras.slice(i, i + largoClave).join(' ');
    // las palabras muy cortas solo valen si coinciden exacto
    if (clave.length <= 3) continue;
    const puntaje = 1 - distancia(trozo, clave) / Math.max(trozo.length, clave.length);
    mejor = Math.max(mejor, puntaje);
  }
  return mejor;
}

function mejorCoincidencia(frase, candidatos) {
  let mejor = { clave: null, puntaje: 0 };
  for (const [clave, palabras] of candidatos) {
    for (const palabra of palabras) {
      const puntaje = parecido(frase, normalizar(palabra));
      if (puntaje > mejor.puntaje) mejor = { clave, puntaje };
    }
  }
  return mejor;
}

// alternativas es la lista que devuelve el reconocedor.
// Devuelve { tipo: 'rio', rio, confianza } o { tipo: 'comando', nombre } o null.
export function interpretar(alternativas, rios) {
  if (!alternativas?.length) return null;
  const candidatosRios = rios.map((r) => [r.id, r.alias]);
  const candidatosComandos = Object.entries(COMANDOS);

  let mejorRio = { clave: null, puntaje: 0 };
  let mejorComando = { clave: null, puntaje: 0 };

  alternativas.forEach((alternativa, posicion) => {
    const frase = normalizar(alternativa);
    const castigo = posicion * 0.03; // las primeras alternativas son más confiables
    const rio = mejorCoincidencia(frase, candidatosRios);
    const comando = mejorCoincidencia(frase, candidatosComandos);
    if (rio.puntaje - castigo > mejorRio.puntaje) mejorRio = { ...rio, puntaje: rio.puntaje - castigo };
    if (comando.puntaje - castigo > mejorComando.puntaje)
      mejorComando = { ...comando, puntaje: comando.puntaje - castigo };
  });

  // Un nombre de río gana sobre un comando, salvo que el comando sea exacto
  if (mejorRio.puntaje >= 0.6 && mejorRio.puntaje >= mejorComando.puntaje) {
    return {
      tipo: 'rio',
      rio: rios.find((r) => r.id === mejorRio.clave),
      confianza: mejorRio.puntaje,
    };
  }
  if (mejorComando.puntaje >= 0.75) {
    return { tipo: 'comando', nombre: mejorComando.clave };
  }
  return null;
}
