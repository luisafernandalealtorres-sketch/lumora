// Pruebas de lib/ui/sparkline.js: cálculo de la minigráfica de tendencia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararSerie, describirSerie } from '../lib/ui/sparkline.js';

const dentro = (s) => {
  for (const p of s.puntos) {
    assert.ok(p.x >= s.margen - 0.01 && p.x <= s.ancho - s.margen + 0.01, `x fuera: ${p.x}`);
    assert.ok(p.y >= s.margen - 0.01 && p.y <= s.alto - s.margen + 0.01, `y fuera: ${p.y}`);
  }
};

test('una serie válida produce un trazo con un punto por valor', () => {
  const s = prepararSerie([1, 3, 2, 5]);
  assert.equal(s.estado, 'ok');
  assert.equal(s.cantidad, 4);
  assert.equal(s.puntos.length, 4);
  assert.match(s.trazo, /^M[\d. ]+(L[\d. ]+){3}$/);
  assert.equal(s.min, 1);
  assert.equal(s.max, 5);
  assert.equal(s.ultimo.valor, 5);
});

test('todas las coordenadas quedan dentro del recuadro', () => {
  dentro(prepararSerie([10, -4, 7, 100, 0, 55]));
  dentro(prepararSerie([3, 3, 3]));
  dentro(prepararSerie([1, 2], { ancho: 200, alto: 60, margen: 8 }));
});

test('un valor mayor queda más arriba (y menor) y el último punto es el final de la serie', () => {
  const s = prepararSerie([0, 10]);
  assert.ok(s.puntos[1].y < s.puntos[0].y);
  assert.equal(s.ultimo.x, s.puntos[1].x);
});

test('con menos de 2 valores válidos es "insuficiente": no hay tendencia', () => {
  for (const serie of [[], [5], [NaN, 5], [null, undefined, 3], undefined, null, 'abc', {}]) {
    assert.equal(prepararSerie(serie).estado, 'insuficiente', JSON.stringify(serie));
  }
});

test('descarta valores no numéricos o no finitos sin interpolarlos', () => {
  const s = prepararSerie([1, NaN, '5', null, Infinity, 3, undefined, 4]);
  assert.equal(s.estado, 'ok');
  assert.equal(s.cantidad, 3);
  assert.deepEqual(s.puntos.map(p => p.valor), [1, 3, 4]);
});

test('una serie plana se dibuja al centro, sin dividir por cero', () => {
  const s = prepararSerie([7, 7, 7, 7], { alto: 40, margen: 4 });
  assert.equal(s.estado, 'ok');
  for (const p of s.puntos) { assert.ok(Number.isFinite(p.y)); assert.equal(p.y, 20); }
});

test('la meta entra en el rango vertical y devuelve su posición', () => {
  const sin = prepararSerie([1, 2, 3]);
  const con = prepararSerie([1, 2, 3], { meta: 10 });
  assert.equal(sin.yMeta, null);
  assert.ok(Number.isFinite(con.yMeta));
  assert.ok(con.yMeta >= con.margen - 0.01 && con.yMeta <= con.alto - con.margen + 0.01);
  assert.ok(con.yMeta < con.ultimo.y, 'la meta más alta que los datos queda más arriba');
  dentro(con);
});

test('una meta inválida se ignora', () => {
  assert.equal(prepararSerie([1, 2], { meta: NaN }).yMeta, null);
  assert.equal(prepararSerie([1, 2], { meta: '5' }).yMeta, null);
});

test('el área cierra el trazo hasta la base', () => {
  const s = prepararSerie([1, 4, 2]);
  assert.ok(s.area.startsWith(s.trazo));
  assert.ok(s.area.endsWith('Z'));
});

test('ningún número del resultado es NaN', () => {
  const s = prepararSerie([2, 8, 5, 5, 9], { meta: 6 });
  for (const p of s.puntos) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.ok(!/NaN|undefined|Infinity/.test(s.trazo + s.area));
});

test('describirSerie resume la serie para lectores de pantalla', () => {
  const s = prepararSerie([2, 9, 5]);
  const t = describirSerie('Gasto', s, n => `$${n}`);
  assert.equal(t, 'Gasto: 3 puntos, de $2 a $9, último $5');
  assert.equal(describirSerie('Gasto', prepararSerie([1])), 'Gasto: datos insuficientes');
});
