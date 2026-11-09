'use client';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import SelectorFrente from '@/components/SelectorFrente';
import { frenteInicial } from '@/lib/domain/formularios';
import { cop, hoyBogota, mesActual, nombreMes, fechaCorta, esNegocio, CATEGORIAS } from '@/lib/format';

export default function Gastos({ frentes, inicial }) {
  const supabase = createClient();
  const [items, setItems] = useState(inicial);
  const [mes, setMes] = useState(mesActual());
  const [error, setError] = useState('');
  const [f, setF] = useState({ fecha: hoyBogota(), lugar: '', categoria: 'Comida', valor: '', frente: frenteInicial('gastoNuevo') });

  const meses = useMemo(() => {
    const s = new Set([mesActual(), ...items.map(i => i.fecha.slice(0, 7))]);
    return [...s].sort().reverse();
  }, [items]);

  const delMes = items.filter(i => i.fecha.startsWith(mes));
  const total = delMes.reduce((s, i) => s + Number(i.valor_cop), 0);
  const negocio = delMes.filter(i => esNegocio(i.frente)).reduce((s, i) => s + Number(i.valor_cop), 0);
  const porCat = CATEGORIAS.map(c => ({
    c, v: delMes.filter(i => i.categoria === c).reduce((s, i) => s + Number(i.valor_cop), 0),
  })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const max = Math.max(...porCat.map(x => x.v), 1);

  async function agregar(e) {
    e.preventDefault();
    const valor = Math.round(Number(String(f.valor).replace(/[^\d]/g, '')));
    if (!f.lugar.trim() || !valor) return setError('Escribe el lugar y el valor.');
    const { data, error } = await supabase.from('gastos')
      .insert({ fecha: f.fecha, lugar: f.lugar.trim(), categoria: f.categoria, valor_cop: valor, frente: f.frente })
      .select().single();
    if (error) return setError('No se pudo guardar. Intenta de nuevo.');
    setError('');
    setItems([data, ...items].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setF({ ...f, lugar: '', valor: '' });
  }

  async function borrar(it) {
    const antes = items;
    setItems(items.filter(x => x.id !== it.id));
    const { error } = await supabase.from('gastos').delete().eq('id', it.id);
    if (error) setItems(antes);
  }

  return (
    <>
      <header>
        <div><div className="date">Finanzas</div><h1>Gastos</h1></div>
        <div className="toolbar">
          <select id="mes" value={mes} onChange={e => setMes(e.target.value)} aria-label="Mes">
            {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
        </div>
      </header>

      <div className="grid">
        <div className="stat"><b className="money">{cop(total)}</b><span>total del mes</span></div>
        <div className="stat"><b className="money">{cop(negocio)}</b><span>negocio</span></div>
        <div className="stat"><b className="money">{cop(total - negocio)}</b><span>personal</span></div>
        <div className="stat"><b>{delMes.length}</b><span>movimientos</span></div>
      </div>

      <div className="cols">
        <div className="stack">
          <section>
            <h2>Por categoría <small>top 3 destacado</small></h2>
            {porCat.length ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {porCat.map((x, i) => (
                  <div className="avance" key={x.c}>
                    <div className="row"><span>{i < 3 ? '● ' : ''}{x.c}</span><span className="sub money">{cop(x.v)}</span></div>
                    <div className="bar"><i style={{ width: `${(x.v / max) * 100}%`, opacity: i < 3 ? 1 : 0.45 }} /></div>
                  </div>
                ))}
              </div>
            ) : <p className="empty">Sin gastos en {nombreMes(mes)}.</p>}
          </section>

          <section>
            <h2>Movimientos <small>{nombreMes(mes)}</small></h2>
            {delMes.length ? (
              <ul>{delMes.map(it => (
                <li key={it.id}>
                  <div className="rowx"><span className="from">{it.lugar}</span><span className="money">{cop(it.valor_cop)}</span></div>
                  <div className="rowx">
                    <span className="sub">{fechaCorta(it.fecha)} · {it.categoria} · {frentes.find(x => x.slug === it.frente)?.nombre ?? it.frente}</span>
                    <button className="link" onClick={() => borrar(it)}>Borrar</button>
                  </div>
                </li>
              ))}</ul>
            ) : <p className="empty">Registra tu primer gasto con el formulario.</p>}
          </section>
        </div>

        <section>
          <h2>Nuevo gasto</h2>
          <form className="form" onSubmit={agregar}>
            <div className="two">
              <label>Fecha<input id="g-fecha" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></label>
              <label>Valor (COP)<input id="g-valor" inputMode="numeric" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} placeholder="45000" /></label>
            </div>
            <label>Lugar<input id="g-lugar" value={f.lugar} onChange={e => setF({ ...f, lugar: e.target.value })} placeholder="Éxito, Uber, Mercado Libre…" /></label>
            <div className="two">
              <label>Categoría
                <select id="g-cat" value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })}>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Frente
                <SelectorFrente id="g-frente" value={f.frente} onChange={e => setF({ ...f, frente: e.target.value })} frentes={frentes} />
              </label>
            </div>
            <button className="btn" type="submit">Guardar gasto</button>
            {error && <div className="err">{error}</div>}
          </form>
        </section>
      </div>
    </>
  );
}
