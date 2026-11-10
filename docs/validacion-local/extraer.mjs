// Extrae los bloques ```sql de docs/MIGRACIONES-FASE-3-v1.8.md a archivos (solo lectura del documento).
import fs from 'node:fs';
import path from 'node:path';

const doc = 'C:/Users/luisa/Documents/Claude/Personal/lu_brain/docs/MIGRACIONES-FASE-3-v1.8.md';
const out = 'C:/Users/luisa/AppData/Local/Temp/claude/f2ce733abb43d3b1/a4799f8c-a67c-477e-be79-934b6dadce6c/scratchpad/pgtest/sql';
fs.mkdirSync(out, { recursive: true });
const lines = fs.readFileSync(doc, 'utf8').split(/\r?\n/);
let clave = null;
let dentro = false;
let buf = [];
const vistos = new Set();
for (const l of lines) {
  const h = l.match(/^### (\d)\.([USDV])\b/);
  if (h && !dentro) { clave = `e${h[1]}_${h[2]}`; continue; }
  if (/^## /.test(l) && !dentro) { clave = null; continue; }
  if (clave && !dentro && l.startsWith('```sql')) { dentro = true; buf = []; continue; }
  if (dentro && l.startsWith('```')) {
    dentro = false;
    if (!vistos.has(clave)) {
      fs.writeFileSync(path.join(out, `${clave}.sql`), buf.join('\n') + '\n');
      vistos.add(clave);
    }
    continue;
  }
  if (dentro) buf.push(l);
}
console.log([...vistos].sort().join(' '));
