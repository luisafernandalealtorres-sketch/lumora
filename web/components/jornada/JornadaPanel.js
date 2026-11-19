'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Pantalla from '@/components/ui/Pantalla';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import { hoyBogota, fechaCorta, racha } from '@/lib/format';
import estilos from './Jornada.module.css';

const vacio = fecha => ({ fecha, relato: '', b1: '', b2: '', b3: '', no_salio: '', mejora_manana: '' });

function aForm(j, fecha) {
  if (!j) return vacio(fecha);
  const [b1 = '', b2 = '', b3 = ''] = j.salio_bien ?? [];
  return { fecha: j.fecha, relato: j.relato ?? '', b1, b2, b3, no_salio: j.no_salio ?? '', mejora_manana: j.mejora_manana ?? '' };
}

const CAMPOS = ['relato', 'b1', 'b2', 'b3', 'no_salio', 'mejora_manana'];

export default function JornadaPanel({ userId, inicial }) {
  const supabase = createClient();
  const hoy = hoyBogota();
  const [items, setItems] = useState(inicial);
  const [f, setF] = useState(() => aForm(inicial.find(j => j.fecha === hoy), hoy));
  const [plan, setPlan] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [pendiente, setPendiente] = useState(null);

  const conRelato = items.filter(j => j.relato);
  const dias = racha(conRelato.map(j => j.fecha));
  const ultimas = conRelato.slice(0, 7);
  const hoyGuardada = conRelato.some(j => j.fecha === hoy);
  const ultimoPlan = items.find(j => j.plan_semana);

  // Hay cambios sin guardar si el formulario difiere de lo guardado para esa fecha.
  const guardado = aForm(items.find(j => j.fecha === f.fecha), f.fecha);
  const sucio = CAMPOS.some(c => f[c] !== guardado[c]);

  function irA(fecha) {
    setF(aForm(items.find(j => j.fecha === fecha), fecha));
    setMsg(''); setError(''); setPendiente(null);
  }

  function elegir(fecha, { enfocar = false } = {}) {
    if (!fecha || fecha === f.fecha) return;
    if (sucio) return setPendiente({ fecha, enfocar });
    irA(fecha);
    if (enfocar) enfocarFormulario();
  }

  function enfocarFormulario() {
    setTimeout(() => {
      const el = document.getElementById('j-relato');
      el?.scrollIntoView?.({ block: 'center' });
      el?.focus();
    }, 0);
  }

  function editar(e) { setF({ ...f, ...e }); setMsg(''); setError(''); }

  async function guardar(e) {
    e.preventDefault();
    if (!f.relato.trim()) { setMsg(''); return setError('Cuéntame brevemente cómo te fue.'); }
    const fila = {
      user_id: userId, fecha: f.fecha, relato: f.relato.trim(),
      salio_bien: [f.b1, f.b2, f.b3].map(x => x.trim()).filter(Boolean),
      no_salio: f.no_salio.trim() || null, mejora_manana: f.mejora_manana.trim() || null,
    };
    const { data, error } = await supabase.from('jornadas').upsert(fila, { onConflict: 'user_id,fecha' }).select().single();
    if (error) { setMsg(''); return setError('No se pudo guardar. Intenta de nuevo.'); }
    setError(''); setMsg('Guardado.');
    setItems([data, ...items.filter(j => j.fecha !== data.fecha)].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setF(aForm(data, data.fecha));
  }

  async function guardarPlan() {
    if (!plan.trim()) return;
    const { data, error } = await supabase.from('jornadas')
      .upsert({ user_id: userId, fecha: hoy, plan_semana: plan.trim() }, { onConflict: 'user_id,fecha' }).select().single();
    if (error) { setMsg(''); return setError('No se pudo guardar el plan.'); }
    setError('');
    setItems([data, ...items.filter(j => j.fecha !== data.fecha)].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setPlan(''); setMsg('Plan guardado.');
  }

  const resumen = conRelato.length
    ? `${dias > 0 ? `Racha de ${dias} ${dias === 1 ? 'día' : 'días'} · ` : ''}última jornada: ${fechaCorta(conRelato[0].fecha)}`
    : 'Aún no hay jornadas';

  return (
    <Pantalla fecha="Revisión diaria" titulo="Jornada" resumen={resumen}
      acciones={dias > 0
        ? <Chip tono="primario" icono="flame">{dias} {dias === 1 ? 'día seguido' : 'días seguidos'}</Chip>
        : <Chip tono="neutro">Sin racha</Chip>}>
      <div className={estilos.rejilla}>
        <Card as="section" id="cuenta-dia" className={estilos.bloque} titulo="Cuéntame tu día" icono="book"
          accion={<Chip tono={hoyGuardada ? 'exito' : 'neutro'}>{hoyGuardada ? 'Hoy guardada' : 'Hoy pendiente'}</Chip>}>
          <form className={estilos.form} onSubmit={guardar}>
            <label className={estilos.campo}>Fecha
              <input id="j-fecha" type="date" value={f.fecha} onChange={e => elegir(e.target.value)} />
            </label>

            {pendiente && (
              <div className={estilos.confirmar} role="alertdialog" aria-label="Cambios sin guardar">
                <p>Tienes cambios sin guardar. Si cambias de día se pierden.</p>
                <div className={estilos.acciones}>
                  <button type="button" className={`${estilos.boton} ${estilos.peligro}`} onClick={() => { const p = pendiente; irA(p.fecha); if (p.enfocar) enfocarFormulario(); }}>Descartar y cambiar</button>
                  <button type="button" className={estilos.boton} onClick={() => setPendiente(null)}>Seguir editando</button>
                </div>
              </div>
            )}

            <label className={estilos.campo}>Cómo me fue (3 o 4 líneas)
              <textarea id="j-relato" value={f.relato} onChange={e => editar({ relato: e.target.value })} />
            </label>
            <fieldset className={estilos.campo}>
              <legend>3 cosas que salieron bien</legend>
              {[['b1', '1'], ['b2', '2'], ['b3', '3']].map(([k, n]) => (
                <input key={k} id={`j-${k}`} value={f[k]} aria-label={`Cosa ${n} que salió bien`} placeholder={`${n}.`} onChange={e => editar({ [k]: e.target.value })} />
              ))}
            </fieldset>
            <label className={estilos.campo}>Lo que no salió como esperaba y por qué
              <textarea id="j-no" className={estilos.corto} value={f.no_salio} onChange={e => editar({ no_salio: e.target.value })} />
            </label>
            <label className={estilos.campo}>Una cosa concreta para mejorar mañana
              <input id="j-mejora" value={f.mejora_manana} onChange={e => editar({ mejora_manana: e.target.value })} />
            </label>
            <button className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} type="submit">Guardar jornada</button>
            {msg && <p className={estilos.ok} role="status">{msg}</p>}
            {error && <p className={estilos.error} role="alert">{error}</p>}
          </form>
        </Card>

        <div className={estilos.col}>
          <Card as="section" id="ultimos-dias" className={estilos.bloque} titulo="Últimos días" icono="clock">
            {ultimas.length ? (
              <ul className={estilos.lista}>
                {ultimas.map(j => (
                  <li key={j.id} className={estilos.item}>
                    <div className={estilos.fila}>
                      <span className={estilos.fecha}>{fechaCorta(j.fecha)}</span>
                      <button type="button" className={`${estilos.boton} ${estilos.ghost}`} onClick={() => elegir(j.fecha, { enfocar: true })} aria-label={`Editar la jornada del ${fechaCorta(j.fecha)}`}>Editar</button>
                    </div>
                    <p className={estilos.relato}>{j.relato}</p>
                    {j.mejora_manana && <p className={estilos.sub}>Mejorar: {j.mejora_manana}</p>}
                  </li>
                ))}
              </ul>
            ) : <EmptyState compacto icono="book" titulo="Todavía no hay jornadas" descripcion="Cuéntame el primer día." />}
          </Card>

          <Card as="section" id="plan-semana" className={estilos.bloque} titulo="Plan de la semana" icono="calendar">
            {ultimoPlan ? (
              <div className={estilos.plan}>
                <p className={estilos.sub}>Guardado el {fechaCorta(ultimoPlan.fecha)}</p>
                <p className={estilos.relato}>{ultimoPlan.plan_semana}</p>
              </div>
            ) : <p className={estilos.sub}>Aún no hay plan. Los domingos pídeme el plan y queda aquí. También puedes escribirlo tú.</p>}
            <div className={estilos.form}>
              <label className={estilos.campo}>Nuevo plan (3 prioridades, qué evitar, reparto de días)
                <textarea id="j-plan" value={plan} onChange={e => setPlan(e.target.value)} />
              </label>
              <button className={estilos.boton} type="button" disabled={!plan.trim()} onClick={guardarPlan}>Guardar plan</button>
            </div>
          </Card>
        </div>
      </div>
    </Pantalla>
  );
}
