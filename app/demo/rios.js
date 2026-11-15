// Cómo se muestra cada río en la interfaz, que está en inglés. El orden es el del menú, de mayor a
// menor caudal medio (ver app/README.md), y el número de cada etiqueta sale de este orden.
// Un río de datos/indice.json que no esté acá se agrega al final con el nombre de sus datos.
window.RIOS_INTERFAZ = [
  { id: 'amazonas', nombre: 'Amazon' },
  { id: 'congo', nombre: 'Congo' },
  { id: 'ganges', nombre: 'Ganges' },
  { id: 'orinoco', nombre: 'Orinoco' },
  { id: 'yangtse', nombre: 'Yangtze' },
  { id: 'yenisei', nombre: 'Yenisei' },
  { id: 'parana', nombre: 'Paraná' },
  { id: 'lena', nombre: 'Lena' },
  { id: 'mississippi', nombre: 'Mississippi' },
  { id: 'mekong', nombre: 'Mekong' },
];

// Ciudades que en rios/<id>.json están con su nombre en castellano
window.CIUDADES_INTERFAZ = {
  'Nueva Orleans': 'New Orleans',
  'San Luis': 'St. Louis',
  Manaos: 'Manaus',
  Kinsasa: 'Kinshasa',
  'Benarés': 'Varanasi',
  'Nankín': 'Nanjing',
  'Nom Pen': 'Phnom Penh',
  'Vientián': 'Vientiane',
  Kiusiur: 'Kyusyur',
};
