import { createClient } from '@/lib/supabase/server';
import Pendientes from '@/components/Pendientes';

export const dynamic = 'force-dynamic';

const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export default async function Home() {
  const supabase = createClient();
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const fechaLarga = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

  const metasR = await supabase.from('metas').select('id,titulo,frente').eq('estado', 'activa').order('creado_en');
  const [frentesR, pendR, agendaR, correosR, resumenR] = await Promise.all([
    supabase.from('frentes').select('*').order('orden'),
    supabase.from('pendientes').select('*').order('creado_en'),
    supabase.from('agenda_hoy').select('*').eq('fecha', hoy).order('inicio'),
    supabase.from('correos_hoy').select('*').eq('fecha', hoy).order('urgente', { ascending: false }),
    supabase.from('resumen_dia').select('*').eq('fecha', hoy).maybeSingle(),
  ]);

  const frentes = frentesR.data ?? [];
  const pend = pendR.data ?? [];
  const agenda = agendaR.data ?? [];
  const correos = correosR.data ?? [];
  const resumen = resumenR.data;

  const avance = frentes
    .map(f => {
      const l = pend.filter(p => p.frente === f.slug);
      return { ...f, total: l.length, hechos: l.filter(p => p.hecho).length };
    })
    .filter(f => f.total > 0);

  return (
    <>
      <header>
        <div>
          <div className="date">{fechaLarga}</div>
          <h1>Mi día</h1>
        </div>
      </header>

      <div className="summary">
        <b>Hoy y mañana</b>
        <span>{resumen?.texto ?? 'El resumen del día aparece aquí cuando se actualiza a las 6:00 a. m.'}</span>
      </div>

      <div className="cols">
        <div className="stack">
          <section>
            <h2>Agenda de hoy</h2>
            {agenda.length ? (
              <ul>{agenda.map(e => (
                <li className="ev" key={e.id}>
                  <span className="time">{hora(e.inicio)}</span>
                  <div><div>{e.titulo}</div>{e.detalle && <div className="sub">{e.detalle}</div>}</div>
                </li>
              ))}</ul>
            ) : <p className="empty">Sin eventos hoy.</p>}
          </section>

          <section>
            <h2>Correos para revisar</h2>
            {correos.length ? (
              <ul>{correos.map(c => (
                <li key={c.id}>
                  <div><span className="from">{c.remitente}</span>{c.etiqueta && <span className={`pill ${c.urgente ? 'warn' : ''}`}>{c.etiqueta}</span>}</div>
                  <div>{c.asunto}</div>
                  {c.resumen && <div className="sub">{c.resumen}</div>}
                </li>
              ))}</ul>
            ) : <p className="empty">Sin correos por revisar.</p>}
          </section>

          <section>
            <h2>Avance por frente</h2>
            {avance.length ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {avance.map(f => (
                  <div className="avance" key={f.slug}>
                    <div className="row"><span>{f.nombre}</span><span className="sub">{f.hechos} de {f.total}</span></div>
                    <div className="bar"><i style={{ width: `${(f.hechos / f.total) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            ) : <p className="empty">Cuando agregues pendientes verás aquí el avance de cada frente.</p>}
          </section>
        </div>

        <Pendientes frentes={frentes} inicial={pend} metas={metasR.data ?? []} />
      </div>
    </>
  );
}
