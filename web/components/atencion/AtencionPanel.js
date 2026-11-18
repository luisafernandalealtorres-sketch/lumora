'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Icon from '@/components/ui/Icon';
import ProgressBar from '@/components/ui/ProgressBar';
import Ring from '@/components/ui/Ring';
import Skeleton from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { crearServicioHabitos } from '@/lib/data/habitos';
import { ejecutar } from '@/lib/data/temporizador';
import { useFrenteActivo } from '@/components/shell/useFrenteActivo';
import { nombreFrenteActivo } from '@/lib/domain/frenteActivo';
import { fechaBogota, sumarDias } from '@/lib/domain/fechas';
import { traducirError } from '@/lib/domain/temporizador';
import { FRENTES_ATENCION, balanceSemana, lunesDe, objetivosPorSemana, semanaCerrada } from '@/lib/domain/atencion';
import estilos from './Atencion.module.css';

const fmt = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const rango = lunes => {
  const f = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${f(lunes)} – ${f(sumarDias(lunes, 6))}`;
};
const textoPuntos = n => `${n} ${n === 1 ? 'punto' : 'puntos'}`;

// `servicio` es opcional: permite inyectar otra fuente de datos (pruebas y vistas previas); por defecto usa Supabase.
export default function AtencionPanel({ servicio: inyectado = null }) {
  const servicio = useMemo(() => inyectado ?? crearServicioHabitos(createClient()), [inyectado]);
  const { frente, quitar } = useFrenteActivo();                       // ?frente= de la URL: el balance muestra solo ese frente
  const hoy = fechaBogota();
  const lunesActual = lunesDe(hoy);
  const [lunes, setLunes] = useState(lunesActual);
  const [estado, setEstado] = useState({ cargando: true, error: null, objetivos: [], sesiones: [] });
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [objetivos, sesiones] = await Promise.all([
        servicio.listarObjetivos({ desde: sumarDias(lunesActual, -84) }),
        servicio.sesionesCompletadas({ desde: sumarDias(lunesActual, -84), hasta: sumarDias(lunesActual, 6) }),
      ]);
      setEstado({ cargando: false, error: null, objetivos, sesiones });
    } catch (e) {
      setEstado({ cargando: false, error: traducirError(e), objetivos: [], sesiones: [] });
    }
  }, [servicio, lunesActual]);
  useEffect(() => { cargar(); }, [cargar]);

  const { cargando, error, objetivos, sesiones } = estado;
  const marco = (hijos, resumen = '') => (
    <div className={estilos.pagina}>
      <EncabezadoAtencion rango={rango(lunes)} resumen={resumen} chip={null} />
      {hijos}
    </div>
  );
  if (cargando) {
    return marco(<div className={estilos.rejilla}><div className={estilos.balance}><Skeleton variante="bloque" alto={260} etiqueta="Cargando objetivos y balance" /></div><div className={estilos.objetivos}><Skeleton variante="bloque" alto={260} etiqueta="Cargando objetivos" /></div></div>);
  }
  if (error?.codigo === 'fase3_no_disponible') {
    return marco(
      <Card as="section" id="atencion-no-disponible" titulo="Atención aún no está activada" icono="alert" className={estilos.bloque}>
        <p>{error.mensaje}</p>
        <p className={estilos.nota}>La interfaz está lista, pero las tablas de objetivos y sesiones de la Fase 3 todavía no existen en la base de datos. No se guarda nada mientras tanto.</p>
      </Card>);
  }
  if (error) return marco(<ErrorState titulo="No se pudo leer la atención" mensaje={error.mensaje} onReintentar={cargar} />);

  const porSemana = objetivosPorSemana(objetivos);
  const cerrada = semanaCerrada(lunes, hoy);
  const balance = balanceSemana({ lunes, hoy, objetivos: porSemana, sesiones, frenteId: frente });
  const objetivosSemana = porSemana[lunes] ?? {};

  async function guardar(valores) {
    setOcupado(true); setAviso(null);
    const r = await ejecutar(async () => {
      for (const f of FRENTES_ATENCION) {
        const nuevo = valores[f.id];
        const previo = objetivosSemana[f.id];
        if (nuevo === '' || nuevo === undefined) { if (previo !== undefined) await servicio.eliminarObjetivo({ semana: lunes, frenteId: f.id }); continue; }
        if (Number(nuevo) !== previo) await servicio.guardarObjetivo({ semana: lunes, frenteId: f.id, puntos: Math.round(Number(nuevo)) });
      }
    });
    setAviso(r.ok ? { ok: true, texto: 'Objetivos guardados.' } : { ok: false, texto: r.error.mensaje });
    await cargar();
    setOcupado(false);
  }

  const chip = balance.enCurso ? { tono: 'advertencia', texto: 'En curso' } : cerrada ? { tono: 'neutro', texto: 'Semana cerrada' } : { tono: 'neutro', texto: 'Aún no empieza' };
  const partes = [];
  if (balance.estado === 'no_iniciado') partes.push('Aún no empieza');
  else {
    partes.push(balance.puntosTotales > 0 ? `${textoPuntos(balance.puntosTotales)} esta semana` : 'Sin puntos registrados');
    if (balance.estado === 'sin_objetivo') partes.push('sin objetivos');
  }
  const conObjetivo = balance.frentes.filter(f => f.cumplimiento !== null);
  const sinObjetivo = balance.frentes.filter(f => f.cumplimiento === null);

  return (
    <div className={estilos.pagina}>
      <EncabezadoAtencion rango={rango(lunes)} resumen={partes.join(' · ')} chip={chip} />

      {aviso && (
        <div className={`${estilos.aviso} ${aviso.ok ? estilos.avisoOk : estilos.avisoError}`} role={aviso.ok ? 'status' : 'alert'}>
          <span>{aviso.texto}</span>
          <button type="button" className={estilos.boton} onClick={() => setAviso(null)}>Cerrar</button>
        </div>
      )}

      <div className={estilos.semana} role="group" aria-label="Semana">
        <button type="button" className={`${estilos.boton} ${estilos.flecha} ${estilos.atras}`} aria-label="Semana anterior" onClick={() => setLunes(sumarDias(lunes, -7))} disabled={lunes <= sumarDias(lunesActual, -84)}><Icon name="arrowRight" size={18} /></button>
        <b className={estilos.rangoSemana}>{rango(lunes)}</b>
        <button type="button" className={`${estilos.boton} ${estilos.flecha}`} aria-label="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))} disabled={lunes >= sumarDias(lunesActual, 28)}><Icon name="arrowRight" size={18} /></button>
        {lunes !== lunesActual && <button type="button" className={estilos.boton} onClick={() => setLunes(lunesActual)}>Esta semana</button>}
      </div>

      {frente && (
        <p className={estilos.aviso} role="note">
          <span>Balance filtrado por <Chip frente={frente} tamano="sm">{nombreFrenteActivo(frente)}</Chip>. Los objetivos de abajo siguen mostrando todos los frentes.</span>
          <button type="button" className={estilos.boton} onClick={quitar}>Ver todos</button>
        </p>
      )}

      <div className={estilos.rejilla}>
        <Card as="section" id="atencion-balance" titulo={frente ? `Balance · ${nombreFrenteActivo(frente)}` : 'Balance de atención'} icono="chart" className={`${estilos.bloque} ${estilos.balance}`}
          accion={<Chip tono={chip.tono} tamano="sm">{chip.texto}</Chip>}>
          {balance.estado === 'ok' && (
            <>
              <div className={estilos.anilloFila}>
                <Ring valor={balance.valor / 100} etiqueta="Balance de la semana" tono="primario" tamano={128} grosor={12} />
                <div className={estilos.anilloTexto}>
                  <b>{textoPuntos(balance.puntosTotales)} esta semana</b>
                  <span>{balance.enCurso ? `Comparado con el objetivo de los ${balance.diasElegibles} días transcurridos (incluye hoy).` : 'Comparado con el objetivo semanal completo.'}</span>
                </div>
              </div>
              <details className={estilos.como}>
                <summary>¿Cómo se calcula?</summary>
                <p className={estilos.nota}>{balance.enCurso ? `Se compara con el objetivo de los ${balance.diasElegibles} días transcurridos (incluye hoy).` : 'Se compara con el objetivo semanal completo.'} El exceso en un frente no compensa el déficit de otro. Un punto es una sesión de Focus completada.</p>
              </details>
            </>
          )}
          {balance.estado === 'sin_objetivo' && (
            <EmptyState icono="target" titulo="Sin objetivo" descripcion={`No hay objetivos para esta semana: no se hereda ninguno de otras semanas. Puntos registrados: ${balance.puntosTotales}.`}>
              {!cerrada && <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={() => document.getElementById('objetivo-tanku')?.focus()}>Define tu primer objetivo</button>}
            </EmptyState>
          )}
          {balance.estado === 'no_iniciado' && <EmptyState compacto icono="calendar" titulo="Esta semana aún no empieza" descripcion="Los días futuros no se contabilizan todavía." />}

          {balance.estado !== 'no_iniciado' && conObjetivo.length > 0 && (
            <ul className={estilos.frentes} aria-label="Puntos por frente">
              {conObjetivo.map(f => (
                <li key={f.id} className={estilos.frenteCard}>
                  <div className={estilos.frenteCabecera}>
                    <span className={estilos.frenteNombre}><span className={estilos.punto} data-frente={f.id} aria-hidden="true" />{f.nombre}</span>
                    <span className={estilos.puntosTexto}><b>{textoPuntos(f.puntos)}</b> de {fmt(f.objetivo)}</span>
                  </div>
                  <ProgressBar valor={f.cumplimiento} etiqueta={`Cumplimiento de ${f.nombre}`} tono={f.id} mostrarValor tamano="sm" />
                </li>
              ))}
            </ul>
          )}
          {balance.estado !== 'no_iniciado' && balance.estado !== 'sin_objetivo' && sinObjetivo.length > 0 && (
            <p className={estilos.sinObjetivo}>Sin objetivo (no cuenta en el balance ni se penaliza): {sinObjetivo.map(f => `${f.nombre}${f.puntos > 0 ? ` (${textoPuntos(f.puntos)})` : ''}`).join(', ')}.</p>
          )}
        </Card>

        <ObjetivosForm key={`${lunes}-${objetivos.length}`} cerrada={cerrada} rango={rango(lunes)} objetivos={objetivosSemana} ocupado={ocupado} onGuardar={guardar} />
      </div>
    </div>
  );
}

function EncabezadoAtencion({ rango: r, resumen, chip }) {
  return (
    <header className={estilos.encabezado}>
      <div className={estilos.encabezadoTexto}>
        <div className="date">Objetivos y balance</div>
        <h1>Atención</h1>
        <p className={estilos.resumen}>{r}{resumen ? ` · ${resumen}` : ''}</p>
      </div>
      {chip && <Chip tono={chip.tono} role="status">{chip.texto}</Chip>}
    </header>
  );
}

function ObjetivosForm({ cerrada, rango: r, objetivos, ocupado, onGuardar }) {
  const [v, setV] = useState(() => Object.fromEntries(FRENTES_ATENCION.map(f => [f.id, objetivos[f.id] === undefined ? '' : String(objetivos[f.id])])));
  const mover = (id, delta) => setV(prev => {
    const actual = prev[id] === '' ? null : Number(prev[id]);
    if (actual === null && delta < 0) return prev;                 // sin objetivo: restar no hace nada
    return { ...prev, [id]: String(Math.max(0, (actual ?? 0) + delta)) };
  });
  return (
    <Card as="section" id="atencion-objetivos" titulo="Objetivos de la semana" icono="target" className={`${estilos.bloque} ${estilos.objetivos}`}>
      {cerrada && <p className={estilos.cerrada} role="note"><Icon name="info" size={16} /> Esta semana ya terminó: sus objetivos son inmutables (la base de datos los protege).</p>}
      <form className={estilos.form} onSubmit={e => { e.preventDefault(); onGuardar(v); }}>
        <div>
          {FRENTES_ATENCION.map(f => (
            <div key={f.id} className={estilos.fila}>
              <label htmlFor={`objetivo-${f.id}`} className={estilos.filaNombre}><span className={estilos.punto} data-frente={f.id} aria-hidden="true" />{f.nombre}<span className={estilos.soloLector}> (puntos)</span></label>
              <div className={estilos.selector}>
                <button type="button" className={estilos.paso} aria-label={`Restar un punto a ${f.nombre}`} disabled={cerrada || v[f.id] === ''} onClick={() => mover(f.id, -1)}>−</button>
                <input id={`objetivo-${f.id}`} type="number" inputMode="numeric" min="0" step="1" value={v[f.id]} disabled={cerrada} placeholder="Sin objetivo"
                  onChange={e => setV({ ...v, [f.id]: e.target.value })} />
                <button type="button" className={estilos.paso} aria-label={`Sumar un punto a ${f.nombre}`} disabled={cerrada} onClick={() => mover(f.id, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
        <p className={estilos.nota}>Un punto = una sesión de Focus completada. Deja un frente vacío para no fijarle objetivo. Los hábitos no suman puntos.</p>
        {!cerrada && <button type="submit" className={`${estilos.boton} ${estilos.primario} ${estilos.lleno}`} disabled={ocupado}>Guardar objetivos</button>}
      </form>
    </Card>
  );
}
