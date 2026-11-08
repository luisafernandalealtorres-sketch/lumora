// Pruebas de web/styles/tokens.css: valores de la especificación, estructura de temas y contraste WCAG.
// Lee el CSS real; si alguien cambia un color y rompe el contraste, esta prueba falla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// ---------- Lectura del CSS ----------
const declaraciones = bloque => {
  const out = {};
  for (const linea of bloque.split(';')) {
    const m = linea.match(/^\s*(--[\w-]+|color-scheme)\s*:\s*([\s\S]+?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ');
  }
  return out;
};
const bloque = re => {
  const m = css.match(re);
  assert.ok(m, 'No se encontró el bloque ' + re);
  return declaraciones(m[1]);
};

const base = bloque(/(?:^|\})\s*:root\s*\{([^}]*)\}/);
const oscuroMedia = bloque(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/);
const oscuroAtributo = bloque(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
const claroAtributo = bloque(/:root\[data-theme="light"\]\s*\{([^}]*)\}/);

const temas = {
  claro: { ...base },
  oscuro: { ...base, ...oscuroAtributo },
};

// ---------- Color y contraste ----------
function parseColor(valor) {
  const hex = valor.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { rgb: [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)), a: 1 };
  const rgba = valor.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgba) return { rgb: [+rgba[1], +rgba[2], +rgba[3]], a: rgba[4] === undefined ? 1 : +rgba[4] };
  throw new Error('Color no reconocido: ' + valor);
}
const mezclar = (frente, fondo) => frente.rgb.map((v, i) => Math.round(v * frente.a + fondo.rgb[i] * (1 - frente.a)));
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Color opaco de un token. Si es translúcido se compone sobre `sobre` (otro token).
function color(tema, token, sobre) {
  const v = temas[tema][token];
  assert.ok(v, `El token ${token} no existe en el tema ${tema}`);
  const c = parseColor(v);
  if (c.a === 1) return c.rgb;
  assert.ok(sobre, `${token} es translúcido: indica sobre qué fondo se compone`);
  return mezclar(c, { rgb: color(tema, sobre) });
}

// ---------- 1. Valores de la especificación (sin alteración) ----------
test('paleta oscura: los 11 valores de la especificación se usan tal cual', () => {
  const esperado = {
    '--ds-bg': '#0B0B16', '--ds-bg-2': '#111020', '--ds-surface': '#19182B', '--ds-surface-raised': '#242239',
    '--ds-primary': '#A78BFA', '--ds-secondary': '#60A5FA', '--ds-success': '#34D399', '--ds-warning': '#FBBF24',
    '--ds-danger': '#F87171', '--ds-text': '#F8FAFC', '--ds-text-2': '#A1A1B5',
  };
  for (const [k, v] of Object.entries(esperado)) assert.equal(temas.oscuro[k], v, k);
});

test('paleta clara: los 5 valores de la especificación se usan tal cual', () => {
  const esperado = { '--ds-bg': '#F5F4FA', '--ds-surface': '#FFFFFF', '--ds-primary': '#7654CB', '--ds-text': '#28223D', '--ds-text-2': '#716B82' };
  for (const [k, v] of Object.entries(esperado)) assert.equal(temas.claro[k], v, k);
});

test('tonos derivados aprobados (D-F4) para el modo claro', () => {
  assert.equal(temas.claro['--ds-success'], '#15803D');
  assert.equal(temas.claro['--ds-warning'], '#B45309');
  assert.equal(temas.claro['--ds-danger'], '#B91C1C');
  assert.equal(temas.claro['--ds-secondary'], '#2563EB');
});

// ---------- 2. Estructura de temas ----------
test('los dos bloques oscuros son idénticos (sistema y data-theme="dark")', () => {
  assert.deepEqual(oscuroMedia, oscuroAtributo);
});

test('todo token que redefine el tema oscuro nace primero en :root', () => {
  for (const k of Object.keys(oscuroAtributo)) {
    if (k === 'color-scheme') continue;
    assert.ok(k in base, `${k} solo está definido en el bloque oscuro`);
  }
});

test('todo token de color del tema claro tiene su equivalente oscuro', () => {
  const dePaleta = Object.keys(base).filter(k => /^--ds-(bg|bg-2|surface|surface-raised|text|text-2|primary|primary-soft|on-primary|secondary|success|success-soft|warning|warning-soft|danger|danger-soft|border|border-strong|focus|frente-[a-z]+(-soft)?|grad-\d|glow|shadow-\d)$/.test(k));
  for (const k of dePaleta) {
    // Un token compuesto con var() de otros tokens de tema (p. ej. el degradado) se recalcula solo.
    if (base[k].includes('var(--ds-')) continue;
    assert.ok(k in oscuroAtributo, `${k} no tiene valor oscuro`);
  }
});

