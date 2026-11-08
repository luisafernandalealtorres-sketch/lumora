'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { hoyBogota, fechaCorta, racha } from '@/lib/format';

const vacio = fecha => ({ fecha, relato: '', b1: '', b2: '', b3: '', no_salio: '', mejora_manana: '' });

function aForm(j, fecha) {
  if (!j) return vacio(fecha);
  const [b1 = '', b2 = '', b3 = ''] = j.salio_bien ?? [];
  return { fecha: j.fecha, relato: j.relato ?? '', b1, b2, b3, no_salio: j.no_salio ?? '', mejora_manana: j.mejora_manana ?? '' };
}

export default function Jornada({ userId, inicial }) {
  const supabase = createClient();
  const [items, setItems] = useState(inicial);
  const [f, setF] = useState(() => aForm(inicial.find(j => j.fecha === hoyBogota()), hoyBogota()));
  const [plan, setPlan] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const dias = racha(items.filter(j => j.relato).map(j => j.fecha));
  const ultimas = items.slice(0, 7);

  function elegir(fecha) {
    setF(aForm(items.find(j => j.fecha === fecha), fecha));
    setMsg(''); setError('');
  }

  async function guardar(e) {
    e.preventDefault();
    if (!f.relato.trim()) return setError('Cuéntame brevemente cómo te fue.');
    const fila = {
      user_id: userId, fecha: f.fecha, relato: f.relato.trim(),
      salio_bien: [f.b1, f.b2, f.b3].map(x => x.trim()).filter(Boolean),
      no_salio: f.no_salio.trim() || null, mejora_manana: f.mejora_manana.trim() || null,
    };
    const { data, error } = await supabase.from('jornadas').upsert(fila, { onConflict: 'user_id,fecha' }).select().single();
    if (error) return setError('No se pudo guardar. Intenta de nuevo.');
    setError(''); setMsg('Guardado.');
    setItems([data, ...items.filter(j => j.fecha !== data.fecha)].sort((a, b) => b.fecha.localeCompare(a.fecha)));
  }

  async function guardarPlan() {
    const fecha = hoyBogota();
    if (!plan.trim()) return;
    const { data, error } = await supabase.from('jornadas')
      .upsert({ user_id: userId, fecha, plan_semana: plan.trim() }, { onConflict: 'user_id,fecha' }).select().single();
    if (error) return setError('No se pudo guardar el plan.');
    setItems([data, ...items.filter(j => j.fecha !== data.fecha)]);
    setPlan(''); setMsg('Plan guardado.');
  }

  const ultimoPlan = items.find(j => j.plan_semana);

  return (
    <>
      <header>
        <div><div className="date">Revisión diaria</div><h1>Jornada</h1></div>
        <div className="stat" style={{ padding: '8px 14px' }}><b>{dias}</b><span>días seguidos</span></div>
      </header>

      <div className="cols">
        <section>
          <h2>Cuéntame tu día</h2>
          <form className="form" onSubmit={guardar}>
            <label>Fecha<input id="j-fecha" type="date" value={f.fecha} onChange={e => elegir(e.target.value)} /></label>
            <label>Cómo me fue (3 o 4 líneas)
              <textarea id="j-relato" value={f.relato} onChange={e => setF({ ...f, relato: e.target.value })} />
            </label>
            <label>3 cosas que salieron bien
              <input id="j-b1" value={f.b1} onChange={e => setF({ ...f, b1: e.target.value })} />
              <input id="j-b2" value={f.b2} onChange={e => setF({ ...f, b2: e.target.value })} />
              <input id="j-b3" value={f.b3} onChange={e => setF({ ...f, b3: e.target.value })} />
            </label>
            <label>Lo que no salió como esperaba y por qué
              <textarea id="j-no" value={f.no_salio} onChange={e => setF({ ...f, no_salio: e.target.value })} style={{ minHeight: 60 }} />
            </label>
            <label>Una cosa concreta para mejorar mañana
              <input id="j-mejora" value={f.mejora_manana} onChange={e => setF({ ...f, mejora_manana: e.target.value })} />
            </label>
            <button className="btn" type="submit">Guardar jornada</button>
            {msg && <p className="sub" role="status">{msg}</p>}
            {error && <div className="err">{error}</div>}
          </form>
        </section>

        <div className="stack">
          <section>
            <h2>Últimos días</h2>
            {ultimas.filter(j => j.relato).length ? (
              <ul>{ultimas.filter(j => j.relato).map(j => (
                <li key={j.id}>
                  <div className="rowx"><span className="from">{fechaCorta(j.fecha)}</span>
                    <button className="link" onClick={() => elegir(j.fecha)}>Editar</button></div>
                  <div className="sub pre">{j.relato}</div>
                  {j.mejora_manana && <div className="sub">Mejorar: {j.mejora_manana}</div>}
                </li>
              ))}</ul>
            ) : <p className="empty">Todavía no hay jornadas. Cuéntame el primer día.</p>}
          </section>

          <section>
            <h2>Plan de la semana</h2>
            {ultimoPlan ? (
              <div className="card"><div className="sub">Guardado el {fechaCorta(ultimoPlan.fecha)}</div><div className="pre">{ultimoPlan.plan_semana}</div></div>
            ) : <p className="empty">Los domingos pídeme el plan y queda aquí. También puedes escribirlo tú.</p>}
            <div className="form" style={{ marginTop: 10 }}>
              <label>Nuevo plan (3 prioridades, qué evitar, reparto de días)
                <textarea id="j-plan" value={plan} onChange={e => setPlan(e.target.value)} />
              </label>
              <button className="btn sec" type="button" onClick={guardarPlan}>Guardar plan</button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
