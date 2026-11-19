'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Pantalla from '@/components/ui/Pantalla';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Ring from '@/components/ui/Ring';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { hoyBogota, racha, fechaCorta } from '@/lib/format';
import estilos from './Salud.module.css';

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
const inicialDia = f => new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'narrow' }).toUpperCase();
const nombreDia = f => new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' });
const num = v => Number(String(v).replace(',', '.'));
const fmt = n => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 });

const VISTAS = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'medidas', nombre: 'Medidas' },
  { id: 'objetivos', nombre: 'Objetivos' },
  { id: 'habito', nombre: 'Hábito nuevo' },
];

function Grafica({ serie, meta }) {
  if (serie.length < 2) return <p className={estilos.vacio}>Registra al menos dos medidas para ver la gráfica.</p>;
  const W = 420, H = 240, P = { l: 48, r: 12, t: 14, b: 30 };
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
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución de la medida. Último valor ${fmt(ult.valor)} el ${fechaCorta(ult.fecha)}${meta != null ? `. Meta ${fmt(meta)}` : ''}.`} className={estilos.grafica}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line className={estilos.gLinea} x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} strokeWidth="1" />
          <text className={estilos.gTexto} x={P.l - 6} y={y(t) + 5} textAnchor="end" fontSize="13">{fmt(t)}</text>
        </g>
      ))}
      {meta != null && (
        <g>
          <line className={estilos.gMeta} x1={P.l} x2={W - P.r} y1={y(meta)} y2={y(meta)} strokeWidth="1.5" strokeDasharray="5 4" />
          <text className={estilos.gMetaTexto} x={W - P.r} y={y(meta) - 6} textAnchor="end" fontSize="13">meta {fmt(meta)}</text>
        </g>
      )}
      <polyline className={estilos.gSerie} points={pts} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle className={estilos.gPunto} cx={x(ult.fecha)} cy={y(ult.valor)} r="5" />
      <text className={estilos.gTexto} x={P.l} y={H - 8} fontSize="13">{fechaCorta(serie[0].fecha)}</text>
      <text className={estilos.gTexto} x={W - P.r} y={H - 8} textAnchor="end" fontSize="13">{fechaCorta(ult.fecha)}</text>
    </svg>
  );
}

export default function SaludPanel({ userId, habitos: h0, registros: r0, medidas: m0, objetivos: o0 }) {
  const supabase = createClient();
  const hoy = hoyBogota();
  const [habitos, setHabitos] = useState(h0);
  const [regs, setRegs] = useState(r0);
  const [medidas, setMedidas] = useState(m0);
  const [objetivos, setObjetivos] = useState(o0);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [vista, setVista] = useState('hoy');
  const [confirmar, setConfirmar] = useState(null);
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

  function cambiarVista(id) { setVista(id); setConfirmar(null); setMsg(''); }
  function teclado(e, i) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const sig = VISTAS[(i + (e.key === 'ArrowRight' ? 1 : VISTAS.length - 1)) % VISTAS.length].id;
    cambiarVista(sig);
    document.getElementById(`pestana-s-${sig}`)?.focus();
  }

  async function marcar(hb, valor) {
    const f = hoy;
    const k = `${hb.id}|${f}`;
    const antes = regs;
    if (!(valor > 0)) {
      setRegs(regs.filter(r => !(r.habito_id === hb.id && r.fecha === f)));
      const { error } = await supabase.from('habito_registros').delete().eq('habito_id', hb.id).eq('fecha', f);
      if (error) { setRegs(antes); setMsg(''); setError('No se pudo guardar.'); } else { setError(''); setMsg('Guardado.'); }
      return;
    }
    const otros = regs.filter(r => !(r.habito_id === hb.id && r.fecha === f));
    setRegs([...otros, { id: k, habito_id: hb.id, fecha: f, valor, user_id: userId }]);
    const { error } = await supabase.from('habito_registros')
      .upsert({ user_id: userId, habito_id: hb.id, fecha: f, valor }, { onConflict: 'habito_id,fecha' });
    if (error) { setRegs(antes); setMsg(''); setError('No se pudo guardar.'); } else { setError(''); setMsg('Guardado.'); }
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
    cambiarVista('hoy'); setMsg('Hábito creado.');
  }

  async function archivar(hb) {
    const antes = habitos;
    setHabitos(habitos.filter(x => x.id !== hb.id));
    setConfirmar(null);
    const { error } = await supabase.from('habitos').update({ activo: false }).eq('id', hb.id);
    if (error) { setHabitos(antes); setError('No se pudo archivar el hábito.'); } else setError('');
  }

  async function nuevaMedida(e) {
    e.preventDefault();
    const valor = num(fm.valor);
    if (!fm.tipo.trim() || !valor) return setError('Escribe el tipo y el valor de la medida.');
    const { data, error } = await supabase.from('medidas')
      .insert({ fecha: fm.fecha, tipo: fm.tipo.trim(), unidad: fm.unidad.trim() || null, valor }).select().single();
    if (error) return setError('No se pudo guardar la medida.');
    setError(''); setMsg('Medida guardada.'); setMedidas([...medidas, data].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    setVerTipo(data.tipo); setFm({ ...fm, valor: '' });
  }

  async function borrarMedida(m) {
    const antes = medidas;
    setMedidas(medidas.filter(x => x.id !== m.id));
    setConfirmar(null);
    const { error } = await supabase.from('medidas').delete().eq('id', m.id);
    if (error) { setMedidas(antes); setError('No se pudo borrar la medida.'); } else setError('');
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
    setError(''); setMsg('Objetivo creado.'); setObjetivos([...objetivos, data]);
    setFo({ titulo: '', tipo: fo.tipo, ini: '', meta: '', fecha: '' });
  }

  async function borrarObjetivo(o) {
    const antes = objetivos;
    setObjetivos(objetivos.filter(x => x.id !== o.id));
    setConfirmar(null);
    const { error } = await supabase.from('objetivos_salud').delete().eq('id', o.id);
    if (error) { setObjetivos(antes); setError('No se pudo borrar el objetivo.'); } else setError('');
  }

  const serie = medidas.filter(m => m.tipo === verTipo).map(m => ({ fecha: m.fecha, valor: Number(m.valor) }));
  const objDelTipo = objetivos.find(o => o.medida_tipo === verTipo && !o.logrado);
  const recientes = [...medidas].reverse().slice(0, 6);
  const ultimaDelTipo = serie[serie.length - 1];
  const unidadDelTipo = [...medidas].reverse().find(m => m.tipo === verTipo)?.unidad ?? '';

  const Confirmacion = ({ texto, onSi }) => (
    <div className={estilos.confirmar} role="alertdialog" aria-label="Confirmar">
      <p>{texto}</p>
      <div className={estilos.acciones}>
        <button type="button" className={`${estilos.boton} ${estilos.peligro}`} onClick={onSi}>Sí, continuar</button>
        <button type="button" className={estilos.boton} onClick={() => setConfirmar(null)}>Cancelar</button>
      </div>
    </div>
  );

  return (
    <Pantalla fecha="Hábitos, medidas y objetivos" titulo="Salud"
      resumen={habitos.length ? `${hechosHoy} de ${habitos.length} ${habitos.length === 1 ? 'hábito' : 'hábitos'} hoy` : 'Sin hábitos aún'}>
      {error && <p className={estilos.error} role="alert">{error}</p>}
      {msg && !error && <p className={estilos.ok} role="status">{msg}</p>}

      <div className={estilos.pestanas} role="tablist" aria-label="Secciones de salud">
        {VISTAS.map((v, i) => (
          <button key={v.id} id={`pestana-s-${v.id}`} type="button" role="tab" className={estilos.pestana} aria-selected={vista === v.id} aria-controls={`panel-s-${v.id}`}
            tabIndex={vista === v.id ? 0 : -1} onClick={() => cambiarVista(v.id)} onKeyDown={e => teclado(e, i)}>{v.nombre}</button>
        ))}
      </div>

      {vista === 'hoy' && (
        <div id="panel-s-hoy" role="tabpanel" aria-labelledby="pestana-s-hoy" className={estilos.col}>
          {habitos.length ? (
            <ul className={estilos.lista}>
              {habitos.map(hb => {
                const fechasOk = regs.filter(r => r.habito_id === hb.id && Number(r.valor) >= Number(hb.objetivo_dia)).map(r => r.fecha);
                const hechosSemana = semana.filter(f => cumplido(hb, f)).length;
                const valorHoy = mapa.get(`${hb.id}|${hoy}`) ?? '';
                const frac = hb.tipo === 'check' ? (cumplido(hb, hoy) ? 1 : 0) : Math.min(1, Number(valorHoy || 0) / Number(hb.objetivo_dia || 1));
                return (
                  <li key={hb.id}>
                    <Card as="article" className={estilos.bloque}>
                      <div className={estilos.habito}>
                        <Ring valor={frac} etiqueta={`${hb.nombre} hoy`} tono={frac >= 1 ? 'exito' : 'primario'} tamano={56} grosor={7}>
                          {frac >= 1 ? <Icon name="check" size={20} /> : undefined}
                        </Ring>
                        <div className={estilos.datos}>
                          {hb.tipo === 'check' ? (
                            <label className={estilos.casilla}>
                              <input type="checkbox" checked={cumplido(hb, hoy)} onChange={e => marcar(hb, e.target.checked ? 1 : 0)} />
                              <span className={estilos.nombre}>{hb.nombre}</span>
                            </label>
                          ) : (
                            <div className={estilos.cantidad}>
                              <span className={estilos.nombre}>{hb.nombre}</span>
                              <label className={estilos.campoCantidad}>
                                <input key={`${hb.id}-${valorHoy}`} type="number" inputMode="decimal" min="0" step="any" defaultValue={valorHoy} aria-label={`${hb.nombre}: cantidad de hoy`}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                                  onBlur={e => marcar(hb, num(e.target.value) || 0)} />
                                <span className={estilos.sub}>de {fmt(hb.objetivo_dia)} {hb.unidad ?? ''}</span>
                              </label>
                            </div>
                          )}
                          <p className={estilos.sub}>racha {racha(fechasOk)} · semana {hechosSemana}/{hb.veces_semana}</p>
                        </div>
                      </div>
                      <ol className={estilos.tira} aria-label="Últimos 7 días">
                        {ultimos7.map(f => (
                          <li key={f} className={`${estilos.dia} ${cumplido(hb, f) ? estilos.diaOk : ''}`} aria-label={`${nombreDia(f)}: ${cumplido(hb, f) ? 'cumplido' : 'no cumplido'}`}>
                            <span className={estilos.marca} aria-hidden="true">{cumplido(hb, f) ? <Icon name="check" size={12} /> : ''}</span>
                            <span className={estilos.inicial} aria-hidden="true">{inicialDia(f)}</span>
                          </li>
                        ))}
                      </ol>
                      {confirmar === `h-${hb.id}` ? (
                        <Confirmacion texto="Se oculta de esta pantalla y no hay forma de restaurarlo desde aquí. ¿Archivar este hábito?" onSi={() => archivar(hb)} />
                      ) : (
                        <div className={estilos.acciones}>
                          <button type="button" className={`${estilos.boton} ${estilos.peligroSuave}`} onClick={() => setConfirmar(`h-${hb.id}`)} aria-label={`Archivar ${hb.nombre}`}>Archivar</button>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Card className={estilos.bloque}>
              <EmptyState icono="heart" titulo="Sin hábitos aún" descripcion="Crea tu primer hábito: tomar agua, caminar, dormir temprano…">
                <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => cambiarVista('habito')}>Crear hábito</button>
              </EmptyState>
            </Card>
          )}
        </div>
      )}

      {vista === 'medidas' && (
        <div id="panel-s-medidas" role="tabpanel" aria-labelledby="pestana-s-medidas" className={estilos.rejilla}>
          <div className={estilos.col}>
            <Card as="section" id="evolucion" className={estilos.bloque} titulo="Evolución" icono="chart"
              accion={(
                <label className={estilos.selectorMedida}>
                  <span className={estilos.soloLector}>Medida</span>
                  <select id="s-ver" value={verTipo} onChange={e => setVerTipo(e.target.value)} aria-label="Medida">
                    {tipos.map(t => <option key={t}>{t}</option>)}
                  </select>
                </label>
              )}>
              <Grafica serie={serie} meta={objDelTipo ? Number(objDelTipo.valor_meta) : null} />
              {ultimaDelTipo && (
                <p className={estilos.sub}>Último: {fmt(ultimaDelTipo.valor)} {unidadDelTipo} el {fechaCorta(ultimaDelTipo.fecha)}{objDelTipo ? ` · meta ${fmt(objDelTipo.valor_meta)}` : ''}</p>
              )}
              {!ultimaDelTipo && <p className={estilos.vacio}>Aún no hay medidas de {verTipo.toLowerCase()}.</p>}
            </Card>
            {recientes.length > 0 && (
              <Card as="section" id="recientes" className={estilos.bloque} titulo="Medidas recientes" icono="clock">
                <ul className={estilos.recientes}>
                  {recientes.map(m => (
                    <li key={m.id}>
                      <div className={estilos.fila}>
                        <span>{m.tipo}: <b className={estilos.dinero}>{fmt(m.valor)} {m.unidad ?? ''}</b> <span className={estilos.sub}>{fechaCorta(m.fecha)}</span></span>
                        {confirmar !== `m-${m.id}` && <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => setConfirmar(`m-${m.id}`)} aria-label={`Borrar medida de ${m.tipo} del ${fechaCorta(m.fecha)}`}>Borrar</button>}
                      </div>
                      {confirmar === `m-${m.id}` && <Confirmacion texto="¿Borrar esta medida? No se puede deshacer." onSi={() => borrarMedida(m)} />}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
          <Card as="section" id="registrar-medida" className={estilos.bloque} titulo="Registrar medida" icono="plus">
            <form className={estilos.form} onSubmit={nuevaMedida}>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Fecha<input id="m-fecha" type="date" value={fm.fecha} onChange={e => setFm({ ...fm, fecha: e.target.value })} /></label>
                <label className={estilos.campo}>Valor<input id="m-valor" inputMode="decimal" value={fm.valor} onChange={e => setFm({ ...fm, valor: e.target.value })} /></label>
              </div>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Medida<input id="m-tipo" list="tipos" value={fm.tipo} onChange={e => setFm({ ...fm, tipo: e.target.value })} />
                  <datalist id="tipos">{tipos.map(t => <option key={t} value={t} />)}</datalist></label>
                <label className={estilos.campo}>Unidad<input id="m-unidad" value={fm.unidad} onChange={e => setFm({ ...fm, unidad: e.target.value })} placeholder="kg, cm…" /></label>
              </div>
              <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">Guardar medida</button>
            </form>
          </Card>
        </div>
      )}

      {vista === 'objetivos' && (
        <div id="panel-s-objetivos" role="tabpanel" aria-labelledby="pestana-s-objetivos" className={estilos.rejilla}>
          <div className={estilos.col}>
            {objetivos.length ? (
              <ul className={estilos.lista}>
                {objetivos.map(o => {
                  const ult = [...medidas].reverse().find(m => m.tipo === o.medida_tipo);
                  const actual = ult ? Number(ult.valor) : Number(o.valor_inicial);
                  const den = Number(o.valor_meta) - Number(o.valor_inicial);
                  const p = ult && den !== 0 ? Math.max(0, Math.min(1, (actual - o.valor_inicial) / den)) : undefined;
                  return (
                    <li key={o.id}>
                      <Card as="article" className={estilos.bloque}>
                        <div className={estilos.habito}>
                          <Ring valor={p} etiqueta={`Avance de ${o.titulo}`} tono={p >= 1 ? 'exito' : 'primario'} tamano={72} grosor={8} />
                          <div className={estilos.datos}>
                            <h3 className={estilos.titulo}>{o.titulo}</h3>
                            <p className={estilos.sub}>{fmt(o.valor_inicial)} → {ult ? fmt(actual) : 'sin medidas'} → meta {fmt(o.valor_meta)}{o.fecha_meta ? ` · para el ${fechaCorta(o.fecha_meta)}` : ''}</p>
                            {p >= 1 && <Chip tono="exito">Logrado</Chip>}
                            {p === undefined && <p className={estilos.sub}>Sin datos: registra una medida de {o.medida_tipo.toLowerCase()}.</p>}
                          </div>
                        </div>
                        {confirmar === `o-${o.id}` ? (
                          <Confirmacion texto="¿Borrar este objetivo? No se puede deshacer." onSi={() => borrarObjetivo(o)} />
                        ) : (
                          <div className={estilos.acciones}>
                            <button type="button" className={`${estilos.boton} ${estilos.peligroSuave}`} onClick={() => setConfirmar(`o-${o.id}`)} aria-label={`Borrar objetivo ${o.titulo}`}>Borrar</button>
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Card className={estilos.bloque}>
                <EmptyState icono="target" titulo="Aún no hay objetivos" descripcion="Define un objetivo, por ejemplo bajar de peso o reducir cintura." />
              </Card>
            )}
          </div>
          <Card as="section" id="nuevo-objetivo" className={estilos.bloque} titulo="Nuevo objetivo" icono="plus">
            <form className={estilos.form} onSubmit={nuevoObjetivo}>
              <label className={estilos.campo}>Objetivo<input id="o-titulo" value={fo.titulo} onChange={e => setFo({ ...fo, titulo: e.target.value })} placeholder="Llegar a 62 kg" /></label>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Medida
                  <select id="o-tipo" value={fo.tipo} onChange={e => setFo({ ...fo, tipo: e.target.value })}>{tipos.map(t => <option key={t}>{t}</option>)}</select>
                </label>
                <label className={estilos.campo}>Fecha meta<input id="o-fecha" type="date" value={fo.fecha} onChange={e => setFo({ ...fo, fecha: e.target.value })} /></label>
              </div>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Valor de inicio<input id="o-ini" inputMode="decimal" value={fo.ini} onChange={e => setFo({ ...fo, ini: e.target.value })} placeholder="último registro" /></label>
                <label className={estilos.campo}>Meta<input id="o-meta" inputMode="decimal" value={fo.meta} onChange={e => setFo({ ...fo, meta: e.target.value })} /></label>
              </div>
              <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">Crear objetivo</button>
            </form>
          </Card>
        </div>
      )}

      {vista === 'habito' && (
        <div id="panel-s-habito" role="tabpanel" aria-labelledby="pestana-s-habito" className={estilos.col}>
          <Card as="section" id="nuevo-habito" className={`${estilos.bloque} ${estilos.angosto}`} titulo="Nuevo hábito" icono="plus">
            <form className={estilos.form} onSubmit={nuevoHabito}>
              <label className={estilos.campo}>Nombre<input id="h-nombre" value={fh.nombre} onChange={e => setFh({ ...fh, nombre: e.target.value })} placeholder="Caminar 30 min" /></label>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Tipo
                  <select id="h-tipo" value={fh.tipo} onChange={e => setFh({ ...fh, tipo: e.target.value })}>
                    <option value="check">Sí o no</option><option value="cantidad">Cantidad</option>
                  </select>
                </label>
                <label className={estilos.campo}>Veces por semana<input id="h-veces" type="number" min="1" max="7" value={fh.veces} onChange={e => setFh({ ...fh, veces: e.target.value })} /></label>
              </div>
              {fh.tipo === 'cantidad' && (
                <div className={estilos.dos}>
                  <label className={estilos.campo}>Objetivo diario<input id="h-obj" inputMode="decimal" value={fh.objetivo} onChange={e => setFh({ ...fh, objetivo: e.target.value })} /></label>
                  <label className={estilos.campo}>Unidad<input id="h-unidad" value={fh.unidad} onChange={e => setFh({ ...fh, unidad: e.target.value })} placeholder="vasos, pasos…" /></label>
                </div>
              )}
              <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">Crear hábito</button>
            </form>
          </Card>
        </div>
      )}
    </Pantalla>
  );
}
