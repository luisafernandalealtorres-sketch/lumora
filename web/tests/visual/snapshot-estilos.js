// Captura de estilos calculados para detectar regresiones visuales entre versiones.
//
// No es una prueba de `npm test`: se ejecuta dentro del navegador con una sesión iniciada.
// Ver tests/visual/README.md para el procedimiento.
//
// Uso (desde la consola del navegador o desde una herramienta de inspección):
//   1. Pegar esta función como `const fn = ...;` y guardarla:  localStorage.setItem('__snapfn', String(fn))
//   2. En cada pantalla:  new Function('return (' + localStorage.getItem('__snapfn') + ')')()('base|/ruta|esc-tema', 'guardar')
//   3. Tras los cambios:  ...()('base|/ruta|esc-tema', 'comparar')   ->  { diferencias: 0, ... }
const fn = function (label, modo) {
  const P = ['display', 'position', 'color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor',
    'borderLeftWidth', 'borderRightWidth', 'borderTopLeftRadius', 'rowGap', 'columnGap', 'flexDirection', 'flexWrap',
    'justifyContent', 'alignItems', 'gridTemplateColumns', 'width', 'height', 'opacity', 'textDecorationLine', 'boxShadow',
    'overflowX', 'textTransform', 'cursor', 'accentColor', 'colorScheme', 'outlineStyle', 'listStyleType', 'textAlign',
    'whiteSpace', 'verticalAlign'];
  const omit = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TITLE', 'NEXTJS-PORTAL'];
  const nodes = [document.documentElement, ...document.body.querySelectorAll('*')].filter(e => !omit.includes(e.tagName));
  const rows = nodes.map(e => {
    const cs = getComputedStyle(e);
    const cls = (typeof e.className === 'string' ? e.className : '').replace(/__\w+/g, '~');
    const etiqueta = (e.tagName + '#' + (e.id || '') + '.' + cls).slice(0, 70);
    return etiqueta + '|' + P.map(p => cs[p]).join('|');
  });
  if (modo === 'guardar') {
    const txt = rows.join('\n');
    localStorage.setItem('snap|' + label, txt);
    return { guardado: label, elementos: rows.length, bytes: txt.length };
  }
  const base = localStorage.getItem('snap|' + label);
  if (base === null) return { error: 'no hay línea base para ' + label };
  const b = base.split('\n');
  const dif = [];
  const n = Math.max(b.length, rows.length);
  for (let i = 0; i < n; i++) {
    if (b[i] === rows[i]) continue;
    if (b[i] === undefined || rows[i] === undefined) {
      dif.push({ i, nota: 'cantidad de elementos distinta', antes: b[i] && b[i].split('|')[0], ahora: rows[i] && rows[i].split('|')[0] });
      continue;
    }
    const A = b[i].split('|'), B = rows[i].split('|');
    const props = [];
    for (let k = 1; k < A.length; k++) if (A[k] !== B[k]) props.push(P[k - 1] + ': ' + A[k] + ' -> ' + B[k]);
    dif.push({ i, el: A[0], cambios: props.slice(0, 4) });
  }
  return { etiqueta: label, elementosAntes: b.length, elementosAhora: rows.length, diferencias: dif.length, detalle: dif.slice(0, 12) };
};
