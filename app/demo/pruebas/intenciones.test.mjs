// Pruebas de voz_intenciones.js. Desde app/demo:  node --test pruebas/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { interpretar, disponible } = require('../voz_intenciones.js');

// [vista, frase, intención esperada, parámetros esperados (los que se indiquen), opciones]
const CASOS = [
  ['rios', 'quiero ir al paraná', 'OPEN_RIVER', { id: 'parana' }],
  ['rios', 'llevame al Paraná', 'OPEN_RIVER', { id: 'parana' }],
  ['rios', 'Paraná', 'OPEN_RIVER', { id: 'parana' }],
  ['rios', 'el siete', 'OPEN_RIVER', { id: 'parana' }],
  ['rios', 'go to the Parana river', 'OPEN_RIVER', { id: 'parana' }],
  ['rios', 'take me to the Mississippi please', 'OPEN_RIVER', { id: 'mississippi' }],
  ['rios', 'número 10', 'OPEN_RIVER', { id: 'mekong' }],
  ['rios', 'seven', 'OPEN_RIVER', { id: 'parana' }],
  ['rios', '7', 'OPEN_RIVER', { id: 'parana' }],
  ['rios', 'the third river', 'OPEN_RIVER', { id: 'ganges' }],
  ['rios', 'yankee river', 'OPEN_RIVER', { id: 'yangtse' }],
  ['rios', 'el yeniseo', 'OPEN_RIVER', { id: 'yenisei' }],
  ['rios', 'Yenisei', 'OPEN_RIVER', { id: 'yenisei' }],
  ['rios', 'orinoco', 'OPEN_RIVER', { id: 'orinoco' }],
  ['rios', 'misisipi', 'OPEN_RIVER', { id: 'mississippi' }],
  ['rios', 'mecong', 'OPEN_RIVER', { id: 'mekong' }],
  ['rios', 'amazonas por favor', 'OPEN_RIVER', { id: 'amazonas' }],
  ['rios', 'Yangtze River', 'OPEN_RIVER', { id: 'yangtse' }],
  ['rios', 'pará na', 'OPEN_RIVER', { id: 'parana' }],
  ['rios', 'qué ríos hay', 'LIST_RIVERS'],
  ['rios', 'which rivers are there', 'LIST_RIVERS'],
  ['rios', 'volver', 'BACK'],
  ['rios', 'go back', 'BACK'],
  ['rios', 'go to the start screen', 'GO_HOME'],
  ['bienvenida', 'next', 'NEXT'],
  ['bienvenida', 'Next.', 'NEXT'],
  ['bienvenida', 'siguiente', 'NEXT'],
  ['bienvenida', 'necks', 'NEXT'],
  ['bienvenida', 'Nest.', 'NEXT'],
  ['bienvenida', 'next please', 'NEXT'],
  ['bienvenida', 'continue please', 'NEXT'],
  ['bienvenida', 'ayuda', 'HELP'],
  ['bienvenida', 'what can I say', 'HELP'],
  ['rio', 'start', 'NEXT'],
  ['rio', 'apagá el ancho', 'SET_LAYER', { capa: 1, estado: 'off' }],
  ['rio', 'width off', 'SET_LAYER', { capa: 1, estado: 'off' }],
  ['rio', 'turn on the level', 'SET_LAYER', { capa: 2, estado: 'on' }],
  ['rio', 'slope', 'SET_LAYER', { capa: 3, estado: null }],
  ['rio', 'range', 'SET_LAYER', { capa: 4, estado: null }],
  ['rio', 'the harp', 'SET_LAYER', { capa: 3 }],
  ['rio', 'dos', 'SET_LAYER', { capa: 2, estado: null }],
  ['rio', 'apagá la cuatro', 'SET_LAYER', { capa: 4, estado: 'off' }],
  ['rio', 'with', 'SET_LAYER', { capa: 1 }],
  ['rio', 'river seven', 'OPEN_RIVER', { id: 'parana' }],
  ['rio', 'go to the Lena', 'OPEN_RIVER', { id: 'lena' }],
  ['rio', 'invierno', 'SET_SEASON', { estacion: 'invierno' }],
  ['rio', 'put it in winter', 'SET_SEASON', { estacion: 'invierno' }],
  ['rio', 'invierno no, verano', 'SET_SEASON', { estacion: 'verano' }],
  ['rio', 'fall', 'SET_SEASON', { estacion: 'otono' }],
  ['rio', 'escala global', 'SET_SCALE', { modo: 'global' }],
  ['rio', 'own scale', 'SET_SCALE', { modo: 'propia' }],
  ['rio', 'change the scale', 'SET_SCALE', { modo: null }],
  ['rio', 'cambiar la música', 'SET_MUSIC', { modo: null }],
  ['rio', 'dos octavas', 'SET_MUSIC', { modo: 'dos_octavas' }],
  ['rio', 'two octaves', 'SET_MUSIC', { modo: 'dos_octavas' }],
  ['rio', 'relief', 'SET_MUSIC', { modo: 'relieve' }],
  ['rio', 'acercá', 'ZOOM', { direccion: 'in' }],
  ['rio', 'zoom in', 'ZOOM', { direccion: 'in' }],
  ['rio', 'zoom out', 'ZOOM', { direccion: 'out' }],
  ['rio', 'reset zoom', 'ZOOM', { direccion: 'reset' }],
  ['rio', 'show me the whole river', 'ZOOM', { direccion: 'reset' }],
  ['rio', 'repetir la presentación', 'REPEAT_INTRO'],
  ['rio', 'replay', 'REPEAT_INTRO'],
  ['rio', 'menú', 'BACK'],
  ['rio', 'go back to the menu', 'BACK'],
  ['rio', 'cómo estoy', 'STATUS'],
  ['rio', 'status', 'STATUS'],
  ['rio', 'stop', 'STOP'],
  ['rios', 'la heladera', null],
  ['rios', '', null],
  ['rios', 'no', null],
  ['rios', 'yes', null],
  ['rios', 'sí', 'YES', {}, { pendiente: true }],
  ['rios', 'yes', 'YES', {}, { pendiente: true }],
  ['rios', 'no', 'NO', {}, { pendiente: true }],
  ['rios', 'cancel', 'NO', {}, { pendiente: true }],
];

