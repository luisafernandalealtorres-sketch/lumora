'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { hoyBogota, racha, fechaCorta } from '@/lib/format';

const dia = (base, delta) => {
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('en-CA');
};
const inicioSemana = hoy => {
  const d = new Date(hoy + 'T12:00:00');
  const w = (d.getDay() + 6) % 7; // lunes = 0
  return dia(hoy, -w);
};
const num = v => Number(String(v).replace(',', '.'));
const fmt = n => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 });

function Grafica({ serie, meta }) {
  if (serie.length < 2) return <p className="empty">Registra al menos dos medidas para ver la gráfica.</p>;
  const W = 600, H = 190, P = { l: 44, r: 12, t: 12, b: 26 };
  const vals = serie.map(s => s.valor).concat(meta != null ? [meta] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const t0 = new Date(serie[0].fecha).getTime(), t1 = new Date(serie[serie.length - 1].fecha).getTime() || t0 + 1;
  const x = f => P.l + ((new Date(f).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - P.l - P.r);
  const y = v => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const pts = serie.map(s => `${x(s.fecha)},${y(s.valor)}`).join(' ');
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const ult = serie[serie.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolución de la medida" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{fmt(t)}</text>
        </g>
      ))}
      {meta != null && (
        <g>
          <line x1={P.l} x2={W - P.r} y1={y(meta)} y2={y(meta)} stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={W - P.r} y={y(meta) - 5} textAnchor="end" fontSize="11" fill="var(--warn)">meta {fmt(meta)}</text>
        </g>
      )}
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(ult.fecha)} cy={y(ult.valor)} r="4.5" fill="var(--accent)" />
      <text x={P.l} y={H - 6} fontSize="11" fill="var(--muted)">{fechaCorta(serie[0].fecha)}</text>
      <text x={W - P.r} y={H - 6} textAnchor="end" fontSize="11" fill="var(--muted)">{fechaCorta(ult.fecha)}</text>
    </svg>
  );
}

