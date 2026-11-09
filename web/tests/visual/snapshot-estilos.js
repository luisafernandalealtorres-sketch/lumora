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

// ---------------------------------------------------------------------------
// Modo con ALCANCE AL CONTENIDO (Fase 2).
//
// Compara solo lo que hay dentro de la columna de contenido de cada pantalla
// (el contenedor `.wrap`, sin el menú `<nav>`), para poder cambiar el menú sin
// ruido. Excluye las propiedades que dependen del ancho del contenedor
// (width, height, gridTemplateColumns): cambian legítimamente junto a una barra
// lateral y se revisan aparte con las pruebas responsive.
//
// Mismo procedimiento que arriba; la etiqueta lleva el prefijo `c|`.
//   guardar:  new Function('return (' + localStorage.getItem('__snapfn2') + ')')()('c|/ruta|1280-claro', 'guardar')
//   comparar: ...()('c|/ruta|1280-claro', 'comparar')
// ---------------------------------------------------------------------------
const fnContenido = function (label, modo) {
  const P = ['display', 'position', 'color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor',
    'borderLeftWidth', 'borderRightWidth', 'borderTopLeftRadius', 'rowGap', 'columnGap', 'flexDirection', 'flexWrap',
    'justifyContent', 'alignItems', 'opacity', 'textDecorationLine', 'boxShadow',
    'overflowX', 'textTransform', 'cursor', 'accentColor', 'outlineStyle', 'listStyleType', 'textAlign',
    'whiteSpace', 'verticalAlign'];
  const omit = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TITLE', 'NEXTJS-PORTAL'];
  const wrap = document.querySelector('main#contenido > .wrap') || document.querySelector('body > div > .wrap, body > .wrap, .wrap');
  if (!wrap) return { error: 'no se encontró .wrap' };
  const nodes = [wrap];
  for (const hijo of wrap.children) {
    if (hijo.tagName === 'NAV') continue;
    nodes.push(hijo, ...hijo.querySelectorAll('*'));
  }
  const filtrados = nodes.filter(e => !omit.includes(e.tagName));
  const rows = filtrados.map(e => {
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
    if (b[i] === undefined || rows[i] === undefined) { dif.push({ i, nota: 'cantidad de elementos distinta' }); continue; }
    const A = b[i].split('|'), B = rows[i].split('|');
    const props = [];
    for (let k = 1; k < A.length; k++) {
      // Los márgenes laterales de .wrap (margin: 0 auto) dependen del ancho del contenedor: se excluyen del elemento raíz
      // y se verifican aparte (max-width 1040 px y centrado) más abajo.
      if (i === 0 && /^margin(Left|Right)$/.test(P[k - 1])) continue;
      if (A[k] !== B[k]) props.push(P[k - 1] + ': ' + A[k] + ' -> ' + B[k]);
    }
    if (!props.length) continue;
    dif.push({ i, el: A[0], cambios: props.slice(0, 4) });
  }
  // Contrato de .wrap: ancho máximo 1040 px y centrado (márgenes laterales iguales).
  const csw = getComputedStyle(wrap);
  if (csw.maxWidth !== '1040px') dif.push({ el: '.wrap', cambios: ['maxWidth: ' + csw.maxWidth] });
  if (csw.marginLeft !== csw.marginRight) dif.push({ el: '.wrap', cambios: ['descentrado: ' + csw.marginLeft + ' / ' + csw.marginRight] });
  return { etiqueta: label, elementosAntes: b.length, elementosAhora: rows.length, diferencias: dif.length, detalle: dif.slice(0, 12) };
};
