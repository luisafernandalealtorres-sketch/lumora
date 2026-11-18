'use client';
import { useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import Pantalla from '@/components/ui/Pantalla';
import ProgressBar from '@/components/ui/ProgressBar';
import { createClient } from '@/lib/supabase/client';
import SelectorFrente from '@/components/SelectorFrente';
import { frenteInicial } from '@/lib/domain/formularios';
import { cop, hoyBogota, mesActual, nombreMes, fechaCorta, esNegocio, CATEGORIAS } from '@/lib/format';
import estilos from './Finanzas.module.css';

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

const VISTAS = [
  { id: 'resumen', nombre: 'Resumen' },
  { id: 'gastos', nombre: 'Gastos' },
  { id: 'ingresos', nombre: 'Ingresos' },
  { id: 'compromisos', nombre: 'Compromisos' },
];
const IDS_VISTAS = VISTAS.map(v => v.id);

export default function FinanzasPanel({ userId, frentes, gastos: g0, ingresos: i0, presupuestos: p0, recurrentes: r0, deudas: d0, vistaInicial = 'resumen' }) {
  const supabase = createClient();
  const hoy = hoyBogota();
  const [vista, setVista] = useState(IDS_VISTAS.includes(vistaInicial) ? vistaInicial : 'resumen');
  const [mes, setMes] = useState(mesActual());
  const [ingresos, setIngresos] = useState(i0);
  const [pres, setPres] = useState(p0);
  const [recs, setRecs] = useState(r0);
  const [deudas, setDeudas] = useState(d0);
  const [gastos, setGastos] = useState(g0);
  const [error, setError] = useState('');
  const [fg, setFg] = useState({ fecha: hoy, lugar: '', categoria: 'Comida', valor: '', frente: frenteInicial('gastoNuevo') });
  const [fi, setFi] = useState({ fecha: hoy, fuente: '', valor: '', frente: frenteInicial('ingresoNuevo') });
  const [fp, setFp] = useState({ categoria: 'Comida', monto: '' });
  const [fr, setFr] = useState({ nombre: '', valor: '', dia: '1', categoria: 'Servicios', frente: frenteInicial('recurrenteNuevo') });
  const [fd, setFd] = useState({ nombre: '', tipo: 'debo', total: '', saldo: '', cuota: '' });
  const [abono, setAbono] = useState({});

  const meses = useMemo(() => {
    const s = new Set([mesActual(), ...gastos.map(i => i.fecha.slice(0, 7)), ...ingresos.map(i => i.fecha.slice(0, 7))]);
    return [...s].sort().reverse();
  }, [gastos, ingresos]);

  const gastosMes = gastos.filter(g => g.fecha.startsWith(mes));
  const ingresosMes = ingresos.filter(i => i.fecha.startsWith(mes));
  const totalIng = ingresosMes.reduce((s, i) => s + Number(i.valor_cop), 0);
  const totalGas = gastosMes.reduce((s, g) => s + Number(g.valor_cop), 0);
  const negocio = gastosMes.filter(g => esNegocio(g.frente)).reduce((s, g) => s + Number(g.valor_cop), 0);
  const balance = totalIng - totalGas;
  const gastoCat = c => gastosMes.filter(g => g.categoria === c).reduce((s, g) => s + Number(g.valor_cop), 0);
  const totalPres = pres.reduce((s, p) => s + Number(p.monto_cop), 0);
  const deboLista = deudas.filter(d => d.tipo === 'debo');
  const meDebenLista = deudas.filter(d => d.tipo === 'me_deben');
  const debo = deboLista.reduce((s, d) => s + Number(d.saldo), 0);
  const meDeben = meDebenLista.reduce((s, d) => s + Number(d.saldo), 0);
  const porCat = CATEGORIAS.map(c => ({ c, v: gastoCat(c) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const maxCat = Math.max(...porCat.map(x => x.v), 1);

  const proximos = recs.map(r => {
    const f = proximoVencimiento(r, hoy);
    return { ...r, vence: f, dias: diasEntre(hoy, f) };
  }).sort((a, b) => a.dias - b.dias);

  const fallo = msg => setError(msg);
  const nombreFrente = slug => frentes.find(x => x.slug === slug)?.nombre ?? slug;

  // ---- Gastos (misma lógica que la pantalla Gastos anterior)
  async function agregarGasto(e) {
    e.preventDefault();
    const valor = Math.round(Number(String(fg.valor).replace(/[^\d]/g, '')));
    if (!fg.lugar.trim() || !valor) return fallo('Escribe el lugar y el valor.');
    const { data, error } = await supabase.from('gastos')
      .insert({ fecha: fg.fecha, lugar: fg.lugar.trim(), categoria: fg.categoria, valor_cop: valor, frente: fg.frente })
      .select().single();
    if (error) return fallo('No se pudo guardar. Intenta de nuevo.');
    setError('');
    setGastos([data, ...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setFg({ ...fg, lugar: '', valor: '' });
  }
  async function borrarGasto(it) {
    const antes = gastos;
    setGastos(gastos.filter(x => x.id !== it.id));
    const { error } = await supabase.from('gastos').delete().eq('id', it.id);
    if (error) setGastos(antes);
  }

  // ---- Ingresos, presupuesto, recurrentes y deudas (misma lógica que la pantalla Finanzas anterior)
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
    setGastos([g, ...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)));
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

  // ---- Presentación
  function elegirVista(id) {
    setVista(id);
    try {
      const q = new URLSearchParams(window.location.search);
      q.set('vista', id);
      window.history.replaceState(null, '', `?${q.toString()}`);
    } catch { /* sin historial: la pestaña igual cambia */ }
  }
  function teclado(e, i) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const sig = VISTAS[(i + (e.key === 'ArrowRight' ? 1 : VISTAS.length - 1)) % VISTAS.length].id;
    elegirVista(sig);
    document.getElementById(`pestana-${sig}`)?.focus();
  }

  const hayRegistros = gastosMes.length + ingresosMes.length > 0;
  const resumen = hayRegistros
    ? `${gastosMes.length} ${gastosMes.length === 1 ? 'gasto' : 'gastos'} · ${ingresosMes.length} ${ingresosMes.length === 1 ? 'ingreso' : 'ingresos'}`
    : 'Sin registros este mes';
  const dinero = (valor, hay, extra = '') => (hay ? <b className={`${estilos.dinero} ${extra}`}>{cop(valor)}</b> : <b className={estilos.sinDatos}>Sin registros</b>);
  const catsConPres = CATEGORIAS.filter(c => pres.some(p => p.categoria === c));

  return (
    <Pantalla fecha={nombreMes(mes)} titulo="Finanzas" resumen={resumen}
      acciones={(
        <label className={estilos.mes}>
          <span className={estilos.soloLector}>Mes</span>
          <select id="mes" value={mes} onChange={e => setMes(e.target.value)} aria-label="Mes">
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
        </label>
      )}>
      {error && <p className={estilos.error} role="alert">{error}</p>}

      <div className={estilos.pestanas} role="tablist" aria-label="Secciones de finanzas">
        {VISTAS.map((v, i) => (
          <button key={v.id} id={`pestana-${v.id}`} type="button" role="tab" className={estilos.pestana} aria-selected={vista === v.id} aria-controls={`panel-${v.id}`}
            tabIndex={vista === v.id ? 0 : -1} onClick={() => elegirVista(v.id)} onKeyDown={e => teclado(e, i)}>{v.nombre}</button>
        ))}
      </div>

      {vista === 'resumen' && (
        <div id="panel-resumen" role="tabpanel" aria-labelledby="pestana-resumen" className={estilos.col}>
          <ul className={estilos.cifras} aria-label="Cifras del mes">
            <li className={estilos.cifra}>{dinero(totalIng, ingresosMes.length > 0)}<span>ingresos del mes</span></li>
            <li className={estilos.cifra}>{dinero(totalGas, gastosMes.length > 0)}<span>gastos del mes</span></li>
            <li className={estilos.cifra}>{dinero(balance, hayRegistros, balance < 0 ? estilos.negativo : '')}<span>balance</span></li>
            <li className={estilos.cifra}>{dinero(debo, deboLista.length > 0)}<span>debo</span></li>
            <li className={estilos.cifra}>{dinero(meDeben, meDebenLista.length > 0)}<span>me deben</span></li>
          </ul>
          <div className={estilos.rejilla}>
            <Card as="section" id="fin-presupuesto" titulo="Presupuesto" icono="target" className={estilos.bloque}
              accion={totalPres ? <span className={estilos.sub}>{cop(totalGas)} de {cop(totalPres)}</span> : null}>
              {catsConPres.length ? (
                <div className={estilos.barras}>
                  {catsConPres.map(c => {
                    const limite = Number(pres.find(p => p.categoria === c).monto_cop);
                    const usado = gastoCat(c);
                    const r = limite ? usado / limite : 0;
                    return (
                      <div className={estilos.barra} key={c}>
                        <div className={estilos.fila}><span className={estilos.nombre}>{c}</span><span className={`${estilos.sub} ${estilos.dinero} ${r > 1 ? estilos.alerta : ''}`}>{cop(usado)} de {cop(limite)}</span></div>
                        <ProgressBar valor={Math.min(r, 1)} etiqueta={`Presupuesto de ${c}`} tono={r > 0.9 ? 'advertencia' : 'primario'} tamano="sm" mostrarValor />
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState compacto icono="target" titulo="Sin presupuesto" descripcion="Define cuánto quieres gastar al mes por categoría." />}
              <form className={estilos.form} onSubmit={guardarPresupuesto}>
                <div className={estilos.insertar}>
                  <label className={estilos.campo}>Categoría
                    <select id="p-cat" value={fp.categoria} onChange={e => setFp({ ...fp, categoria: e.target.value })}>
                      {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className={estilos.campo}>Monto mensual
                    <input type="text" id="p-monto" inputMode="numeric" placeholder="Monto mensual" value={fp.monto} onChange={e => setFp({ ...fp, monto: e.target.value })} />
                  </label>
                </div>
                <button className={estilos.boton} type="submit">Fijar presupuesto</button>
              </form>
            </Card>

            <Card as="section" id="fin-vencimientos" titulo="Próximos pagos" icono="calendar" className={estilos.bloque}>
              {proximos.length ? (
                <ul className={estilos.lista}>{proximos.slice(0, 4).map(r => {
                  const vencido = r.dias < 0;
                  return (
                    <li key={r.id} className={estilos.item}>
                      <div className={estilos.fila}><span className={estilos.nombre}>{r.nombre}</span><span className={estilos.dinero}>{cop(r.valor_cop)}</span></div>
                      <span className={`${estilos.sub} ${vencido || r.dias <= 3 ? estilos.alerta : ''}`}>
                        {vencido ? `Vencido hace ${-r.dias} d` : r.dias === 0 ? 'Vence hoy' : `Vence en ${r.dias} d`} · {fechaCorta(r.vence)}
                      </span>
                    </li>
                  );
                })}</ul>
              ) : <EmptyState compacto icono="calendar" titulo="Sin pagos recurrentes" descripcion="Agrégalos en Compromisos para que te avise antes de que venzan." />}
              {proximos.length > 0 && <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => elegirVista('compromisos')}>Ver todos los compromisos</button>}
            </Card>
          </div>
        </div>
      )}

      {vista === 'gastos' && (
        <div id="panel-gastos" role="tabpanel" aria-labelledby="pestana-gastos" className={estilos.col}>
          <ul className={estilos.cifras} aria-label="Cifras de gastos del mes">
            <li className={estilos.cifra}>{dinero(totalGas, gastosMes.length > 0)}<span>total del mes</span></li>
            <li className={estilos.cifra}>{dinero(negocio, gastosMes.length > 0)}<span>negocio</span></li>
            <li className={estilos.cifra}>{dinero(totalGas - negocio, gastosMes.length > 0)}<span>personal</span></li>
            <li className={estilos.cifra}>{gastosMes.length ? <b className={estilos.dinero}>{gastosMes.length}</b> : <b className={estilos.sinDatos}>Sin registros</b>}<span>movimientos</span></li>
          </ul>
          <div className={estilos.rejilla}>
            <div className={estilos.col}>
              <Card as="section" id="fin-categorias" titulo="Por categoría" icono="chart" className={estilos.bloque}>
                {porCat.length ? (
                  <div className={estilos.barras}>
                    {porCat.map((x, i) => (
                      <div className={estilos.barra} key={x.c}>
                        <div className={estilos.fila}><span className={estilos.nombre}>{x.c} {i < 3 && <Chip tono="primario" tamano="sm">Top {i + 1}</Chip>}</span><span className={`${estilos.sub} ${estilos.dinero}`}>{cop(x.v)}</span></div>
                        <ProgressBar valor={x.v / maxCat} etiqueta={`Gasto en ${x.c}`} tono={i < 3 ? 'primario' : 'neutro'} tamano="sm" />
                      </div>
                    ))}
                  </div>
                ) : <EmptyState compacto icono="chart" titulo="Sin gastos" descripcion={`Sin gastos en ${nombreMes(mes)}.`} />}
              </Card>
              <Card as="section" id="fin-movimientos" titulo="Movimientos" icono="wallet" className={estilos.bloque} accion={<span className={estilos.sub}>{nombreMes(mes)}</span>}>
                {gastosMes.length ? (
                  <ul className={estilos.lista}>{gastosMes.map(it => (
                    <li key={it.id} className={estilos.item}>
                      <div className={estilos.fila}><span className={estilos.nombre}>{it.lugar}</span><span className={estilos.dinero}>{cop(it.valor_cop)}</span></div>
                      <div className={estilos.fila}>
                        <span className={estilos.sub}>{fechaCorta(it.fecha)} · {it.categoria} · {nombreFrente(it.frente)}</span>
                        <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => borrarGasto(it)} aria-label={`Borrar el gasto de ${it.lugar}`}>Borrar</button>
                      </div>
                    </li>
                  ))}</ul>
                ) : <EmptyState compacto icono="wallet" titulo="Sin movimientos" descripcion="Registra tu primer gasto con el formulario." />}
              </Card>
            </div>
            <Card as="section" id="fin-nuevo-gasto" titulo="Nuevo gasto" icono="plus" className={estilos.bloque}>
              <form className={`${estilos.form} ${estilos.formLimpio}`} onSubmit={agregarGasto}>
                <div className={estilos.dos}>
                  <label className={estilos.campo}>Fecha<input id="g-fecha" type="date" value={fg.fecha} onChange={e => setFg({ ...fg, fecha: e.target.value })} /></label>
                  <label className={estilos.campo}>Valor (COP)<input id="g-valor" inputMode="numeric" value={fg.valor} onChange={e => setFg({ ...fg, valor: e.target.value })} placeholder="45000" /></label>
                </div>
                <label className={estilos.campo}>Lugar<input id="g-lugar" value={fg.lugar} onChange={e => setFg({ ...fg, lugar: e.target.value })} placeholder="Éxito, Uber, Mercado Libre…" /></label>
                <div className={estilos.dos}>
                  <label className={estilos.campo}>Categoría
                    <select id="g-cat" value={fg.categoria} onChange={e => setFg({ ...fg, categoria: e.target.value })}>
                      {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className={estilos.campo}>Frente
                    <SelectorFrente id="g-frente" value={fg.frente} onChange={e => setFg({ ...fg, frente: e.target.value })} frentes={frentes} />
                  </label>
                </div>
                <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">Guardar gasto</button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {vista === 'ingresos' && (
        <div id="panel-ingresos" role="tabpanel" aria-labelledby="pestana-ingresos" className={estilos.rejilla}>
          <Card as="section" id="fin-ingresos" titulo="Ingresos" icono="chart" className={estilos.bloque} accion={<span className={estilos.sub}>{nombreMes(mes)}</span>}>
            {ingresosMes.length ? (
              <ul className={estilos.lista}>{ingresosMes.map(i => (
                <li key={i.id} className={estilos.item}>
                  <div className={estilos.fila}><span className={estilos.nombre}>{i.fuente}</span><span className={estilos.dinero}>{cop(i.valor_cop)}</span></div>
                  <div className={estilos.fila}>
                    <span className={estilos.sub}>{fechaCorta(i.fecha)} · {nombreFrente(i.frente)}</span>
                    <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => borrarIngreso(i)} aria-label={`Borrar el ingreso de ${i.fuente}`}>Borrar</button>
                  </div>
                </li>
              ))}</ul>
            ) : <EmptyState compacto icono="chart" titulo="Sin ingresos" descripcion="Sin ingresos registrados este mes." />}
          </Card>
          <Card as="section" id="fin-nuevo-ingreso" titulo="Nuevo ingreso" icono="plus" className={estilos.bloque}>
            <form className={`${estilos.form} ${estilos.formLimpio}`} onSubmit={nuevoIngreso}>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Fecha<input id="i-fecha" type="date" value={fi.fecha} onChange={e => setFi({ ...fi, fecha: e.target.value })} /></label>
                <label className={estilos.campo}>Valor (COP)<input id="i-valor" inputMode="numeric" value={fi.valor} onChange={e => setFi({ ...fi, valor: e.target.value })} /></label>
              </div>
              <label className={estilos.campo}>Fuente<input id="i-fuente" value={fi.fuente} onChange={e => setFi({ ...fi, fuente: e.target.value })} placeholder="Evento, cliente, TANKU…" /></label>
              <label className={estilos.campo}>Frente
                <SelectorFrente id="i-frente" value={fi.frente} onChange={e => setFi({ ...fi, frente: e.target.value })} frentes={frentes} />
              </label>
              <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">Guardar ingreso</button>
            </form>
          </Card>
        </div>
      )}

      {vista === 'compromisos' && (
        <div id="panel-compromisos" role="tabpanel" aria-labelledby="pestana-compromisos" className={estilos.rejilla}>
          <Card as="section" id="fin-recurrentes" titulo="Pagos recurrentes" icono="calendar" className={estilos.bloque}>
            {proximos.length ? (
              <ul className={estilos.lista}>{proximos.map(r => {
                const vencido = r.dias < 0;
                return (
                  <li key={r.id} className={estilos.item}>
                    <div className={estilos.fila}><span className={estilos.nombre}>{r.nombre}</span><span className={estilos.dinero}>{cop(r.valor_cop)}</span></div>
                    <div className={estilos.fila}>
                      <span className={`${estilos.sub} ${vencido || r.dias <= 3 ? estilos.alerta : ''}`}>
                        {vencido ? `Vencido hace ${-r.dias} d` : r.dias === 0 ? 'Vence hoy' : `Vence en ${r.dias} d`} · {fechaCorta(r.vence)}
                      </span>
                      <span className={estilos.acciones}>
                        <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => pagar(r)}>Marcar pagado</button>
                        <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => quitarRecurrente(r)}>Quitar</button>
                      </span>
                    </div>
                  </li>
                );
              })}</ul>
            ) : <EmptyState compacto icono="calendar" titulo="Sin pagos recurrentes" descripcion="Agrega arriendo, servicios, suscripciones o aportes para que te avise antes de que venzan." />}
            <form className={estilos.form} onSubmit={nuevoRecurrente}>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Nombre<input id="r-nombre" value={fr.nombre} onChange={e => setFr({ ...fr, nombre: e.target.value })} placeholder="Google One" /></label>
                <label className={estilos.campo}>Valor (COP)<input id="r-valor" inputMode="numeric" value={fr.valor} onChange={e => setFr({ ...fr, valor: e.target.value })} /></label>
              </div>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Día del mes<input id="r-dia" type="number" min="1" max="31" value={fr.dia} onChange={e => setFr({ ...fr, dia: e.target.value })} /></label>
                <label className={estilos.campo}>Categoría
                  <select id="r-cat" value={fr.categoria} onChange={e => setFr({ ...fr, categoria: e.target.value })}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select>
                </label>
              </div>
              <label className={estilos.campo}>Frente
                <SelectorFrente id="r-frente" value={fr.frente} onChange={e => setFr({ ...fr, frente: e.target.value })} frentes={frentes} />
              </label>
              <button className={estilos.boton} type="submit">Agregar pago recurrente</button>
            </form>
          </Card>

          <Card as="section" id="fin-deudas" titulo="Deudas y préstamos" icono="wallet" className={estilos.bloque}>
            {deudas.length ? (
              <div className={estilos.barras}>
                {deudas.map(d => {
                  const p = 1 - Number(d.saldo) / Number(d.monto_total);
                  return (
                    <div className={estilos.barra} key={d.id}>
                      <div className={estilos.fila}>
                        <span className={estilos.nombre}>{d.nombre} <Chip tono={d.tipo === 'debo' ? 'advertencia' : 'exito'} tamano="sm">{d.tipo === 'debo' ? 'debo' : 'me deben'}</Chip></span>
                        <span className={`${estilos.sub} ${estilos.dinero}`}>{cop(d.saldo)} de {cop(d.monto_total)}</span>
                      </div>
                      <ProgressBar valor={Math.max(0, Math.min(1, p))} etiqueta={`Pagado de ${d.nombre}`} tono="exito" tamano="sm" mostrarValor />
                      <div className={estilos.fila}>
                        <span className={estilos.sub}>{Number(d.saldo) === 0 ? 'Saldada' : d.cuota_cop ? `Cuota ${cop(d.cuota_cop)}` : ''}</span>
                        <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => borrarDeuda(d)} aria-label={`Borrar la deuda ${d.nombre}`}>Borrar</button>
                      </div>
                      {Number(d.saldo) > 0 && (
                        <div className={estilos.insertar}>
                          <label className={estilos.campo}><span className={estilos.soloLector}>Abono a {d.nombre}</span>
                            <input type="text" id={`ab-${d.id}`} inputMode="numeric" placeholder="Abono" value={abono[d.id] ?? ''}
                              onChange={e => setAbono({ ...abono, [d.id]: e.target.value })} />
                          </label>
                          <button className={estilos.boton} type="button" onClick={() => abonar(d)}>Abonar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState compacto icono="wallet" titulo="Sin deudas" descripcion="Sin deudas registradas." />}
            <form className={estilos.form} onSubmit={nuevaDeuda}>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Nombre<input id="d-nombre" value={fd.nombre} onChange={e => setFd({ ...fd, nombre: e.target.value })} placeholder="Préstamo, tarjeta…" /></label>
                <label className={estilos.campo}>Tipo
                  <select id="d-tipo" value={fd.tipo} onChange={e => setFd({ ...fd, tipo: e.target.value })}>
                    <option value="debo">Yo debo</option><option value="me_deben">Me deben</option>
                  </select>
                </label>
              </div>
              <div className={estilos.dos}>
                <label className={estilos.campo}>Monto total<input id="d-total" inputMode="numeric" value={fd.total} onChange={e => setFd({ ...fd, total: e.target.value })} /></label>
                <label className={estilos.campo}>Saldo actual<input id="d-saldo" inputMode="numeric" value={fd.saldo} onChange={e => setFd({ ...fd, saldo: e.target.value })} placeholder="igual al total" /></label>
              </div>
              <label className={estilos.campo}>Cuota (opcional)<input id="d-cuota" inputMode="numeric" value={fd.cuota} onChange={e => setFd({ ...fd, cuota: e.target.value })} /></label>
              <button className={estilos.boton} type="submit">Agregar deuda</button>
            </form>
          </Card>
        </div>
      )}
    </Pantalla>
  );
}