test(':root no declara color-scheme (las pantallas antiguas conservan su comportamiento)', () => {
  assert.ok(!('color-scheme' in base));
});

test('los modos forzados informan color-scheme al navegador', () => {
  assert.equal(oscuroAtributo['color-scheme'], 'dark');
  assert.equal(claroAtributo['color-scheme'], 'light');
});

// ---------- 3. Contraste ----------
const FRENTES = ['tanku', 'ticketcode', 'personal', 'salud', 'familia', 'otros'];

for (const tema of ['claro', 'oscuro']) {
  test(`${tema}: texto principal y secundario sobre fondo, superficie y elevada (>= 4,5:1)`, () => {
    for (const fg of ['--ds-text', '--ds-text-2']) {
      for (const bg of ['--ds-bg', '--ds-surface', '--ds-surface-raised']) {
        const r = ratio(color(tema, fg), color(tema, bg));
        assert.ok(r >= 4.5, `${fg} sobre ${bg}: ${r.toFixed(2)}:1`);
      }
    }
  });

  test(`${tema}: el texto principal sobre el fondo secundario (>= 4,5:1)`, () => {
    const r = ratio(color(tema, '--ds-text'), color(tema, '--ds-bg-2'));
    assert.ok(r >= 4.5, r.toFixed(2));
  });

  test(`${tema}: el texto secundario sobre el fondo secundario (solo se exige en oscuro)`, () => {
    if (tema === 'claro') return; // En claro bg-2 es solo un relleno; el texto secundario no va encima.
    const r = ratio(color(tema, '--ds-text-2'), color(tema, '--ds-bg-2'));
    assert.ok(r >= 4.5, r.toFixed(2));
  });

  test(`${tema}: acentos y estados como texto o icono sobre superficie y fondo (>= 4,5:1)`, () => {
    for (const fg of ['--ds-primary', '--ds-secondary', '--ds-success', '--ds-warning', '--ds-danger']) {
      for (const bg of ['--ds-surface', '--ds-bg']) {
        const r = ratio(color(tema, fg), color(tema, bg));
        assert.ok(r >= 4.5, `${fg} sobre ${bg}: ${r.toFixed(2)}:1`);
      }
    }
  });

  test(`${tema}: texto sobre el botón primario (>= 4,5:1)`, () => {
    const r = ratio(color(tema, '--ds-on-primary'), color(tema, '--ds-primary'));
    assert.ok(r >= 4.5, r.toFixed(2));
  });

  test(`${tema}: acento y estados sobre su propio fondo suave (>= 4,5:1)`, () => {
    for (const [fg, soft] of [['--ds-primary', '--ds-primary-soft'], ['--ds-success', '--ds-success-soft'],
      ['--ds-warning', '--ds-warning-soft'], ['--ds-danger', '--ds-danger-soft']]) {
      const r = ratio(color(tema, fg), color(tema, soft, '--ds-surface'));
      assert.ok(r >= 4.5, `${fg} sobre ${soft}: ${r.toFixed(2)}:1`);
    }
  });

  test(`${tema}: los seis frentes existen y se leen sobre superficie y sobre su chip (>= 4,5:1)`, () => {
    for (const f of FRENTES) {
      const fg = `--ds-frente-${f}`;
      const soft = `--ds-frente-${f}-soft`;
      const sobreSuperficie = ratio(color(tema, fg), color(tema, '--ds-surface'));
      const sobreChip = ratio(color(tema, fg), color(tema, soft, '--ds-surface'));
      assert.ok(sobreSuperficie >= 4.5, `${f} sobre superficie: ${sobreSuperficie.toFixed(2)}:1`);
      assert.ok(sobreChip >= 4.5, `${f} sobre su chip: ${sobreChip.toFixed(2)}:1`);
    }
  });

  test(`${tema}: bordes de controles y anillo de foco (>= 3:1)`, () => {
    for (const fg of ['--ds-border-strong', '--ds-focus']) {
      for (const bg of ['--ds-surface', '--ds-bg']) {
        const r = ratio(color(tema, fg), color(tema, bg));
        assert.ok(r >= 3, `${fg} sobre ${bg}: ${r.toFixed(2)}:1`);
      }
    }
  });

  test(`${tema}: el texto principal se lee sobre los tres puntos del degradado del encabezado (>= 4,5:1)`, () => {
    for (const g of ['--ds-grad-1', '--ds-grad-2', '--ds-grad-3']) {
      const r = ratio(color(tema, '--ds-text'), color(tema, g));
      assert.ok(r >= 4.5, `${g}: ${r.toFixed(2)}:1`);
    }
  });
}
