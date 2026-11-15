// Vocabulario de los comandos de voz, en inglés y castellano. Lo usa voz_intenciones.js.
// Los alias se escriben como los diría la persona o como suele transcribirlos el reconocedor; antes
// de comparar se normalizan igual que la frase (minúsculas, sin tildes, números como cifras).
// Si en las pruebas aparece una transcripción equivocada que se repite, se agrega acá.
// Un alias marcado con "~" es débil: solo cuenta si la frase es corta (3 palabras o menos), porque
// también es una palabra común ("with" por "width").

(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.VozAlias = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  // Cada concepto es una acción con sus parámetros y la lista de formas de decirla
  const CONCEPTOS = [
    // Ríos (los ids son los de datos/indice.json)
    { intencion: 'OPEN_RIVER', id: 'amazonas', alias: ['amazon', 'amazonas', 'amazona', 'amazonia', 'amazon river'] },
    { intencion: 'OPEN_RIVER', id: 'congo', alias: ['congo', 'kongo'] },
    { intencion: 'OPEN_RIVER', id: 'ganges', alias: ['ganges', 'ganga', 'ganjes', 'brahmaputra', 'meghna'] },
    { intencion: 'OPEN_RIVER', id: 'orinoco', alias: ['orinoco', 'orinoko', 'orinocco'] },
    { intencion: 'OPEN_RIVER', id: 'yangtse', alias: ['yangtze', 'yangtse', 'yangzi', 'yang tse', 'yang si', 'yankee', 'yang c', 'chang jiang', 'rio azul', 'blue river'] },
    { intencion: 'OPEN_RIVER', id: 'yenisei', alias: ['yenisei', 'yenisey', 'yeniseo', 'enisei', 'yenissei', 'jenisei', 'yeni sei', 'yenesei', 'yenisay'] },
    { intencion: 'OPEN_RIVER', id: 'parana', alias: ['parana', 'para na', 'paranal'] },
    { intencion: 'OPEN_RIVER', id: 'lena', alias: ['lena', 'lenna', '~lina'] },
    { intencion: 'OPEN_RIVER', id: 'mississippi', alias: ['mississippi', 'misisipi', 'misisipe', 'missisipi', 'mississipi', 'misisipí'] },
    { intencion: 'OPEN_RIVER', id: 'mekong', alias: ['mekong', 'mecong', 'mekon', 'me kong', 'mekong river'] },

    // Capas del tablero: nombre de la capa o sus instrumentos
    { intencion: 'SET_LAYER', capa: 1, alias: ['width', 'ancho', 'anchura', 'strings', 'cuerdas', '~with', '~wid', '~guid', '~whith'] },
    { intencion: 'SET_LAYER', capa: 2, alias: ['level', 'nivel', 'levels', 'water level', 'nivel del agua', 'woodwinds', 'woodwind', 'maderas', '~label'] },
    { intencion: 'SET_LAYER', capa: 3, alias: ['slope', 'pendiente', 'harp', 'arpa', 'timpani', 'timbal', '~slow', '~slop', '~eslop'] },
    { intencion: 'SET_LAYER', capa: 4, alias: ['range', 'rango', 'amplitud', 'amplitude', 'double bass', 'contrabajo', 'contrabajos', 'horns', 'cornos', '~ranch', '~rains', '~reinch'] },

    // Estaciones (claves internas de demo.js)
    { intencion: 'SET_SEASON', estacion: 'verano', alias: ['summer', 'verano'] },
    { intencion: 'SET_SEASON', estacion: 'otono', alias: ['autumn', 'fall', 'otono'] },
    { intencion: 'SET_SEASON', estacion: 'invierno', alias: ['winter', 'invierno'] },
    { intencion: 'SET_SEASON', estacion: 'primavera', alias: ['spring', 'primavera'] },

    // Escala y lógica musical
    { intencion: 'SET_SCALE', modo: 'global', alias: ['global', 'global scale', 'escala global'] },
    { intencion: 'SET_SCALE', modo: 'propia', alias: ['own scale', 'own', 'propia', 'escala propia', 'local scale'] },
    { intencion: 'SET_SCALE', modo: null, alias: ['scale', 'escala', 'normalization', 'normalizacion'] },
    { intencion: 'SET_MUSIC', modo: 'dos_octavas', alias: ['two octaves', 'dos octavas', '2 octaves', '2 octavas'] },
    { intencion: 'SET_MUSIC', modo: 'relieve', alias: ['relief', 'relieve'] },
    { intencion: 'SET_MUSIC', modo: 'original', alias: ['original', 'original music', 'musica original'] },
    { intencion: 'SET_MUSIC', modo: null, alias: ['music', 'musica', 'melody logic', 'logica musical', 'logica'] },

    // Zoom
    { intencion: 'ZOOM', direccion: 'in', alias: ['zoom in', 'zoom', 'closer', 'get closer', 'acercar', 'acerca', 'acercate', 'mas cerca', 'agrandar'] },
    { intencion: 'ZOOM', direccion: 'out', alias: ['zoom out', 'further', 'farther', 'alejar', 'aleja', 'alejate', 'mas lejos', 'achicar'] },
    { intencion: 'ZOOM', direccion: 'reset', alias: ['whole river', 'full river', 'entire river', 'reset zoom', 'zoom reset', 'rio entero', 'todo el rio', 'rio completo'] },

    // Navegación y ayuda
    { intencion: 'NEXT', alias: ['next', 'continue', 'siguiente', 'continuar', 'continua', 'start', 'begin', 'play', 'listen', 'empezar', 'empeza', 'comenzar', 'arrancar', 'escuchar', 'adelante',
      '~necks', '~neck', '~nex', '~nexus', '~nest', '~nets', '~knicks', '~nick', '~max', '~text'] },
    { intencion: 'BACK', alias: ['back', 'go back', 'menu', 'river menu', 'volver', 'vuelve', 'atras', 'regresar', 'escape'] },
    { intencion: 'GO_HOME', alias: ['home', 'start screen', 'welcome', 'inicio', 'pantalla de inicio', 'bienvenida', 'principio'] },
    { intencion: 'LIST_RIVERS', alias: ['which rivers', 'list rivers', 'list of rivers', 'rivers', 'all rivers', 'que rios hay', 'rios', 'lista de rios', 'cuales rios'] },
    { intencion: 'REPEAT_INTRO', alias: ['repeat', 'replay', 'again', 'intro', 'introduction', 'repetir', 'repeti', 'repite', 'otra vez', 'presentacion', 'de nuevo'] },
    { intencion: 'HELP', alias: ['help', 'commands', 'options', 'what can i say', 'tutorial', 'ayuda', 'comandos', 'opciones', 'que puedo decir', 'ayudame'] },
    { intencion: 'STATUS', alias: ['status', 'where am i', 'what is on', 'estado', 'donde estoy', 'como estoy', 'que suena'] },
    { intencion: 'STOP', alias: ['stop', 'stop talking', 'quiet', 'silence', 'shut up', 'basta', 'callate', 'silencio'] },

    // Respuestas, solo cuentan si hay una pregunta pendiente
    { intencion: 'YES', alias: ['yes', 'yeah', 'yep', 'sure', 'correct', 'right', 'ok', 'okay', 'si', 'dale', 'claro', 'correcto', 'exacto', 'eso'] },
    { intencion: 'NO', alias: ['no', 'nope', 'cancel', 'wrong', 'cancelar', 'cancela', 'incorrecto', 'nada'] },
  ];

  // Números escritos en palabras. "to", "too" y "for" no se toman como números: son demasiado comunes.
  const NUMEROS = {
    one: 1, first: 1, uno: 1, primero: 1, primer: 1,
    two: 2, second: 2, dos: 2, segundo: 2,
    three: 3, third: 3, tres: 3, tercero: 3, tercer: 3,
    four: 4, fourth: 4, cuatro: 4, cuarto: 4,
    five: 5, fifth: 5, cinco: 5, quinto: 5,
    six: 6, sixth: 6, seis: 6, sexto: 6,
    seven: 7, seventh: 7, siete: 7, septimo: 7, setimo: 7,
    eight: 8, eighth: 8, ocho: 8, octavo: 8,
    nine: 9, ninth: 9, nueve: 9, noveno: 9,
    ten: 10, tenth: 10, diez: 10, decimo: 10,
  };

  // Palabras de relleno. No se borran de la frase (algunos alias las contienen, como "go back"), pero un
  // fragmento hecho solo de relleno no se compara, y no cuentan para saber si la frase es corta.
  const RELLENO = [
    'quiero', 'quisiera', 'por', 'favor', 'ir', 'al', 'a', 'el', 'la', 'los', 'las', 'del', 'de', 'en', 'un', 'una',
    'llevame', 'lleva', 'me', 'mostrame', 'muestrame', 'pone', 'pon', 'poner', 'pasa', 'pasar', 'cambia', 'cambiar',
    'podes', 'puedes', 'vamos', 'ahora', 'che', 'y', 'o', 'que', 'numero', 'capa', 'instrumento',
    'please', 'go', 'to', 'the', 'take', 'i', 'want', 'would', 'like', 'show', 'can', 'you', 'lets', 'let', 'us',
    'open', 'abri', 'abrir', 'number', 'layer', 'instrument', 'it', 'in', 'a', 'an', 'now', 'set', 'switch', 'change', 'and', 'or',
    'river', 'rio', 'turn', 'put', 'make', 'of', 'on', 'off',
  ];

  // Palabras que fijan si una capa se prende o se apaga. Sin ninguna, la capa se alterna.
  const PRENDER = ['on', 'enable', 'activate', 'unmute', 'prende', 'prender', 'encende', 'enciende', 'encender', 'activa', 'activar', 'prendido', 'prendida'];
  const APAGAR = ['off', 'disable', 'deactivate', 'mute', 'apaga', 'apagar', 'saca', 'sacar', 'quita', 'quitar', 'desactiva', 'desactivar', 'apagado', 'apagada', 'silencia'];

  // Palabras que indican que un número es un río y no una capa ("river seven" en el tablero)
  const MENCION_RIO = ['river', 'rio'];

  // Orden del menú (demo/rios.js). Lo usa el número de río cuando no se pasa otro orden.
  const ORDEN_RIOS = ['amazonas', 'congo', 'ganges', 'orinoco', 'yangtse', 'yenisei', 'parana', 'lena', 'mississippi', 'mekong'];

  return { CONCEPTOS, NUMEROS, RELLENO, PRENDER, APAGAR, MENCION_RIO, ORDEN_RIOS };
});
