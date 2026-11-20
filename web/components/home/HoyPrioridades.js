'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { createClient } from '@/lib/supabase/client';
import { alternarPendiente, crearPendiente, validarPendiente } from '@/lib/data/acciones';
import { frenteDeSlug } from '@/lib/domain/frentesMap';
import { frenteInicial } from '@/lib/domain/formularios';
import { esTodoElDia } from '@/lib/domain/agenda';
import Pendientes from '@/components/Pendientes';
import timer from '@/components/timer/Timer.module.css';
import BloqueEstado from './BloqueEstado';
import { ActividadReciente } from './Bloques';
import estilos from './Home.module.css';

const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

// Alta rápida dentro de Hoy cuando todavía no hay pendientes: en vez de una superficie vacía, el bloque es útil desde el primer momento.
function AltaRapida({ frentes }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [frente, setFrente] = useState(frenteInicial('miDiaPendiente'));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    const v = validarPendiente({ texto, frente, fechaLimite: '' });
    if (!v.ok) { setError(v.error); return; }
    setError(null); setEnviando(true);
    try { await crearPendiente(createClient(), v.valor); setTexto(''); router.refresh(); } catch { setError('No se pudo guardar. Intenta de nuevo.'); } finally { setEnviando(false); }
  }
  return (
    <form className={estilos.altaRapida} onSubmit={enviar}>
      <label className={timer.campo}>Escribe tu primer pendiente
        <input type="text" value={texto} onChange={e => setTexto(e.target.value)} maxLength={200} placeholder="¿Qué necesitas hacer?" />
      </label>
      <label className={timer.campo}>Frente
        <select value={frente} onChange={e => setFrente(e.target.value)}>{frentes.map(f => <option key={f.slug} value={f.slug}>{f.nombre}</option>)}</select>
      </label>
      <button type="submit" className={`${timer.boton} ${timer.primario}`} disabled={enviando}>Agregar</button>
      {error && <p className={timer.nota} role="alert">{error}</p>}
    </form>
  );
}

