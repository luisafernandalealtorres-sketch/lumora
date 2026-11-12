'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import ErrorState from '@/components/ui/ErrorState';
import Ring from '@/components/ui/Ring';
import Skeleton from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { cargarLifePulse } from '@/lib/data/lifePulse';
import { useFrenteActivo } from '@/components/shell/useFrenteActivo';
import { nombreFrenteActivo } from '@/lib/domain/frenteActivo';
import { fechaBogota } from '@/lib/domain/fechas';
import { traducirError, duracionLegible } from '@/lib/domain/temporizador';
import { TIPOS_PERIODO, rangoPeriodo, moverPeriodo, fraccion, textoEstado } from '@/lib/domain/lifePulse';
import estilos from './LifePulse.module.css';

const corto = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const mesLargo = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export function etiquetaPeriodo(tipo, ancla) {
  const r = rangoPeriodo(tipo, ancla);
  if (tipo === 'dia') return new Date(`${ancla}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  if (tipo === 'mes') return mesLargo(ancla);
  return `${corto(r.desde)} – ${corto(r.hasta)}`;
}
// Nombres en español de los tres indicadores (las claves del cálculo no cambian).
const NOMBRE_INDICADOR = { Execution: 'Ejecución', Balance: 'Balance', Wellbeing: 'Bienestar' };
const pct = v => `${Math.round(v)} %`;

function estadoChip(ind, texto) {
  const tono = ind.estado === 'ok' ? 'exito' : ind.estado === 'parcial' ? 'advertencia' : 'neutro';
  return <Chip tono={tono} tamano="sm">{texto}</Chip>;
}

/** Carga de datos compartida por el panel completo y el resumen. `cargador` es inyectable (pruebas y vistas previas). */
export function useLifePulse({ tipo, ancla, frenteId = null, cargador = null }) {
  const supabase = useMemo(() => (cargador ? null : createClient()), [cargador]);
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null });
  const cargar = useCallback(async () => {
    setEstado(e => ({ ...e, cargando: true }));
    try {
      const datos = await (cargador ? cargador({ tipo, ancla, frenteId }) : cargarLifePulse(supabase, { tipo, ancla, frenteId }));
      setEstado({ cargando: false, error: null, datos });
    } catch (e) {
      setEstado({ cargando: false, error: traducirError(e), datos: null });
    }
  }, [supabase, cargador, tipo, ancla, frenteId]);
  useEffect(() => { cargar(); }, [cargar]);
  return { ...estado, recargar: cargar };
}

function NoDisponible({ error }) {
  return (
    <Card as="section" id="lp-no-disponible" titulo="Life Pulse aún no está activado" icono="alert">
      <p>{error.mensaje}</p>
      <p className={estilos.nota}>Los indicadores se calculan con el historial y las tablas de la Fase 3. Mientras no existan en la base de datos, no se muestra ningún valor (ni siquiera cero).</p>
    </Card>
  );
}

export default function LifePulsePanel({ cargador = null, anclaInicial = null }) {
  const hoy = fechaBogota();
  const [tipo, setTipo] = useState('semana');
  const [ancla, setAncla] = useState(anclaInicial ?? hoy);
  const { frente, quitar } = useFrenteActivo();                       // ?frente= de la URL: filtra solo Balance
  const { cargando, error, datos, recargar } = useLifePulse({ tipo, ancla, frenteId: frente, cargador });
  const rango = rangoPeriodo(tipo, ancla);

  return (
    <div className={estilos.pagina}>
      <div className={estilos.barra}>
        <div className={estilos.tipos} role="group" aria-label="Período">
          {TIPOS_PERIODO.map(p => (
            <button key={p.id} type="button" className={`${estilos.boton} ${tipo === p.id ? estilos.activo : ''}`} aria-pressed={tipo === p.id}
              onClick={() => { setTipo(p.id); setAncla(hoy); }}>{p.nombre}</button>
          ))}
        </div>
        <div className={estilos.nav} role="group" aria-label="Navegar períodos">
          <button type="button" className={estilos.boton} onClick={() => setAncla(moverPeriodo(tipo, ancla, -1))}>Anterior</button>
          <b className={estilos.rango}>{etiquetaPeriodo(tipo, ancla)}</b>
          <button type="button" className={estilos.boton} onClick={() => setAncla(moverPeriodo(tipo, ancla, 1))}>Siguiente</button>
          {!(hoy >= rango.desde && hoy <= rango.hasta) && <button type="button" className={estilos.boton} onClick={() => setAncla(hoy)}>Hoy</button>}
        </div>
      </div>

      {frente && (
        <p className={estilos.filtro} role="note">
          <Chip frente={frente} tamano="sm">{nombreFrenteActivo(frente)}</Chip>
          <span>El filtro de frente solo afecta a <b>Balance</b>: los compromisos y los hábitos no están asociados a un frente de diseño, así que Ejecución y Bienestar muestran todo.</span>
          <button type="button" className={estilos.boton} onClick={quitar}>Ver todos los frentes</button>
        </p>
      )}

      {cargando && !datos ? <Skeleton variante="bloque" alto={240} etiqueta="Calculando indicadores" />
        : error?.codigo === 'fase3_no_disponible' ? <NoDisponible error={error} />
        : error ? <ErrorState titulo="No se pudieron calcular los indicadores" mensaje={error.mensaje} onReintentar={recargar} />
        : <Indicadores datos={datos} />}
    </div>
  );
}

/** Explicación técnica plegada: no se pierde nada, pero deja de estar siempre a la vista. */
function Como({ children }) {
  return (
    <details className={estilos.como}>
      <summary>¿Cómo se calcula?</summary>
      <p className={estilos.nota}>{children}</p>
    </details>
  );
}

function Indicadores({ datos }) {
  const { lifePulse: lp, sinHistorial } = datos;
  const e = lp.execution; const b = lp.balance; const w = lp.wellbeing;
  return (
    <>
      {lp.futuro && <p className={estilos.nota} role="note">Este período aún no empieza: los días futuros no se contabilizan.</p>}
      {lp.enCurso && <p className={estilos.nota} role="note">Período en curso: solo cuentan los días y obligaciones que ya llegaron (el día de hoy incluido). Los tres indicadores son independientes: no se combinan en un puntaje global.</p>}
      {sinHistorial > 0 && <p className={estilos.nota} role="alert">{sinHistorial} compromiso(s) no tienen instantánea de creación en el historial y no se pudieron evaluar.</p>}
      <div className={estilos.grid}>
        <Card as="section" id="lp-execution" titulo="Ejecución" icono="check" accion={estadoChip(e, textoEstado('execution', e))}>
          <div className={estilos.anillo}><Ring valor={fraccion(e)} etiqueta="Ejecución" tono="primario" tamano={128}>{e.valor === null ? '—' : pct(e.valor)}</Ring></div>
          <ul className={estilos.detalle}>
            <li>Compromisos: <b>{e.T.valor === null ? 'sin información' : `${pct(e.T.valor)} (peso ${e.T.pesoCompletado} de ${e.T.pesoProgramado})`}</b></li>
            <li>Hitos: <b>{e.M.valor === null ? 'sin información' : `${pct(e.M.valor)} (peso ${e.M.pesoCompletado} de ${e.M.pesoProgramado})`}</b></li>
          </ul>
          {e.provisional && <p className={estilos.provisional} role="note">Incluye {e.T.provisionales + e.M.provisionales} obligación(es) que vencen hoy: cuentan como no cumplidas de forma provisional y se consolidan al cierre del día.</p>}
          <p className={estilos.linea}>Compromisos e hitos que ya vencieron; pesan más los de mayor prioridad.</p>
          <Como>E = 0,6 × compromisos + 0,4 × hitos, con peso 3/2/1 según la prioridad vigente al cierre del día de vencimiento. Lo que vence hoy entra desde el inicio del día. Sin fecha límite no cuenta. Las sesiones de Focus no intervienen.</Como>
        </Card>

        <Card as="section" id="lp-balance" titulo={lp.frenteId ? `Balance · ${nombreFrenteActivo(lp.frenteId)}` : 'Balance'} icono="chart" accion={estadoChip(b, textoEstado('balance', b))}>
          <div className={estilos.anillo}><Ring valor={fraccion(b)} etiqueta="Balance" tono="primario" tamano={128}>{b.valor === null ? '—' : pct(b.valor)}</Ring></div>
          {b.estado === 'no_iniciado' ? <p className={estilos.nota}>Aún no hay días transcurridos en este período.</p> : (
            <ul className={estilos.detalle}>
              {b.frentes.filter(f => f.objetivo > 0 || f.puntos > 0).map(f => (
                <li key={f.id}>{f.nombre}: <b>{f.puntos} {f.puntos === 1 ? 'punto' : 'puntos'}{f.objetivo > 0 ? ` de ${Number.isInteger(f.objetivo) ? f.objetivo : f.objetivo.toFixed(1)}` : ' (sin objetivo)'}</b></li>
              ))}
              {b.puntosTotales === 0 && b.estado !== 'ok' && <li>Sin puntos registrados.</li>}
            </ul>
          )}
          <p className={estilos.linea}>Puntos de Focus frente a tu objetivo semanal.{b.estado === 'sin_objetivo' ? ' No hay objetivos en este período.' : ''}</p>
          <Como>Puntos de sesiones de Focus completadas contra el objetivo semanal prorrateado. El exceso no compensa déficits.{b.estado === 'sin_objetivo' ? ' No hay objetivos en este período y no se heredan de otras semanas.' : ''}</Como>
          <div className={estilos.pie}><Link href="/atencion" className={estilos.enlace}>Objetivos</Link></div>
        </Card>

        <Card as="section" id="lp-wellbeing" titulo="Bienestar" icono="heart" accion={estadoChip(w, textoEstado('wellbeing', w))}>
          <div className={estilos.anillo}><Ring valor={fraccion(w)} etiqueta="Bienestar" tono="exito" tamano={128}>{w.valor === null ? '—' : pct(w.valor)}</Ring></div>
          {w.estado === 'ok' ? (
            <ul className={estilos.detalle}>
              <li>Tiempo: <b>{duracionLegible(w.realizadoS)} de {duracionLegible(w.objetivoS)}</b></li>
              <li>Ocurrencias que ya llegaron: <b>{w.ocurrencias}</b></li>
            </ul>
          ) : <p className={estilos.nota}>No hay ocurrencias de hábitos que ya hayan llegado en este período.</p>}
          <p className={estilos.linea}>Tiempo de tus hábitos frente a su duración objetivo.</p>
          <Como>Cumplimiento de la duración objetivo de tus hábitos, con tope del 100 % por ocurrencia; una ocurrencia sin tiempo cuenta como 0. No es un diagnóstico de salud.</Como>
          <div className={estilos.pie}><Link href="/habitos" className={estilos.enlace}>Hábitos</Link></div>
        </Card>
      </div>
    </>
  );
}

/** Resumen compacto del día para Mi día: los tres indicadores de hoy, sin combinarlos. */
export function LifePulseResumen({ cargador = null }) {
  const hoy = fechaBogota();
  const { cargando, error, datos } = useLifePulse({ tipo: 'dia', ancla: hoy, cargador });
  if (cargando && !datos) return <Skeleton variante="bloque" alto={96} etiqueta="Calculando Life Pulse" />;
  if (error?.codigo === 'fase3_no_disponible') return null;      // Mi día sigue igual hasta que la Fase 3 exista en la base
  if (error) return <ErrorState compacto titulo="Life Pulse no está disponible" mensaje={error.mensaje} />;
  const { execution: e, balance: b, wellbeing: w } = datos.lifePulse;
  return (
    <Card as="section" id="lp-resumen" titulo="Life Pulse de hoy" icono="sparkles" accion={<Link href="/life-pulse">Ver detalle</Link>}>
      <div className={estilos.resumen}>
        {[['Execution', e, 'primario'], ['Balance', b, 'primario'], ['Wellbeing', w, 'exito']].map(([n, ind, tono]) => (
          <div key={n} className={estilos.mini}>
            <Ring valor={fraccion(ind)} etiqueta={NOMBRE_INDICADOR[n]} tono={tono} tamano={72} grosor={8}>{ind.valor === null ? '—' : pct(ind.valor)}</Ring>
            <b>{NOMBRE_INDICADOR[n]}</b><span>{textoEstado(n, ind)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
