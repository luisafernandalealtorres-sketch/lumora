// Compara el lunes calculado por SQL con `inicioSemana` / `fechaBogota` del dominio JavaScript de la aplicación.
// Solo LEE el módulo de la aplicación (web/lib/domain/fechas.js); no lo modifica.
// Uso: node 93_comparar_con_js.mjs <ruta-fechas.js> <csv-de-93_frontera_lunes_muestra>
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const [, , rutaFechas, rutaCsv] = process.argv;
const { inicioSemana, fechaBogota } = await import(pathToFileURL(rutaFechas).href);
const lineas = fs.readFileSync(rutaCsv, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
let diferencias = 0;
const ejemplos = [];
for (const l of lineas) {
  const [iso, sql] = l.split(',');
  const js = inicioSemana(fechaBogota(new Date(iso)));
  if (js !== sql) { diferencias++; if (ejemplos.length < 5) ejemplos.push(`${iso}: SQL=${sql} JS=${js}`); }
}
console.log(JSON.stringify({ comparados: lineas.length, diferencias, ejemplos }));
process.exit(diferencias === 0 ? 0 : 1);
