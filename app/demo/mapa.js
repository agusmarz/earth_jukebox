// Mapa del río. Proyección, dibujo y campo de distancias al río.
// Nada se calcula al cargar este archivo. Mapa.cargar(datos) arma todo para un río, y se vuelve
// a llamar cada vez que se cambia de río.
// El campo de distancias se calcula una sola vez por río. Divide el mapa en una grilla y guarda,
// para cada celda, el punto de río más cercano y a qué tramo pertenece. Así, en cada cuadro de
// animación, saber dónde está el río respecto del cuadrado es solo buscar una celda.

(function () {
  const MARGEN = 0.6;
  const CELDAS_LADO_LARGO = 440;

  // Estado del río cargado. Se reemplaza entero al final de cargar, así nunca queda a medias.
  let rio = null;

  // Apunta tramo.norma a la normalización elegida, que es lo que leen el dibujo y el sonido.
  // También se llama después de cambiar los valores de los tramos (por ejemplo al elegir una
  // estación), por eso vuelve a calcular cuáles son estimados.
  function fijarNormalizacion(modo) {
    if (!rio) return;
    for (const tramo of rio.tramos) {
      const normas = tramo.normas || {};
      tramo.norma = normas[modo] || normas.propia || {};
      tramo.tieneDatos = Object.values(tramo.norma).some((valor) => valor !== null && valor !== undefined);
      // Estimado si alguno de sus valores salió de interpolar. La geometría siempre es la de SWORD.
      tramo.estimado = Object.keys(tramo.interpolado || {}).length > 0;
    }
  }

  function cargar(datos, modo) {
    const tramos = datos.tramos;

    // 1. Proyección equirectangular corregida por la latitud media, suficiente para el recorte de un río
    let sumaLatitudes = 0;
    let cantidadPuntos = 0;
    for (const tramo of tramos) {
      for (const [, latitud] of tramo.linea) {
        sumaLatitudes += latitud;
        cantidadPuntos++;
      }
    }
    const coseno = Math.cos((sumaLatitudes / cantidadPuntos) * Math.PI / 180);
    const proyectar = (longitud, latitud) => [longitud * coseno, -latitud];

    for (const tramo of tramos) {
      tramo.puntos = tramo.linea.map(([longitud, latitud]) => proyectar(longitud, latitud));
    }
    const ciudades = (datos.ciudades || []).map(([nombre, latitud, longitud]) => ({ nombre, punto: proyectar(longitud, latitud) }));

    // 2. Límites del mapa con un margen alrededor del río
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const tramo of tramos) {
      for (const [x, y] of tramo.puntos) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    minX -= MARGEN; minY -= MARGEN; maxX += MARGEN; maxY += MARGEN;
    const anchoMapa = maxX - minX;
    const altoMapa = maxY - minY;

    // 3. Grilla del campo de distancias
    const tamCelda = Math.max(anchoMapa, altoMapa) / CELDAS_LADO_LARGO;
    const columnas = Math.ceil(anchoMapa / tamCelda) + 1;
    const filas = Math.ceil(altoMapa / tamCelda) + 1;
    const totalCeldas = columnas * filas;
    const semillaX = new Float32Array(totalCeldas);
    const semillaY = new Float32Array(totalCeldas);
    const distancia2 = new Float32Array(totalCeldas).fill(Infinity);
    const indiceTramo = new Int32Array(totalCeldas).fill(-1);

    const centroX = (columna) => minX + (columna + 0.5) * tamCelda;
    const centroY = (fila) => minY + (fila + 0.5) * tamCelda;

    // Marca las celdas que toca cada tramo, muestreando cada segmento más fino que la celda
    tramos.forEach((tramo, indice) => {
      for (let k = 0; k < tramo.puntos.length - 1; k++) {
        const [ax, ay] = tramo.puntos[k];
        const [bx, by] = tramo.puntos[k + 1];
        const pasos = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (tamCelda * 0.4)));
        for (let p = 0; p <= pasos; p++) {
          const x = ax + (bx - ax) * p / pasos;
          const y = ay + (by - ay) * p / pasos;
          const columna = Math.floor((x - minX) / tamCelda);
          const fila = Math.floor((y - minY) / tamCelda);
          const celda = fila * columnas + columna;
          const d2 = (x - centroX(columna)) ** 2 + (y - centroY(fila)) ** 2;
          if (d2 < distancia2[celda]) {
            distancia2[celda] = d2;
            semillaX[celda] = x;
            semillaY[celda] = y;
            indiceTramo[celda] = indice;
          }
        }
      }
    });

    // Propaga la semilla más cercana en dos pasadas (ida y vuelta), al estilo 8SSEDT
    function probar(celda, columna, fila, vecina) {
      if (indiceTramo[vecina] < 0) return;
      const d2 = (semillaX[vecina] - centroX(columna)) ** 2 + (semillaY[vecina] - centroY(fila)) ** 2;
      if (d2 < distancia2[celda]) {
        distancia2[celda] = d2;
        semillaX[celda] = semillaX[vecina];
        semillaY[celda] = semillaY[vecina];
        indiceTramo[celda] = indiceTramo[vecina];
      }
    }
    for (let fila = 0; fila < filas; fila++) {
      for (let columna = 0; columna < columnas; columna++) {
        const celda = fila * columnas + columna;
        if (columna > 0) probar(celda, columna, fila, celda - 1);
        if (fila > 0) {
          probar(celda, columna, fila, celda - columnas);
          if (columna > 0) probar(celda, columna, fila, celda - columnas - 1);
          if (columna < columnas - 1) probar(celda, columna, fila, celda - columnas + 1);
        }
      }
      for (let columna = columnas - 2; columna >= 0; columna--) {
        const celda = fila * columnas + columna;
        probar(celda, columna, fila, celda + 1);
      }
    }
    for (let fila = filas - 1; fila >= 0; fila--) {
      for (let columna = columnas - 1; columna >= 0; columna--) {
        const celda = fila * columnas + columna;
        if (columna < columnas - 1) probar(celda, columna, fila, celda + 1);
        if (fila < filas - 1) {
          probar(celda, columna, fila, celda + columnas);
          if (columna < columnas - 1) probar(celda, columna, fila, celda + columnas + 1);
          if (columna > 0) probar(celda, columna, fila, celda + columnas - 1);
        }
      }
      for (let columna = 1; columna < columnas; columna++) {
        const celda = fila * columnas + columna;
        probar(celda, columna, fila, celda - 1);
      }
    }

    rio = {
      datos, tramos, ciudades, minX, minY, anchoMapa, altoMapa, tamCelda, columnas, filas, indiceTramo,
      unidades: datos.unidades,
    };
    fijarNormalizacion(modo);
    if (vista.ancho > 0) ajustar(vista.ancho, vista.alto, vista.relleno);
  }

  // Punto más cercano sobre la polilínea de un tramo, para afinar lo que da la grilla
  function puntoMasCercano(tramo, x, y) {
    let mejor = { x: tramo.puntos[0][0], y: tramo.puntos[0][1], d2: Infinity };
    for (let k = 0; k < tramo.puntos.length - 1; k++) {
      const [ax, ay] = tramo.puntos[k];
      const [bx, by] = tramo.puntos[k + 1];
      const dx = bx - ax, dy = by - ay;
      const largo2 = dx * dx + dy * dy;
      const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / largo2));
      const px = ax + t * dx, py = ay + t * dy;
      const d2 = (x - px) ** 2 + (y - py) ** 2;
      if (d2 < mejor.d2) mejor = { x: px, y: py, d2 };
    }
    return mejor;
  }

  // 4. Vista, cómo se ubica el mapa en la pantalla
  const vista = { escala: 1, desplazamientoX: 0, desplazamientoY: 0, ancho: 0, alto: 0, relleno: 0 };

  function ajustar(ancho, alto, relleno) {
    vista.ancho = ancho;
    vista.alto = alto;
    vista.relleno = relleno;
    if (!rio) return;
    vista.escala = Math.min((ancho - 2 * relleno) / rio.anchoMapa, (alto - 2 * relleno) / rio.altoMapa);
    vista.desplazamientoX = (ancho - rio.anchoMapa * vista.escala) / 2;
    vista.desplazamientoY = (alto - rio.altoMapa * vista.escala) / 2;
  }
  const aPantalla = (x, y) => [
    vista.desplazamientoX + (x - rio.minX) * vista.escala,
    vista.desplazamientoY + (y - rio.minY) * vista.escala,
  ];
  const desdePantalla = (px, py) => [
    rio.minX + (px - vista.desplazamientoX) / vista.escala,
    rio.minY + (py - vista.desplazamientoY) / vista.escala,
  ];

  // Devuelve el tramo más cercano a un punto de pantalla, la distancia en píxeles y el punto del río
  function consultar(px, py) {
    if (!rio) return null;
    const { columnas, filas, tamCelda, indiceTramo, tramos, minX, minY } = rio;
    const [x, y] = desdePantalla(px, py);
    const columna = Math.max(0, Math.min(columnas - 1, Math.floor((x - minX) / tamCelda)));
    const fila = Math.max(0, Math.min(filas - 1, Math.floor((y - minY) / tamCelda)));
    const indice = indiceTramo[fila * columnas + columna];
    const tramo = tramos[indice];
    const punto = puntoMasCercano(tramo, x, y);
    const [rioX, rioY] = aPantalla(punto.x, punto.y);
    return { indice, tramo, distancia: Math.hypot(rioX - px, rioY - py), rioX, rioY };
  }

  // 5. Dibujo
  const grosor = (tramo) => (tramo.norma.ancho === null || tramo.norma.ancho === undefined ? 2 : 1.6 + 4.4 * tramo.norma.ancho);

  function trazarTramo(contexto, tramo) {
    contexto.beginPath();
    tramo.puntos.forEach(([x, y], k) => {
      const [px, py] = aPantalla(x, y);
      if (k === 0) contexto.moveTo(px, py);
      else contexto.lineTo(px, py);
    });
  }

  function dibujarBase(contexto) {
    const { ancho, alto } = vista;
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, ancho, alto);

    // Malla de puntos sutil de fondo
    contexto.fillStyle = '#d6d6d6';
    const PASO_MALLA = 16;
    for (let y = PASO_MALLA / 2; y < alto; y += PASO_MALLA) {
      for (let x = PASO_MALLA / 2; x < ancho; x += PASO_MALLA) {
        contexto.fillRect(x, y, 1.2, 1.2);
      }
    }

    if (!rio) return;
    const { tramos, ciudades } = rio;

    // Primero lo interpolado en gris y encima lo medido en negro
    contexto.lineCap = 'round';
    contexto.lineJoin = 'round';
    const ordenados = [...tramos.filter((tramo) => tramo.estimado), ...tramos.filter((tramo) => !tramo.estimado)];
    for (const tramo of ordenados) {
      trazarTramo(contexto, tramo);
      contexto.strokeStyle = tramo.estimado ? '#a8a8a8' : '#000000';
      contexto.lineWidth = grosor(tramo);
      contexto.stroke();
    }

    // Las etiquetas van a la derecha de cada ciudad. Si hay otra ciudad al este tan cerca que
    // la etiqueta la pisaría, va a la izquierda (pasa con dos ciudades enfrentadas en las dos orillas).
    contexto.font = '500 13px Archivo, system-ui, sans-serif';
    contexto.textBaseline = 'middle';
    const enPantalla = ciudades.map((ciudad) => {
      const [px, py] = aPantalla(...ciudad.punto);
      return { nombre: ciudad.nombre, px, py, ancho: contexto.measureText(ciudad.nombre).width };
    });
    for (const ciudad of enPantalla) {
      const aLaIzquierda = enPantalla.some((otra) => otra !== ciudad && otra.px > ciudad.px
        && otra.px - ciudad.px < ciudad.ancho + 18 && Math.abs(otra.py - ciudad.py) < 16);
      contexto.fillStyle = '#6b6b6b';
      contexto.fillRect(ciudad.px - 3, ciudad.py - 3, 6, 6);
      contexto.textAlign = aLaIzquierda ? 'right' : 'left';
      contexto.fillText(ciudad.nombre, ciudad.px + (aLaIzquierda ? -9 : 9), ciudad.py);
    }
  }

  function resaltarTramo(contexto, tramo) {
    trazarTramo(contexto, tramo);
    contexto.strokeStyle = tramo.estimado ? '#7a7a7a' : '#000000';
    contexto.lineWidth = grosor(tramo) + 5;
    contexto.stroke();
  }

  window.Mapa = {
    cargar, fijarNormalizacion, ajustar, consultar, dibujarBase, resaltarTramo,
    get cargado() { return rio !== null; },
    get tramos() { return rio ? rio.tramos : []; },
    get unidades() { return rio ? rio.unidades : {}; },
  };
})();
