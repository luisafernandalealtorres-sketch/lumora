'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import SelectorFrente from '@/components/SelectorFrente';
import { frenteInicial } from '@/lib/domain/formularios';
import { cop, hoyBogota, mesActual, nombreMes, fechaCorta, CATEGORIAS } from '@/lib/format';

const num = v => Math.round(Number(String(v).replace(/[^\d]/g, '')));
const ultimoDiaMes = (y, m) => new Date(y, m, 0).getDate();

// Próxima fecha de vencimiento según el día del mes y el último pago.
function proximoVencimiento(r, hoy) {
  const [y, m] = hoy.split('-').map(Number);
  const pagadoEsteMes = r.ultimo_pago && r.ultimo_pago.slice(0, 7) === hoy.slice(0, 7);
  let yy = y, mm = m;
  if (pagadoEsteMes) { mm += 1; if (mm > 12) { mm = 1; yy += 1; } }
  const d = Math.min(r.dia_mes, ultimoDiaMes(yy, mm));
  return `${yy}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

export default function Finanzas({ userId, frentes, gastos, ingresos: i0, presupuestos: p0, recurrentes: r0, deudas: d0 }) {
  const supabase = createClient();
  const hoy = hoyBogota();
  const mes = mesActual();
  const [ingresos, setIngresos] = useState(i0);
  const [pres, setPres] = useState(p0);
  const [recs, setRecs] = useState(r0);
  const [deudas, setDeudas] = useState(d0);
  const [gastosMes, setGastosMes] = useState(gastos);
  const [error, setError] = useState('');
  const [fi, setFi] = useState({ fecha: hoy, fuente: '', valor: '', frente: frenteInicial('ingresoNuevo') });
  const [fp, setFp] = useState({ categoria: 'Comida', monto: '' });
  const [fr, setFr] = useState({ nombre: '', valor: '', dia: '1', categoria: 'Servicios', frente: frenteInicial('recurrenteNuevo') });
  const [fd, setFd] = useState({ nombre: '', tipo: 'debo', total: '', saldo: '', cuota: '' });
  const [abono, setAbono] = useState({});

  const totalIng = ingresos.reduce((s, i) => s + Number(i.valor_cop), 0);
  const totalGas = gastosMes.reduce((s, g) => s + Number(g.valor_cop), 0);
  const balance = totalIng - totalGas;
  const gastoCat = c => gastosMes.filter(g => g.categoria === c).reduce((s, g) => s + Number(g.valor_cop), 0);
  const totalPres = pres.reduce((s, p) => s + Number(p.monto_cop), 0);
  const debo = deudas.filter(d => d.tipo === 'debo').reduce((s, d) => s + Number(d.saldo), 0);
  const meDeben = deudas.filter(d => d.tipo === 'me_deben').reduce((s, d) => s + Number(d.saldo), 0);

  const proximos = recs.map(r => {
    const f = proximoVencimiento(r, hoy);
    return { ...r, vence: f, dias: diasEntre(hoy, f) };
  }).sort((a, b) => a.dias - b.dias);

  const fallo = msg => setError(msg);

  async function nuevoIngreso(e) {
    e.preventDefault();
    const valor = num(fi.valor);
    if (!fi.fuente.trim() || !valor) return fallo('Escribe la fuente y el valor del ingreso.');
    const { data, error } = await supabase.from('ingresos')
      .insert({ fecha: fi.fecha, fuente: fi.fuente.trim(), valor_cop: valor, frente: fi.frente }).select().single();
    if (error) return fallo('No se pudo guardar el ingreso.');
    setError(''); setIngresos([data, ...ingresos].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setFi({ ...fi, fuente: '', valor: '' });
  }
  async function borrarIngreso(i) {
    const antes = ingresos;
    setIngresos(ingresos.filter(x => x.id !== i.id));
    const { error } = await supabase.from('ingresos').delete().eq('id', i.id);
    if (error) setIngresos(antes);
  }

  async function guardarPresupuesto(e) {
    e.preventDefault();
    const monto = num(fp.monto);
    if (!monto && monto !== 0) return fallo('Escribe el monto mensual.');
    const { data, error } = await supabase.from('presupuestos')
      .upsert({ user_id: userId, categoria: fp.categoria, monto_cop: monto }, { onConflict: 'user_id,categoria' }).select().single();
    if (error) return fallo('No se pudo guardar el presupuesto.');
    setError(''); setPres([...pres.filter(p => p.categoria !== data.categoria), data]);
    setFp({ ...fp, monto: '' });
  }

  async function nuevoRecurrente(e) {
    e.preventDefault();
    const valor = num(fr.valor);
    const dia = Math.min(31, Math.max(1, parseInt(fr.dia) || 1));
    if (!fr.nombre.trim()) return fallo('Ponle nombre al pago.');
    const { data, error } = await supabase.from('recurrentes')
      .insert({ nombre: fr.nombre.trim(), valor_cop: valor || 0, dia_mes: dia, categoria: fr.categoria, frente: fr.frente }).select().single();
    if (error) return fallo('No se pudo guardar el pago.');
    setError(''); setRecs([...recs, data]);
    setFr({ ...fr, nombre: '', valor: '' });
  }
  async function pagar(r) {
    const { data: g, error: e1 } = await supabase.from('gastos')
      .insert({ fecha: hoy, lugar: r.nombre, categoria: r.categoria, valor_cop: r.valor_cop, frente: r.frente }).select().single();
    if (e1) return fallo('No se pudo registrar el pago.');
    const { error: e2 } = await supabase.from('recurrentes').update({ ultimo_pago: hoy }).eq('id', r.id);
    if (e2) return fallo('El gasto se guardó, pero no se pudo marcar el pago.');
    setError('');
    setRecs(recs.map(x => (x.id === r.id ? { ...x, ultimo_pago: hoy } : x)));
    if (g.fecha.slice(0, 7) === mes) setGastosMes([...gastosMes, g]);
  }
  async function quitarRecurrente(r) {
    const antes = recs;
    setRecs(recs.filter(x => x.id !== r.id));
    const { error } = await supabase.from('recurrentes').update({ activo: false }).eq('id', r.id);
    if (error) setRecs(antes);
  }

  async function nuevaDeuda(e) {
    e.preventDefault();
    const total = num(fd.total);
    const saldo = fd.saldo === '' ? total : num(fd.saldo);
    if (!fd.nombre.trim() || !total) return fallo('Escribe el nombre y el monto de la deuda.');
    const { data, error } = await supabase.from('deudas')
      .insert({ nombre: fd.nombre.trim(), tipo: fd.tipo, monto_total: total, saldo: Math.min(saldo, total), cuota_cop: num(fd.cuota) || null }).select().single();
    if (error) return fallo('No se pudo guardar la deuda.');
    setError(''); setDeudas([...deudas, data]);
    setFd({ nombre: '', tipo: fd.tipo, total: '', saldo: '', cuota: '' });
  }
  async function abonar(d) {
    const v = num(abono[d.id] ?? '');
    if (!v) return;
    const saldo = Math.max(0, Number(d.saldo) - v);
    const { error } = await supabase.from('deudas').update({ saldo }).eq('id', d.id);
    if (error) return fallo('No se pudo registrar el abono.');
    setError(''); setDeudas(deudas.map(x => (x.id === d.id ? { ...x, saldo } : x))); setAbono({ ...abono, [d.id]: '' });
  }
  async function borrarDeuda(d) {
    const antes = deudas;
    setDeudas(deudas.filter(x => x.id !== d.id));
    const { error } = await supabase.from('deudas').delete().eq('id', d.id);
    if (error) setDeudas(antes);
  }

  const catsConPres = CATEGORIAS.filter(c => pres.some(p => p.categoria === c));

  return (
    <>
      <header>
        <div><div className="date">{nombreMes(mes)}</div><h1>Finanzas</h1></div>
        <Link href="/gastos" className="btn sec" style={{ textDecoration: 'none' }}>Ver gastos</Link>
      </header>
      {error && <div className="err" role="alert">{error}</div>}

      <div className="grid">
        <div className="stat"><b className="money">{cop(totalIng)}</b><span>ingresos del mes</span></div>
        <div className="stat"><b className="money">{cop(totalGas)}</b><span>gastos del mes</span></div>
        <div className="stat"><b className="money" style={{ color: balance < 0 ? 'var(--warn)' : undefined }}>{cop(balance)}</b><span>balance</span></div>
        <div className="stat"><b className="money">{cop(debo)}</b><span>debo</span></div>
        <div className="stat"><b className="money">{cop(meDeben)}</b><span>me deben</span></div>
      </div>

      <div className="cols">
        <div className="stack">
          <section>
            <h2>Presupuesto <small>{totalPres ? `${cop(totalGas)} de ${cop(totalPres)}` : ''}</small></h2>
            {catsConPres.length ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {catsConPres.map(c => {
                  const limite = Number(pres.find(p => p.categoria === c).monto_cop);
                  const usado = gastoCat(c);
                  const r = limite ? usado / limite : 0;
                  return (
                    <div className="avance" key={c}>
                      <div className="row"><span>{c}</span><span className={`sub money`} style={{ color: r > 1 ? 'var(--warn)' : undefined }}>{cop(usado)} de {cop(limite)}</span></div>
                      <div className="bar"><i style={{ width: `${Math.min(r, 1) * 100}%`, background: r > 0.9 ? 'var(--warn)' : undefined }} /></div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="empty">Define cuánto quieres gastar al mes por categoría.</p>}
            <form className="add" onSubmit={guardarPresupuesto} style={{ marginTop: 12 }}>
              <select id="p-cat" value={fp.categoria} onChange={e => setFp({ ...fp, categoria: e.target.value })} aria-label="Categoría">
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="text" id="p-monto" inputMode="numeric" placeholder="Monto mensual" value={fp.monto} onChange={e => setFp({ ...fp, monto: e.target.value })} />
              <button className="btn sec" type="submit">Fijar</button>
            </form>
          </section>

          <section>
            <h2>Pagos recurrentes</h2>
            {proximos.length ? (
              <ul>{proximos.map(r => {
                const vencido = r.dias < 0;
                return (
                  <li key={r.id}>
                    <div className="rowx"><span className="from">{r.nombre}</span><span className="money">{cop(r.valor_cop)}</span></div>
                    <div className="rowx">
                      <span className="sub" style={{ color: vencido || r.dias <= 3 ? 'var(--warn)' : undefined }}>
                        {vencido ? `Vencido hace ${-r.dias} d` : r.dias === 0 ? 'Vence hoy' : `Vence en ${r.dias} d`} · {fechaCorta(r.vence)}
                      </span>
                      <span style={{ display: 'flex', gap: 12 }}>
                        <button className="link" onClick={() => pagar(r)}>Marcar pagado</button>
                        <button className="link" onClick={() => quitarRecurrente(r)}>Quitar</button>
                      </span>
                    </div>
                  </li>
                );
              })}</ul>
            ) : <p className="empty">Agrega arriendo, servicios, suscripciones o aportes para que te avise antes de que venzan.</p>}
            <form className="form" onSubmit={nuevoRecurrente} style={{ marginTop: 12 }}>
              <div className="two">
                <label>Nombre<input id="r-nombre" value={fr.nombre} onChange={e => setFr({ ...fr, nombre: e.target.value })} placeholder="Google One" /></label>
                <label>Valor (COP)<input id="r-valor" inputMode="numeric" value={fr.valor} onChange={e => setFr({ ...fr, valor: e.target.value })} /></label>
              </div>
              <div className="two">
                <label>Día del mes<input id="r-dia" type="number" min="1" max="31" value={fr.dia} onChange={e => setFr({ ...fr, dia: e.target.value })} /></label>
                <label>Categoría
                  <select id="r-cat" value={fr.categoria} onChange={e => setFr({ ...fr, categoria: e.target.value })}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select>
                </label>
              </div>
              <label>Frente
                <SelectorFrente id="r-frente" value={fr.frente} onChange={e => setFr({ ...fr, frente: e.target.value })} frentes={frentes} />
              </label>
              <button className="btn sec" type="submit">Agregar pago recurrente</button>
            </form>
          </section>
        </div>

        <div className="stack">
          <section>
            <h2>Ingresos <small>{nombreMes(mes)}</small></h2>
            {ingresos.length ? (
              <ul>{ingresos.map(i => (
                <li key={i.id}>
                  <div className="rowx"><span className="from">{i.fuente}</span><span className="money">{cop(i.valor_cop)}</span></div>
                  <div className="rowx">
                    <span className="sub">{fechaCorta(i.fecha)} · {frentes.find(x => x.slug === i.frente)?.nombre ?? i.frente}</span>
                    <button className="link" onClick={() => borrarIngreso(i)}>Borrar</button>
                  </div>
                </li>
              ))}</ul>
            ) : <p className="empty">Sin ingresos registrados este mes.</p>}
            <form className="form" onSubmit={nuevoIngreso} style={{ marginTop: 12 }}>
              <div className="two">
                <label>Fecha<input id="i-fecha" type="date" value={fi.fecha} onChange={e => setFi({ ...fi, fecha: e.target.value })} /></label>
                <label>Valor (COP)<input id="i-valor" inputMode="numeric" value={fi.valor} onChange={e => setFi({ ...fi, valor: e.target.value })} /></label>
              </div>
              <label>Fuente<input id="i-fuente" value={fi.fuente} onChange={e => setFi({ ...fi, fuente: e.target.value })} placeholder="Evento, cliente, TANKU…" /></label>
              <label>Frente
                <SelectorFrente id="i-frente" value={fi.frente} onChange={e => setFi({ ...fi, frente: e.target.value })} frentes={frentes} />
              </label>
              <button className="btn" type="submit">Guardar ingreso</button>
            </form>
          </section>

          <section>
            <h2>Deudas y préstamos</h2>
            {deudas.length ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {deudas.map(d => {
                  const p = 1 - Number(d.saldo) / Number(d.monto_total);
                  return (
                    <div className="avance" key={d.id}>
                      <div className="row"><span className="from">{d.nombre} <span className="pill">{d.tipo === 'debo' ? 'debo' : 'me deben'}</span></span>
                        <span className="sub money">{cop(d.saldo)} de {cop(d.monto_total)}</span></div>
                      <div className="bar"><i style={{ width: `${p * 100}%` }} /></div>
                      <div className="rowx">
                        <span className="sub">{Number(d.saldo) === 0 ? 'Saldada' : d.cuota_cop ? `Cuota ${cop(d.cuota_cop)}` : ''}</span>
                        <button className="link" onClick={() => borrarDeuda(d)}>Borrar</button>
                      </div>
                      {Number(d.saldo) > 0 && (
                        <div className="add">
                          <input type="text" id={`ab-${d.id}`} inputMode="numeric" placeholder="Abono" value={abono[d.id] ?? ''}
                            onChange={e => setAbono({ ...abono, [d.id]: e.target.value })} />
                          <button className="btn sec" type="button" onClick={() => abonar(d)}>Abonar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <p className="empty">Sin deudas registradas.</p>}
            <form className="form" onSubmit={nuevaDeuda} style={{ marginTop: 12 }}>
              <div className="two">
                <label>Nombre<input id="d-nombre" value={fd.nombre} onChange={e => setFd({ ...fd, nombre: e.target.value })} placeholder="Préstamo, tarjeta…" /></label>
                <label>Tipo
                  <select id="d-tipo" value={fd.tipo} onChange={e => setFd({ ...fd, tipo: e.target.value })}>
                    <option value="debo">Yo debo</option><option value="me_deben">Me deben</option>
                  </select>
                </label>
              </div>
              <div className="two">
                <label>Monto total<input id="d-total" inputMode="numeric" value={fd.total} onChange={e => setFd({ ...fd, total: e.target.value })} /></label>
                <label>Saldo actual<input id="d-saldo" inputMode="numeric" value={fd.saldo} onChange={e => setFd({ ...fd, saldo: e.target.value })} placeholder="igual al total" /></label>
              </div>
              <label>Cuota (opcional)<input id="d-cuota" inputMode="numeric" value={fd.cuota} onChange={e => setFd({ ...fd, cuota: e.target.value })} /></label>
              <button className="btn sec" type="submit">Agregar deuda</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