for (const [vista, frase, intencion, parametros = {}, opciones = {}] of CASOS) {
  test(`${vista}: "${frase}" → ${intencion}`, () => {
    const resultado = interpretar(frase, { vista, ...opciones });
    assert.equal(resultado.intencion, intencion, JSON.stringify(resultado));
    for (const [clave, valor] of Object.entries(parametros)) {
      assert.equal(resultado.parametros[clave], valor, JSON.stringify(resultado));
    }
  });
}

test('un río parecido pero no igual pide confirmación', () => {
  const resultado = interpretar('ganjis', { vista: 'rios' });
  assert.equal(resultado.intencion, 'OPEN_RIVER');
  assert.equal(resultado.parametros.id, 'ganges');
  assert.equal(resultado.confirmar, true);
});

test('se elige la alternativa del reconocedor que se entiende', () => {
  const resultado = interpretar(['para nah', 'paraná'], { vista: 'rios' });
  assert.equal(resultado.parametros.id, 'parana');
  assert.equal(resultado.confirmar, false);
});

test('respeta el orden del menú que se le pasa', () => {
  const resultado = interpretar('one', { vista: 'rios', ordenRios: ['congo', 'amazonas'] });
  assert.equal(resultado.parametros.id, 'congo');
});

test('las acciones del tablero no están disponibles en el menú', () => {
  assert.equal(disponible('SET_LAYER', 'rios'), false);
  assert.equal(disponible('SET_LAYER', 'rio'), true);
  assert.equal(disponible('NEXT', 'bienvenida'), true);
  assert.equal(disponible('BACK', 'bienvenida'), false);
});
