// Pruebas de lib/ui/anillo.js: geometría del anillo de progreso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometriaAnillo } from '../lib/ui/anillo.js';

const casi = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('la longitud del arco es la fracción de la circunferencia', () => {
  const g = geometriaAnillo({ tamano: 100, grosor: 10, valor: 0.25 });
  casi(g.longitudArco, g.circunferencia * 0.25);
  casi(g.radio, 45);
  casi(g.circunferencia, 2 * Math.PI * 45);
  assert.equal(g.porcentaje, 25);
  assert.equal(g.estado, 'ok');
});

test('el valor 1 completa el anillo y el 0 real no dibuja arco', () => {
  const lleno = geometriaAnillo({ tamano: 100, valor: 1 });
  casi(lleno.longitudArco, lleno.circunferencia);
  const cero = geometriaAnillo({ tamano: 100, valor: 0 });
  assert.equal(cero.longitudArco, 0);
  assert.equal(cero.estado, 'ok');
  assert.equal(cero.porcentaje, 0);
});

test('un valor ausente o inválido es "sin datos" y no dibuja arco', () => {
  for (const v of [null, undefined, NaN, Infinity, '0.5', {}]) {
    const g = geometriaAnillo({ valor: v });
    assert.equal(g.estado, 'sin-datos', String(v));
    assert.equal(g.longitudArco, 0, String(v));
    assert.equal(g.porcentaje, null, String(v));
  }
});

test('valores fuera de rango se acotan', () => {
  const g = geometriaAnillo({ tamano: 80, valor: 2.5 });
  casi(g.longitudArco, g.circunferencia);
  assert.equal(geometriaAnillo({ valor: -1 }).longitudArco, 0);
});

test('el radio siempre es positivo, aunque el grosor sea enorme o el tamaño inválido', () => {
  for (const entrada of [{ tamano: 40, grosor: 500 }, { tamano: 0 }, { tamano: -10 }, { tamano: NaN }, { grosor: -3 }, { grosor: NaN }]) {
    const g = geometriaAnillo({ ...entrada, valor: 0.5 });
    assert.ok(g.radio > 0, JSON.stringify(entrada));
    assert.ok(Number.isFinite(g.circunferencia) && g.circunferencia > 0, JSON.stringify(entrada));
    assert.ok(g.grosor > 0);
  }
});

test('el trazo cabe dentro del recuadro', () => {
  const g = geometriaAnillo({ tamano: 96, grosor: 12, valor: 0.5 });
  assert.ok(g.radio + g.grosor / 2 <= g.tamano / 2 + 1e-9);
  assert.equal(g.centro, 48);
});

test('sin argumentos usa los valores por defecto y "sin datos"', () => {
  const g = geometriaAnillo();
  assert.equal(g.tamano, 96);
  assert.equal(g.grosor, 10);
  assert.equal(g.estado, 'sin-datos');
});

test('ningún campo numérico es NaN', () => {
  for (const v of [0, 0.3, 1, 7, null, NaN]) {
    const g = geometriaAnillo({ valor: v });
    for (const k of ['tamano', 'grosor', 'centro', 'radio', 'circunferencia', 'longitudArco']) assert.ok(Number.isFinite(g[k]), `${k} con ${v}`);
  }
});