// E. Hoy: prioridades (vencidos, vencen hoy y los abiertos más antiguos), «Todos los pendientes» (componente heredado intacto),
// agenda y correos SOLO si su fuente está conectada, y la actividad reciente. Sin registros, el bloque es compacto y útil.
export default function HoyPrioridades({ prioridades, resumen, errorPendientes, frentes, pendientesInicial, metas, agenda, agendaInfo, correos, actividad, ahoraMs }) {
  const router = useRouter();
  const [hechos, setHechos] = useState({});          // optimista: id → hecho
  const [error, setError] = useState(null);
  const sinPendientes = !errorPendientes && resumen.estado === 'sin_registros';

  async function alternar(item) {
    const actual = hechos[item.id] ?? item.hecho;
    setHechos({ ...hechos, [item.id]: !actual }); setError(null);
    try { await alternarPendiente(createClient(), { ...item, hecho: actual }); router.refresh(); }
    catch { setHechos({ ...hechos, [item.id]: actual }); setError('No se pudo actualizar el pendiente. Intenta de nuevo.'); }
  }

  return (
    <Card as="section" id="home-hoy" titulo="Hoy" icono="check" className={estilos.bloque}
      accion={!errorPendientes && resumen.estado === 'datos' ? <Chip tono="neutro" tamano="sm">{resumen.completadosHoy} completados hoy</Chip> : null}>
      <h3 className={estilos.subtitulo}>Prioridades</h3>
      {errorPendientes ? <BloqueEstado estado="error_lectura" detalle="No se pudieron leer los pendientes." />
        : sinPendientes ? (
          <>
            <BloqueEstado estado="sin_registros" compacto detalle="Aún no tienes pendientes." />
            <AltaRapida frentes={frentes} />
          </>
        )
        : prioridades.items.length === 0 ? <BloqueEstado estado="datos" compacto detalle="Todos tus pendientes están completados." />
        : (
          <ul className={estilos.prioridades}>
            {prioridades.items.map(p => {
              const hecho = hechos[p.id] ?? p.hecho;
              return (
                <li key={p.id} data-urgencia={p.urgencia} className={hecho ? estilos.hecho : ''}>
                  <label className={estilos.casilla}>
                    <input type="checkbox" checked={hecho} onChange={() => alternar(p)} />
                    <span>{p.texto}</span>
                  </label>
                  <span className={estilos.prioridadMeta}>
                    <Chip frente={frenteDeSlug(p.frente).id === 'sin-asignar' ? undefined : frenteDeSlug(p.frente).id} tamano="sm">{frenteDeSlug(p.frente).nombre}</Chip>
                    <span className={p.urgencia === 'vencido' ? estilos.vencido : estilos.nota}>{p.motivo}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      {error && <p className={estilos.nota} role="alert">{error}</p>}
      {prioridades.ocultos > 0 && <p className={estilos.nota}>{prioridades.ocultos} más en «Todos los pendientes».</p>}
      {!sinPendientes && <button type="button" className={estilos.enlaceBoton} onClick={() => window.dispatchEvent(new CustomEvent('home:accion', { detail: 'pendiente' }))}>+ Nuevo pendiente</button>}

      {(agenda.length > 0 || ['sin_registros', 'desactualizada'].includes(agendaInfo?.estado)) && (
        <>
          <h3 className={estilos.subtitulo}>Agenda de hoy</h3>
          {agenda.length > 0 ? (
            <ul className={estilos.actividad}>
              {agenda.map(e => (
                <li key={e.id}>
                  <b>{esTodoElDia(e) ? 'Todo el día' : hora(e.inicio)}</b> {e.titulo}{' '}
                  {e.frente_id ? <Chip frente={e.frente_id} tamano="sm" /> : <Chip tono="neutro" tamano="sm">Sin asignar</Chip>}
                  {e.detalle && <div className={estilos.nota}>{e.detalle}</div>}
                </li>
              ))}
            </ul>
          ) : agendaInfo.estado === 'sin_registros' ? (
            <p className={estilos.nota}>Día libre: sin eventos en los calendarios sincronizados{agendaInfo.pendientes.length ? ` (falta conectar ${agendaInfo.pendientes.join(', ')})` : ''}.</p>
          ) : (
            <p className={estilos.nota} role="note">Agenda desactualizada: la última sincronización es vieja, así que no sabemos si hoy tienes eventos.</p>
          )}
          {agendaInfo?.estado === 'datos' && agendaInfo.vencida && <p className={estilos.nota} role="note">Esta agenda puede estar desactualizada.</p>}
        </>
      )}
      {correos.length > 0 && (
        <>
          <h3 className={estilos.subtitulo}>Correos para revisar</h3>
          <ul className={estilos.actividad}>{correos.map(c => <li key={c.id}><b>{c.remitente}</b> {c.etiqueta && <Chip tono={c.urgente ? 'advertencia' : 'neutro'} tamano="sm">{c.etiqueta}</Chip>}<div>{c.asunto}</div></li>)}</ul>
        </>
      )}

      {!errorPendientes && !sinPendientes && (
        <details className={estilos.plegable}>
          <summary>Todos los pendientes ({resumen.abiertos} abiertos)</summary>
          <Pendientes key={pendientesInicial.map(p => `${p.id}${p.hecho ? 1 : 0}`).join()} frentes={frentes} inicial={pendientesInicial} metas={metas} />
        </details>
      )}
      {actividad.length > 0 ? (
        <details className={estilos.plegable}>
          <summary>Actividad reciente</summary>
          <ActividadReciente items={actividad} ahoraMs={ahoraMs} />
        </details>
      ) : <p className={estilos.filaCompacta}><b>Actividad reciente:</b> sin registros todavía.</p>}
    </Card>
  );
}
