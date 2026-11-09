// Pruebas de estructura del conjunto de iconos propios (components/ui/icons.js).
// No pueden juzgar que un icono "se vea bien": eso se revisa en /laboratorio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICONOS, NOMBRES_ICONOS } from '../components/ui/icons.js';

const REQUERIDOS = ['home', 'chart', 'target', 'wallet', 'heart', 'book', 'library', 'layers', 'search', 'bell', 'plus', 'check',
  'chevronDown', 'chevronRight', 'arrowRight', 'sparkles', 'bolt', 'calendar', 'mail', 'sliders', 'sun', 'moon', 'monitor', 'x',
  'alert', 'trendUp', 'trendDown', 'info', 'flame', 'user', 'users', 'briefcase', 'more', 'clock'];

test('incluye los 34 iconos previstos en el plan', () => {
  for (const n of REQUERIDOS) assert.ok(n in ICONOS, `falta el icono "${n}"`);
  assert.equal(NOMBRES_ICONOS.length, REQUERIDOS.length, 'hay iconos de más o de menos');
});

test('los nombres son únicos y legibles', () => {
  assert.equal(new Set(NOMBRES_ICONOS).size, NOMBRES_ICONOS.length);
  for (const n of NOMBRES_ICONOS) assert.match(n, /^[a-z][A-Za-z]*$/, n);
});

test('cada icono tiene al menos un trazado', () => {
  for (const [n, def] of Object.entries(ICONOS)) {
    assert.ok(Array.isArray(def.d) && def.d.length > 0, n);
  }
});

test('los trazados solo usan comandos y números SVG válidos y empiezan con M', () => {
  for (const [n, def] of Object.entries(ICONOS)) {
    for (const d of def.d) {
      assert.match(d, /^[Mm]/, `${n}: debe empezar con M`);
      assert.match(d, /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,-]+$/, `${n}: caracteres no válidos en "${d}"`);
      const numeros = d.match(/-?\d*\.?\d+/g) ?? [];
      for (const x of numeros) assert.ok(Number.isFinite(Number(x)), `${n}: número inválido ${x}`);
    }
  }
});

test('el grosor opcional es un número razonable', () => {
  for (const [n, def] of Object.entries(ICONOS)) {
    if (def.sw === undefined) continue;
    assert.ok(typeof def.sw === 'number' && def.sw >= 1 && def.sw <= 3.5, `${n}: sw ${def.sw}`);
  }
});

test('no se usan colores dentro de los iconos (solo currentColor desde el componente)', () => {
  const todo = JSON.stringify(ICONOS);
  assert.ok(!/#[0-9a-f]{3,8}|rgb\(|hsl\(/i.test(todo));
});
