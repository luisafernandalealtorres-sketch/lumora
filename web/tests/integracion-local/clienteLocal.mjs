// Cliente con la forma mínima de @supabase/supabase-js (from/select/eq/in/order/limit/maybeSingle/upsert, rpc, auth.getUser)
// que ejecuta cada llamada como el rol `authenticated` en un PostgreSQL LOCAL y desechable. NO es un simulador: toda
// escritura y lectura pasa por la base real (RLS, privilegios y funciones del SQL v1.11). No se conecta a Supabase.
import { execFileSync } from 'node:child_process';

const lit = v => {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `'{${v.join(',')}}'`;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ident = s => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`identificador no permitido: ${s}`);
  return s;
};

export function crearEjecutorSql({ bin, puerto, base }) {
  return function ejecutar(sql, { usuario = 'sb_owner' } = {}) {
    try {
      const salida = execFileSync(`${bin}/psql`, ['-h', '127.0.0.1', '-p', String(puerto), '-U', usuario, '-d', base, '-X', '-q', '-A', '-t',
        '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', '-'], { encoding: 'utf8', input: sql, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
      return { salida: salida.trim(), error: null };
    } catch (e) {
      const err = String(e.stderr ?? e.message);
      const m = /ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/.exec(err);
      const d = /(?:DETAIL|DETALLE):\s+([^\n]*)/.exec(err);
      return { salida: '', error: { code: m?.[1] ?? 'XX000', message: (m?.[2] ?? err).trim(), details: d?.[1]?.trim() ?? null } };
    }
  };
}

export function crearClienteLocal({ ejecutar, uid }) {
  const claims = JSON.stringify({ sub: uid, role: 'authenticated' });
  const comoUsuario = consulta => `begin; select set_config('request.jwt.claims', ${lit(claims)}, true); set local role authenticated; ${consulta}; commit;`;
  const correr = consulta => {
    const r = ejecutar(comoUsuario(consulta));
    if (r.error) return { data: null, error: r.error };
    const texto = r.salida.split(/\r?\n/).filter(l => l.trim() && !/^(set_config|SET|BEGIN|COMMIT)\b/.test(l) && !l.startsWith('{"sub"')).join(' ');
    return { data: texto ? JSON.parse(texto) : null, error: null };
  };

  function constructor(tabla) {
    const q = { cols: '*', filtros: [], orden: [], limite: null, modo: 'lista', upsert: null };
    const b = {
      select(cols = '*') { q.cols = cols === '*' ? '*' : cols.split(',').map(c => ident(c.trim())).join(', '); return b; },
      eq(c, v) { q.filtros.push(`${ident(c)} = ${lit(v)}`); return b; },
      gte(c, v) { q.filtros.push(`${ident(c)} >= ${lit(v)}`); return b; },
      lt(c, v) { q.filtros.push(`${ident(c)} < ${lit(v)}`); return b; },
      delete() { q.borrar = true; return b; },
      update(fila) { q.actualizar = fila; return b; },
      in(c, arr) { q.filtros.push(`${ident(c)} in (${arr.map(lit).join(', ')})`); return b; },
      order(c, { ascending = true, nullsFirst } = {}) { q.orden.push(`${ident(c)} ${ascending ? 'asc' : 'desc'}${nullsFirst === undefined ? '' : nullsFirst ? ' nulls first' : ' nulls last'}`); return b; },
      range(a, b) { q.rango = [a, b]; return b_; },
      limit(n) { q.limite = n; return b; },
      range(a, z) { q.limite = z - a + 1; q.desplazamiento = a; return b; },
      maybeSingle() { q.modo = 'quizas'; return b; },
      single() { q.modo = 'unica'; return b; },
      upsert(fila, { onConflict } = {}) { q.upsert = { fila, onConflict }; return b; },
      then(ok, ko) { return Promise.resolve(ejecutarConstruido()).then(ok, ko); },
    };
    function ejecutarConstruido() {
      if (q.upsert) {
        const cols = Object.keys(q.upsert.fila).map(ident);
        const vals = Object.values(q.upsert.fila).map(lit);
        const conflicto = q.upsert.onConflict.split(',').map(c => ident(c.trim()));
        const sets = cols.filter(c => !conflicto.includes(c)).map(c => `${c} = excluded.${c}`).join(', ');
        const r = correr(`with i as (insert into public.${ident(tabla)} (${cols.join(', ')}) values (${vals.join(', ')}) on conflict (${conflicto.join(', ')}) do update set ${sets} returning *) select row_to_json(i) from i`);
        return r;
      }
      if (q.borrar) {
        const w = q.filtros.length ? ` where ${q.filtros.join(' and ')}` : '';
        const r = correr(`with d as (delete from public.${ident(tabla)}${w} returning 1) select count(*) from d`);
        return r.error ? r : { data: null, error: null };
      }
      if (q.actualizar) {
        const w = q.filtros.length ? ` where ${q.filtros.join(' and ')}` : '';
        const sets = Object.entries(q.actualizar).map(([c, v]) => `${ident(c)} = ${lit(v)}`).join(', ');
        const r = correr(`with u as (update public.${ident(tabla)} set ${sets}${w} returning *) select row_to_json(u) from u`);
        if (r.error) return r;
        return r.data ? r : { data: null, error: { code: 'PGRST116', message: 'ninguna fila actualizada' } };
      }
      const donde = q.filtros.length ? ` where ${q.filtros.join(' and ')}` : '';
      const orden = q.orden.length ? ` order by ${q.orden.join(', ')}` : '';
      const lim = (q.limite ? ` limit ${Number(q.limite)}` : (q.modo === 'lista' ? '' : ' limit 2')) + (q.desplazamiento ? ` offset ${Number(q.desplazamiento)}` : '');
      const r = correr(`select coalesce(json_agg(t), '[]'::json) from (select ${q.cols} from public.${ident(tabla)}${donde}${orden}${lim}) t`);
      if (r.error) return r;
      if (q.modo === 'lista') return r;
      const filas = r.data;
      if (q.modo === 'quizas') return filas.length > 1 ? { data: null, error: { code: 'PGRST116', message: 'más de una fila' } } : { data: filas[0] ?? null, error: null };
      return filas.length === 1 ? { data: filas[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'se esperaba una fila' } };
    }
    return b;
  }

  return {
    from: constructor,
    rpc(nombre, args = {}) {
      const params = Object.entries(args).map(([k, v]) => `${ident(k)} => ${lit(v)}`).join(', ');
      return Promise.resolve(correr(`select to_json(t) from public.${ident(nombre)}(${params}) t`));
    },
    auth: { getUser: async () => ({ data: { user: { id: uid } }, error: null }) },
  };
}
