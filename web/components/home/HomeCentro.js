'use client';
import { useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import ErrorState from '@/components/ui/ErrorState';
import ProgressBar from '@/components/ui/ProgressBar';
import Ring from '@/components/ui/Ring';
import Skeleton from '@/components/ui/Skeleton';
import { FRENTES_DISENO } from '@/lib/domain/frentesMap';
import { MODALIDADES, ETIQUETA_TIPO, formatoReloj } from '@/lib/domain/temporizador';
import { fraccion, textoEstado } from '@/lib/domain/lifePulse';
import { useTemporizador } from '@/components/timer/TemporizadorProvider';
import Controles from '@/components/timer/Controles';
import timer from '@/components/timer/Timer.module.css';
import BloqueEstado from './BloqueEstado';
import estilos from './Home.module.css';

const pct = v => `${Math.round(v)} %`;

// Focus (principal) y Life Pulse: los dos protagonistas de Home. Datos reales; si la Fase 3 no está activada lo dicen con su estado propio.
export function BloqueFocus() {
  const t = useTemporizador();
  const [modalidad, setModalidad] = useState('productivity');
  const [frenteId, setFrenteId] = useState('');
  const { cargando, noDisponible, datos, inst, lectura, prefs, sugerido, ocupado, error } = t;

  if (noDisponible) {
    return (
      <Card as="section" id="home-focus" titulo="Focus" icono="bolt" className={`${estilos.bloque} ${estilos.principal}`}>
        <BloqueEstado estado="fase3_no_activada" corto />
        <Link href="/focus" className={timer.boton}>Abrir Focus</Link>
      </Card>
    );
  }
  if (cargando && !datos) return <Skeleton variante="bloque" alto={220} etiqueta="Cargando Focus" />;
  if (error && !datos) return <ErrorState compacto titulo="Error de lectura en Focus" mensaje={error.mensaje} onReintentar={() => t.recargar()} />;

  if (inst && !inst.incompleto && lectura) {
    // Sesión activa: el temporizador es el protagonista de Home (reloj grande, sesión, avance y controles).
    const cuenta = inst.cuentaAtras && lectura.restanteS !== null;
    const valor = cuenta ? lectura.restanteS : lectura.transcurridoS;
    const frenteNombre = inst.frenteId ? (FRENTES_DISENO.find(x => x.id === inst.frenteId)?.nombre ?? inst.frenteId) : null;
    const modalidadNombre = inst.tipo === 'focus' ? (inst.modalidad === 'productivity' ? 'Productivity' : 'Enjoyment') : null;
    const intencion = inst.registro?.intencion ?? null;
    return (
      <Card as="section" id="home-focus" titulo={ETIQUETA_TIPO[inst.tipo] + (inst.pausado ? ' en pausa' : ' en curso')} icono="bolt"
        className={`${estilos.bloque} ${estilos.principal} ${estilos.focusActivo} ${inst.pausado ? estilos.focusPausa : ''}`}
        accion={<Chip tono={inst.pausado ? 'advertencia' : 'primario'} tamano="sm">{inst.pausado ? 'En pausa' : 'Corriendo'}</Chip>}>
        <div className={estilos.relojGrande} role="timer" aria-label={`${cuenta ? 'Tiempo restante' : 'Tiempo transcurrido'} ${formatoReloj(valor)}`}>{formatoReloj(valor)}</div>
        <p className={estilos.sesion}>
          <b>{inst.titulo ?? ETIQUETA_TIPO[inst.tipo]}</b>
          {(modalidadNombre || frenteNombre) && <span>{[modalidadNombre, frenteNombre].filter(Boolean).join(' · ')}</span>}
          {intencion && <span>{intencion}</span>}
        </p>
        {inst.objetivoS !== null && <ProgressBar valor={lectura.progreso} etiqueta="Avance hacia la meta" tono={lectura.meta ? 'exito' : 'primario'} mostrarValor />}
        {inst.objetivoS !== null && lectura.meta && <p className={estilos.nota}>Meta alcanzada{lectura.excedidoS > 0 ? ` (+${formatoReloj(lectura.excedidoS)} de más)` : ''}. {inst.tipo === 'focus' ? 'Completa la sesión para registrar el punto.' : 'Ciérralo cuando quieras.'}</p>}
        <Controles />
        <Link href="/focus" className={estilos.enlace}>Abrir Focus completo</Link>
      </Card>
    );
  }

  return (
    <Card as="section" id="home-focus" titulo="Focus" icono="bolt" className={`${estilos.bloque} ${estilos.principal}`}>
      {sugerido && <p className={estilos.nota}>Descanso {sugerido.tipo} sugerido tras tu última sesión. <Link href="/focus">Decidir</Link></p>}
      <form className={timer.form} onSubmit={e => { e.preventDefault(); if (frenteId) t.focusIniciar({ modalidad, frenteId }); }}>
        <fieldset className={timer.campo}>
          <legend>Modalidad</legend>
          <div className={timer.radios}>
            {MODALIDADES.map(m => (
              <label key={m.id} className={timer.radio}>
                <input type="radio" name="home-modalidad" value={m.id} checked={modalidad === m.id} onChange={() => setModalidad(m.id)} /> {m.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={timer.campo}>Frente
          <select value={frenteId} onChange={e => setFrenteId(e.target.value)} required>
            <option value="" disabled>Elige un frente…</option>
            {FRENTES_DISENO.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </label>
        <button type="submit" className={`${timer.boton} ${timer.primario} ${timer.grande}`} disabled={ocupado || !frenteId}>Iniciar Focus de {prefs.focus_min} min</button>
      </form>
    </Card>
  );
}

export function BloqueLifePulse({ f3 }) {
  if (f3.estado === 'cargando') return <Skeleton variante="bloque" alto={220} etiqueta="Calculando Life Pulse" />;
  if (f3.estado !== 'ok') {
    return (
      <Card as="section" id="home-lifepulse" titulo="Life Pulse" icono="sparkles" className={estilos.bloque} accion={<Link href="/life-pulse" className={estilos.enlaceAccion}>Análisis completo</Link>}>
        <BloqueEstado estado={f3.estado} corto={f3.estado === 'fase3_no_activada'} detalle={f3.estado === 'error_lectura' ? f3.error?.mensaje : undefined} />
      </Card>
    );
  }
  const dia = f3.dia;
  return (
    <Card as="section" id="home-lifepulse" titulo="Life Pulse de hoy" icono="sparkles" className={estilos.bloque} accion={<Link href="/life-pulse" className={estilos.enlaceAccion}>Análisis completo</Link>}>
      <div className={estilos.anillos}>
        {[['Execution', dia.execution], ['Balance', dia.balance], ['Wellbeing', dia.wellbeing]].map(([n, ind]) => (
          <div key={n} className={estilos.anillo}>
            <Ring valor={fraccion(ind)} etiqueta={n} tono={n === 'Wellbeing' ? 'exito' : 'primario'} tamano={84} grosor={9}>{ind.valor === null ? '—' : pct(ind.valor)}</Ring>
            <b>{n}</b><span>{textoEstado(n, ind)}</span>
          </div>
        ))}
      </div>
      <p className={estilos.nota}>Tres indicadores independientes: no se combinan en un puntaje global.</p>
    </Card>
  );
}