export default function Salud({ userId, habitos: h0, registros: r0, medidas: m0, objetivos: o0 }) {
  const supabase = createClient();
  const hoy = hoyBogota();
  const [habitos, setHabitos] = useState(h0);
  const [regs, setRegs] = useState(r0);
  const [medidas, setMedidas] = useState(m0);
  const [objetivos, setObjetivos] = useState(o0);
  const [error, setError] = useState('');
  const [fh, setFh] = useState({ nombre: '', tipo: 'check', unidad: '', objetivo: '1', veces: '7' });
  const [fm, setFm] = useState({ fecha: hoy, tipo: 'Peso', unidad: 'kg', valor: '' });
  const [fo, setFo] = useState({ titulo: '', tipo: 'Peso', ini: '', meta: '', fecha: '' });
  const [verTipo, setVerTipo] = useState('Peso');

  const mapa = useMemo(() => {
    const m = new Map();
    regs.forEach(r => m.set(`${r.habito_id}|${r.fecha}`, Number(r.valor)));
    return m;
  }, [regs]);
  const cumplido = (hb, f) => (mapa.get(`${hb.id}|${f}`) ?? 0) >= Number(hb.objetivo_dia);
  const ini = inicioSemana(hoy);
  const semana = Array.from({ length: 7 }, (_, i) => dia(ini, i)).filter(f => f <= hoy);
  const ultimos7 = Array.from({ length: 7 }, (_, i) => dia(hoy, i - 6));

  const hechosHoy = habitos.filter(hb => cumplido(hb, hoy)).length;
  const tipos = [...new Set(['Peso', 'Cintura', ...medidas.map(m => m.tipo)])];

  async function marcar(hb, valor) {
    const f = hoy;
    const k = `${hb.id}|${f}`;
    const antes = regs;
    if (!(valor > 0)) {
      setRegs(regs.filter(r => !(r.habito_id === hb.id && r.fecha === f)));
      const { error } = await supabase.from('habito_registros').delete().eq('habito_id', hb.id).eq('fecha', f);
      if (error) { setRegs(antes); setError('No se pudo guardar.'); }
      return;
    }
    const otros = regs.filter(r => !(r.habito_id === hb.id && r.fecha === f));
    setRegs([...otros, { id: k, habito_id: hb.id, fecha: f, valor, user_id: userId }]);
    const { error } = await supabase.from('habito_registros')
      .upsert({ user_id: userId, habito_id: hb.id, fecha: f, valor }, { onConflict: 'habito_id,fecha' });
    if (error) { setRegs(antes); setError('No se pudo guardar.'); } else setError('');
  }

  async function nuevoHabito(e) {
    e.preventDefault();
    if (!fh.nombre.trim()) return setError('Ponle nombre al hábito.');
    const fila = {
      nombre: fh.nombre.trim(), tipo: fh.tipo, unidad: fh.tipo === 'cantidad' ? fh.unidad.trim() || null : null,
      objetivo_dia: fh.tipo === 'cantidad' ? num(fh.objetivo) || 1 : 1, veces_semana: Math.min(7, Math.max(1, parseInt(fh.veces) || 7)),
    };
    const { data, error } = await supabase.from('habitos').insert(fila).select().single();
    if (error) return setError('No se pudo crear el hábito.');
    setError(''); setHabitos([...habitos, data]);
    setFh({ nombre: '', tipo: 'check', unidad: '', objetivo: '1', veces: '7' });
  }

  async function archivar(hb) {
    setHabitos(habitos.filter(x => x.id !== hb.id));
    const { error } = await supabase.from('habitos').update({ activo: false }).eq('id', hb.id);
    if (error) setHabitos(habitos);
  }

  async function nuevaMedida(e) {
    e.preventDefault();
    const valor = num(fm.valor);
    if (!fm.tipo.trim() || !valor) return setError('Escribe el tipo y el valor de la medida.');
    const { data, error } = await supabase.from('medidas')
      .insert({ fecha: fm.fecha, tipo: fm.tipo.trim(), unidad: fm.unidad.trim() || null, valor }).select().single();
    if (error) return setError('No se pudo guardar la medida.');
    setError(''); setMedidas([...medidas, data].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    setVerTipo(data.tipo); setFm({ ...fm, valor: '' });
  }

  async function borrarMedida(m) {
    const antes = medidas;
    setMedidas(medidas.filter(x => x.id !== m.id));
    const { error } = await supabase.from('medidas').delete().eq('id', m.id);
    if (error) setMedidas(antes);
  }

  async function nuevoObjetivo(e) {
    e.preventDefault();
    const ultima = [...medidas].reverse().find(m => m.tipo === fo.tipo);
    const ini = fo.ini === '' ? ultima?.valor : num(fo.ini);
    const meta = num(fo.meta);
    if (!fo.titulo.trim() || ini == null || !meta || ini === meta) return setError('Completa el título, el valor de inicio y una meta distinta del inicio.');
    const { data, error } = await supabase.from('objetivos_salud').insert({
      titulo: fo.titulo.trim(), medida_tipo: fo.tipo, valor_inicial: ini, valor_meta: meta, fecha_meta: fo.fecha || null,
    }).select().single();
    if (error) return setError('No se pudo crear el objetivo.');
    setError(''); setObjetivos([...objetivos, data]);
    setFo({ titulo: '', tipo: fo.tipo, ini: '', meta: '', fecha: '' });
  }

  async function borrarObjetivo(o) {
    setObjetivos(objetivos.filter(x => x.id !== o.id));
    const { error } = await supabase.from('objetivos_salud').delete().eq('id', o.id);
    if (error) setObjetivos(objetivos);
  }

  const serie = medidas.filter(m => m.tipo === verTipo).map(m => ({ fecha: m.fecha, valor: Number(m.valor) }));
  const objDelTipo = objetivos.find(o => o.medida_tipo === verTipo && !o.logrado);
  const recientes = [...medidas].reverse().slice(0, 6);

  return (
    <>
      <header>
        <div><div className="date">Hábitos, medidas y objetivos</div><h1>Salud</h1></div>
        <div className="stat" style={{ padding: '8px 14px' }}><b>{hechosHoy} de {habitos.length}</b><span>hábitos hoy</span></div>
      </header>
      {error && <div className="err" role="alert">{error}</div>}

      <div className="cols">
        <div className="stack">
          <section>
            <h2>Hábitos de hoy <small>{fechaCorta(hoy)}</small></h2>
            {habitos.length ? (
              <ul>{habitos.map(hb => {
                const fechasOk = regs.filter(r => r.habito_id === hb.id && Number(r.valor) >= Number(hb.objetivo_dia)).map(r => r.fecha);
                const hechosSemana = semana.filter(f => cumplido(hb, f)).length;
                const valorHoy = mapa.get(`${hb.id}|${hoy}`) ?? '';
                return (
                  <li key={hb.id}>
                    <div className="rowx">
                      {hb.tipo === 'check' ? (
                        <label className="todo" style={{ padding: 0 }}>
                          <input type="checkbox" checked={cumplido(hb, hoy)} onChange={e => marcar(hb, e.target.checked ? 1 : 0)} />
                          <span className="from">{hb.nombre}</span>
                        </label>
                      ) : (
                        <label className="todo" style={{ padding: 0, alignItems: 'center' }}>
                          <input type="number" inputMode="decimal" min="0" step="any" defaultValue={valorHoy} aria-label={hb.nombre}
                            style={{ width: 72, font: 'inherit', color: 'inherit', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 8px' }}
                            onBlur={e => marcar(hb, num(e.target.value) || 0)} />
                          <span className="from">{hb.nombre} <span className="sub">de {fmt(hb.objetivo_dia)} {hb.unidad ?? ''}</span></span>
                        </label>
                      )}
                      <button className="link" onClick={() => archivar(hb)}>Archivar</button>
                    </div>
                    <div className="rowx" style={{ marginTop: 4 }}>
                      <span style={{ display: 'flex', gap: 4 }} aria-label="Últimos 7 días">
                        {ultimos7.map(f => (
                          <i key={f} title={fechaCorta(f)} style={{ width: 14, height: 14, borderRadius: 4, background: cumplido(hb, f) ? 'var(--accent)' : 'var(--line)' }} />
                        ))}
                      </span>
                      <span className="sub">racha {racha(fechasOk)} · semana {hechosSemana}/{hb.veces_semana}</span>
                    </div>
                  </li>
                );
              })}</ul>
            ) : <p className="empty">Crea tu primer hábito: tomar agua, caminar, dormir temprano…</p>}
          </section>

          <section>
            <h2>Evolución <small>
              <select id="s-ver" value={verTipo} onChange={e => setVerTipo(e.target.value)} aria-label="Medida"
                style={{ font: 'inherit', background: 'transparent', color: 'inherit', border: 0 }}>
                {tipos.map(t => <option key={t}>{t}</option>)}
              </select></small></h2>
            <Grafica serie={serie} meta={objDelTipo ? Number(objDelTipo.valor_meta) : null} />
            {recientes.length > 0 && (
              <ul style={{ marginTop: 10 }}>{recientes.map(m => (
                <li key={m.id} className="rowx">
                  <span>{m.tipo}: <b className="money">{fmt(m.valor)} {m.unidad ?? ''}</b> <span className="sub">{fechaCorta(m.fecha)}</span></span>
                  <button className="link" onClick={() => borrarMedida(m)}>Borrar</button>
                </li>
              ))}</ul>
            )}
          </section>
        </div>

        <div className="stack">
          <section>
            <h2>Objetivos</h2>
            {objetivos.length ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {objetivos.map(o => {
                  const ult = [...medidas].reverse().find(m => m.tipo === o.medida_tipo);
                  const actual = ult ? Number(ult.valor) : Number(o.valor_inicial);
                  const p = Math.max(0, Math.min(1, (actual - o.valor_inicial) / (o.valor_meta - o.valor_inicial)));
                  return (
                    <div className="avance" key={o.id}>
                      <div className="row"><span className="from">{o.titulo}</span><span className="sub">{p >= 1 ? 'Logrado' : `${Math.round(p * 100)}%`}</span></div>
                      <div className="bar"><i style={{ width: `${p * 100}%` }} /></div>
                      <div className="rowx">
                        <span className="sub">{fmt(o.valor_inicial)} → {fmt(actual)} → meta {fmt(o.valor_meta)}{o.fecha_meta ? ` · para el ${fechaCorta(o.fecha_meta)}` : ''}</span>
                        <button className="link" onClick={() => borrarObjetivo(o)}>Borrar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="empty">Define un objetivo, por ejemplo bajar de peso o reducir cintura.</p>}
            <form className="form" onSubmit={nuevoObjetivo} style={{ marginTop: 14 }}>
              <label>Objetivo<input id="o-titulo" value={fo.titulo} onChange={e => setFo({ ...fo, titulo: e.target.value })} placeholder="Llegar a 62 kg" /></label>
              <div className="two">
                <label>Medida
                  <select id="o-tipo" value={fo.tipo} onChange={e => setFo({ ...fo, tipo: e.target.value })}>{tipos.map(t => <option key={t}>{t}</option>)}</select>
                </label>
                <label>Fecha meta<input id="o-fecha" type="date" value={fo.fecha} onChange={e => setFo({ ...fo, fecha: e.target.value })} /></label>
              </div>
              <div className="two">
                <label>Valor de inicio<input id="o-ini" inputMode="decimal" value={fo.ini} onChange={e => setFo({ ...fo, ini: e.target.value })} placeholder="último registro" /></label>
                <label>Meta<input id="o-meta" inputMode="decimal" value={fo.meta} onChange={e => setFo({ ...fo, meta: e.target.value })} /></label>
              </div>
              <button className="btn" type="submit">Crear objetivo</button>
            </form>
          </section>

          <section>
            <h2>Registrar medida</h2>
            <form className="form" onSubmit={nuevaMedida}>
              <div className="two">
                <label>Fecha<input id="m-fecha" type="date" value={fm.fecha} onChange={e => setFm({ ...fm, fecha: e.target.value })} /></label>
                <label>Valor<input id="m-valor" inputMode="decimal" value={fm.valor} onChange={e => setFm({ ...fm, valor: e.target.value })} /></label>
              </div>
              <div className="two">
                <label>Medida<input id="m-tipo" list="tipos" value={fm.tipo} onChange={e => setFm({ ...fm, tipo: e.target.value })} />
                  <datalist id="tipos">{tipos.map(t => <option key={t} value={t} />)}</datalist></label>
                <label>Unidad<input id="m-unidad" value={fm.unidad} onChange={e => setFm({ ...fm, unidad: e.target.value })} placeholder="kg, cm…" /></label>
              </div>
              <button className="btn sec" type="submit">Guardar medida</button>
            </form>
          </section>

          <section>
            <h2>Nuevo hábito</h2>
            <form className="form" onSubmit={nuevoHabito}>
              <label>Nombre<input id="h-nombre" value={fh.nombre} onChange={e => setFh({ ...fh, nombre: e.target.value })} placeholder="Caminar 30 min" /></label>
              <div className="two">
                <label>Tipo
                  <select id="h-tipo" value={fh.tipo} onChange={e => setFh({ ...fh, tipo: e.target.value })}>
                    <option value="check">Sí o no</option><option value="cantidad">Cantidad</option>
                  </select>
                </label>
                <label>Veces por semana<input id="h-veces" type="number" min="1" max="7" value={fh.veces} onChange={e => setFh({ ...fh, veces: e.target.value })} /></label>
              </div>
              {fh.tipo === 'cantidad' && (
                <div className="two">
                  <label>Objetivo diario<input id="h-obj" inputMode="decimal" value={fh.objetivo} onChange={e => setFh({ ...fh, objetivo: e.target.value })} /></label>
                  <label>Unidad<input id="h-unidad" value={fh.unidad} onChange={e => setFh({ ...fh, unidad: e.target.value })} placeholder="vasos, pasos…" /></label>
                </div>
              )}
              <button className="btn" type="submit">Crear hábito</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
