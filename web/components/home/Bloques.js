import Link from 'next/link';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Icon from '@/components/ui/Icon';
import ProgressBar from '@/components/ui/ProgressBar';
import { saludo } from '@/lib/domain/fechas';
import { TIPOS_ALERTA, REGLAS_VIGILADAS } from '@/lib/domain/alertas';
import { vistaMapa } from '@/lib/domain/mapaFrentes';
import { EXPLICACION_FASE3 } from '@/lib/domain/estadosHome';
import { TIPOS_ACTIVIDAD, cuandoLegible } from '@/lib/domain/actividad';
import { cop } from '@/lib/format';
import BloqueEstado from './BloqueEstado';
import EstadoFuente from './EstadoFuente';
import estilos from './Home.module.css';

const pct = v => `${Math.round(v * 100)} %`;
const pts = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// ---------------------------------------------------------------- A. Encabezado inteligente
export function Encabezado({ fechaLarga, hora, resumenEstado, resumenTexto, alerta }) {
  return (
    <header className={estilos.encabezado}>
      <div className={estilos.encabezadoTexto}>
        <div className="date">{fechaLarga}</div>
        <h1>Home</h1>
        <p className={estilos.saludo}>{saludo(hora)}, Lu.</p>
        {resumenEstado.estado === 'datos' && <p className={estilos.resumenDia}>{resumenTexto}</p>}
      </div>
      {alerta && (
        <Link href={alerta.accion.ruta} className={estilos.alertaDestacada} data-tipo={alerta.tipo}>
          <span className={estilos.alertaEtiqueta}>{TIPOS_ALERTA[alerta.tipo]}</span>
          <b>{alerta.titulo}</b>
          <span>{alerta.motivo}</span>
        </Link>
      )}
    </header>
  );
}

/** Explicación general de la Fase 3: se muestra UNA sola vez; cada módulo solo conserva su estado corto. */
export function NotaFase3() {
  return (
    <p className={estilos.notaGeneral} role="note" data-estado="fase3_no_activada">
      <Icon name="info" size={16} />
      <span><b>Fase 3 aún no activada.</b> {EXPLICACION_FASE3}</span>
    </p>
  );
}

// ---------------------------------------------------------------- F. Próximas acciones
export function ProximasAcciones({ alertas }) {
  return (
    <Card as="section" id="home-proximas" titulo="Próximas acciones" icono="sparkles" className={estilos.bloque}
      accion={<Chip tono="neutro" tamano="sm">Alertas automáticas</Chip>}>
      {alertas.estado === 'error_lectura' && <BloqueEstado estado="error_lectura" detalle={`No se pudo leer: ${alertas.fuentesConError.join(', ')}. No significa que no haya nada que atender.`} />}
      {alertas.estado === 'sin_registros' && (
        <div className={estilos.sinAlertas}>
          <p className={estilos.okLinea}><span className={estilos.icoTile} data-tipo="ok" aria-hidden="true"><Icon name="check" size={18} /></span><b>Nada requiere tu atención ahora.</b></p>
          <p className={estilos.nota}>Se vigilan:</p>
          <ul className={estilos.vigiladas}>{REGLAS_VIGILADAS.map(r => <li key={r.id}><Chip tono="neutro" tamano="sm">{r.texto}</Chip></li>)}</ul>
        </div>
      )}
      {alertas.estado === 'datos' && (
        <ol className={estilos.acciones}>
          {alertas.proximas.map(a => (
            <li key={a.id} data-tipo={a.tipo}>
              <div className={estilos.accionCabecera}>
                <span className={estilos.icoTile} data-tipo={a.tipo} aria-hidden="true"><Icon name={a.tipo === 'alerta' ? 'alert' : a.tipo === 'oportunidad' ? 'sparkles' : 'bolt'} size={18} /></span>
                <Chip tono={a.tipo === 'alerta' ? 'advertencia' : a.tipo === 'oportunidad' ? 'exito' : 'primario'} tamano="sm">{TIPOS_ALERTA[a.tipo]}</Chip>
                <b>{a.titulo}</b>
              </div>
              <p className={estilos.motivo}>{a.motivo}</p>
              {a.evidencia.map((e, i) => <p key={i} className={estilos.evidencia}>{e}</p>)}
              <Link href={a.accion.ruta} className={estilos.enlace}>{a.accion.texto}</Link>
            </li>
          ))}
        </ol>
      )}
      {alertas.estado === 'datos' && alertas.fuentesConError.length > 0 && <BloqueEstado estado="error_lectura" compacto detalle={`No se pudo leer: ${alertas.fuentesConError.join(', ')}.`} />}
      <p className={estilos.nota}>Reglas con datos reales, no IA. El asistente con IA aún no está conectado.</p>
    </Card>
  );
}

// ---------------------------------------------------------------- Mapa de los seis frentes (pieza central)
const COLOR_FRENTE = { tanku: 'var(--ds-frente-tanku)', ticketcode: 'var(--ds-frente-ticketcode)', personal: 'var(--ds-frente-personal)', salud: 'var(--ds-frente-salud)', familia: 'var(--ds-frente-familia)', otros: 'var(--ds-frente-otros)' };
const SEGMENTO = { completados: 'var(--ds-success)', abiertos: 'var(--ds-primary)', vencidos: 'var(--ds-danger)' };
const color = id => COLOR_FRENTE[id] ?? 'var(--ds-border-strong)';

export function MapaFrentes({ mapa, errores, f3Estado, filtroFrente }) {
  const v = vistaMapa(mapa);
  const errorBase = errores.includes('pendientes') || errores.includes('notas');
  const conAtencion = v.filas.filter(f => f.requiereAtencion.length > 0).length;
  return (
    <Card as="section" id="home-frentes" titulo="Mapa de los seis frentes" icono="chart" className={`${estilos.bloque} ${estilos.mapa}`}
      accion={<Link href="/atencion" className={estilos.enlaceAccion}>Objetivos</Link>}>
      {errorBase && <BloqueEstado estado="error_lectura" detalle={`No se pudo leer: ${['pendientes', 'notas'].filter(n => errores.includes(n)).join(', ')}.`} />}

      {mapa.concentracion.estado === 'datos' ? (
        <div className={estilos.concentracion}>
          <div className={estilos.apilada} role="img" aria-label={`Dónde se concentra la actividad de la semana: ${mapa.concentracion.partes.filter(p => p.registros > 0).map(p => `${p.nombre} ${p.registros}`).join(', ')}`}>
            {mapa.concentracion.partes.map(p => p.registros > 0 && <i key={p.id} style={{ width: `${p.proporcion * 100}%`, background: color(p.id) }} title={`${p.nombre}: ${p.registros}`} />)}
          </div>
          <p className={estilos.nota}>
            {mapa.concentracion.total} {mapa.concentracion.total === 1 ? 'registro' : 'registros'} esta semana ({mapa.semana.desde} a {mapa.semana.hasta}): pendientes completados, notas y sesiones de Focus. Son conteos, no un puntaje.
            {conAtencion > 0 ? ` ${conAtencion} ${conAtencion === 1 ? 'frente requiere' : 'frentes requieren'} atención.` : ''}
          </p>
        </div>
      ) : <p className={estilos.estado}><b>Sin registros</b> esta semana ({mapa.semana.desde} a {mapa.semana.hasta}): todavía no hay pendientes completados, notas ni sesiones de Focus.</p>}

      {!v.hayDatos ? (
        <ul className={estilos.frentesVacios} aria-label="Los seis frentes, sin registros">
          {v.filas.map(f => <li key={f.id}><Chip frente={f.id === 'sin-asignar' ? undefined : f.id} tamano="sm">{f.nombre}</Chip></li>)}
        </ul>
      ) : (
        <>
          <div className={estilos.cabeceraMapa} aria-hidden="true">
            <span>Frente</span><span>Actividad de la semana</span><span>Atención frente al objetivo</span><span>Pendientes</span>
          </div>
          <ul className={estilos.filasMapa}>
            {v.filas.map(f => (
              <li key={f.id} className={`${estilos.filaMapa} ${filtroFrente && filtroFrente !== f.id ? estilos.atenuado : ''}`} data-frente={f.id} data-atencion={f.requiereAtencion.length > 0 ? 'si' : 'no'}>
                <div className={estilos.celdaFrente}>
                  <Chip frente={f.id === 'sin-asignar' ? undefined : f.id} tamano="sm">{f.nombre}</Chip>
                  {f.requiereAtencion.length > 0 && <Chip tono="advertencia" tamano="sm" icono="alert">Requiere atención</Chip>}
                </div>
                {f.sinNingunDato ? <span className={estilos.celdaVacia}>Sin registros</span> : (
                  <>
                    <div className={estilos.celda} data-etiqueta="Actividad">
                      <span className={estilos.barra} aria-hidden="true"><i style={{ width: f.actividad.ancho ? `${Math.max(4, f.actividad.ancho * 100)}%` : '0%', background: color(f.id) }} /></span>
                      <span className={estilos.cifra} title={`Pendientes completados ${f.actividad.desglose.pendientesCompletados}, notas ${f.actividad.desglose.notas}${f.actividad.desglose.sesionesFocus === null ? '' : `, sesiones de Focus ${f.actividad.desglose.sesionesFocus}`}`}>
                        {f.actividad.total} {f.actividad.total === 1 ? 'registro' : 'registros'}
                      </span>
                    </div>
                    <div className={estilos.celda} data-etiqueta="Atención">
                      {f.atencion.estado === 'objetivo' ? (
                        <>
                          <span className={estilos.barra} aria-hidden="true"><i style={{ width: `${Math.min(100, (f.atencion.cumplimiento ?? 0) * 100)}%`, background: color(f.id) }} /></span>
                          <span className={estilos.cifra}>{pts(f.atencion.puntos)} de {pts(f.atencion.objetivo)} pts</span>
                        </>
                      ) : <span className={estilos.celdaNula} title={f.atencion.estado === 'sin_objetivo' ? undefined : 'Fase 3 aún no activada'} aria-label={f.atencion.estado === 'sin_objetivo' ? undefined : 'Fase 3 aún no activada'}>{f.atencion.estado === 'sin_objetivo' ? 'Sin objetivo' : '—'}</span>}
                    </div>
                    <div className={estilos.celda} data-etiqueta="Pendientes">
                      {f.pendientes.total > 0 ? (
                        <>
                          <span className={estilos.segmentada} role="img" aria-label={`${f.pendientes.completados} completados, ${f.pendientes.abiertos - f.pendientes.vencidos} abiertos, ${f.pendientes.vencidos} vencidos`}>
                            {f.pendientes.segmentos.map(s => <i key={s.clave} style={{ width: `${s.proporcion * 100}%`, background: SEGMENTO[s.clave] }} />)}
                          </span>
                          <span className={estilos.cifra}>{f.pendientes.abiertos} abiertos{f.pendientes.vencidos ? <b className={estilos.vencido}> · {f.pendientes.vencidos} vencidos</b> : ''} · {f.pendientes.completados} hechos</span>
                        </>
                      ) : <span className={estilos.celdaNula}>Sin pendientes</span>}
                    </div>
                  </>
                )}
                {f.requiereAtencion.map(r => <p key={r.regla} className={estilos.motivoAtencion}><b>Motivo:</b> {r.motivo}</p>)}
              </li>
            ))}
          </ul>
          <p className={estilos.leyendaMapa} aria-hidden="true">
            <span><i style={{ background: SEGMENTO.completados }} /> Completados</span><span><i style={{ background: SEGMENTO.abiertos }} /> Abiertos</span><span><i style={{ background: SEGMENTO.vencidos }} /> Vencidos</span>
          </p>
        </>
      )}
      {f3Estado !== 'ok' && f3Estado !== 'cargando' && f3Estado !== 'fase3_no_activada' && <BloqueEstado estado={f3Estado} compacto />}
      {f3Estado === 'fase3_no_activada' && <BloqueEstado estado="fase3_no_activada" corto detalle="Se activa con la migración v1.11: aquí aparecerá la atención frente al objetivo y las reglas 3 y 4." />}
    </Card>
  );
}

// ---------------------------------------------------------------- D. Resumen ejecutivo
function Kpi({ etiqueta, valor, detalle, estado, enlace }) {
  return (
    <li className={estilos.kpi} data-estado={estado}>
      <span className={estilos.kpiEtiqueta}>{etiqueta}</span>
      {estado === 'datos' ? <b className={estilos.kpiValor}>{valor}</b> : <b className={estilos.kpiEstado}>{estado === 'error_lectura' ? 'Error de lectura' : estado === 'sin_datos' ? 'Sin datos' : 'Sin registros'}</b>}
      {detalle && estado === 'datos' && <span className={estilos.kpiDetalle}>{detalle}</span>}
      {enlace && <Link href={enlace.ruta} className={estilos.kpiEnlace}>{enlace.texto}</Link>}
    </li>
  );
}

export function ResumenEjecutivo({ pend, metas, gastos, jornada, habitos, errores }) {
  const est = (nombre, e) => (errores.includes(nombre) ? 'error_lectura' : e);
  return (
    <Card as="section" id="home-resumen" titulo="Resumen ejecutivo" icono="home" className={estilos.bloque} accion={<Link href="/panel" className={estilos.enlaceAccion}>Ver Panel</Link>}>
      <ul className={estilos.kpis}>
        <Kpi etiqueta="Pendientes" estado={est('pendientes', pend.estado)} valor={`${pend.abiertos} abiertos`} detalle={`${pend.completados} completados · ${pend.completados7} en 7 días${pend.vencidos ? ` · ${pend.vencidos} vencidos` : ''}`} enlace={{ ruta: '/', texto: 'Ver' }} />
        <Kpi etiqueta="Avance de metas" estado={est('metas', metas.estado)} valor={metas.avance === null ? '' : pct(metas.avance)} detalle={`${metas.hechos} de ${metas.total} · ${metas.activas} ${metas.activas === 1 ? 'meta activa' : 'metas activas'}`} enlace={{ ruta: '/metas', texto: 'Metas' }} />
        <Kpi etiqueta="Gastos del mes" estado={est('gastos', gastos.estado)} valor={cop(gastos.total)} detalle={gastos.usado === null ? 'Sin presupuesto definido' : `${pct(gastos.usado)} del presupuesto · disponible ${cop(gastos.disponible)}`} enlace={{ ruta: '/finanzas', texto: 'Finanzas' }} />
        <Kpi etiqueta="Jornada" estado={est('jornadas', jornada.estado)} valor={`Racha de ${jornada.racha} ${jornada.racha === 1 ? 'día' : 'días'}`} detalle={`${jornada.diasSemana} ${jornada.diasSemana === 1 ? 'día' : 'días'} esta semana${jornada.hoyEscrita ? ' · hoy escrita' : ''}`} enlace={{ ruta: '/jornada', texto: 'Jornada' }} />
        <Kpi etiqueta="Hábitos de hoy" estado={est('habitos', habitos.estado)} valor={`${habitos.hechosHoy} de ${habitos.total}`} detalle={`Mejor racha: ${habitos.mejorRacha} ${habitos.mejorRacha === 1 ? 'día' : 'días'} (Salud)`} enlace={{ ruta: '/salud', texto: 'Salud' }} />
      </ul>
      {pend.estado === 'datos' && pend.avance !== null && <ProgressBar valor={pend.avance} etiqueta="Avance de pendientes" tono="exito" mostrarValor tamano="sm" />}
      <p className={estilos.nota}>Los valores sin información se muestran como «Sin datos» o «Sin registros», nunca como 0. El análisis detallado e histórico está en Panel.</p>
    </Card>
  );
}

// ---------------------------------------------------------------- Franja de fuentes
export function FranjaFuentes({ estados }) {
  return (
    <section className={estilos.franja} aria-label="Fuentes de datos">
      <b>Fuentes</b>
      <ul>
        {estados.map(e => (
          <li key={e.fuente.id} data-estado={e.estado}>
            {e.estado === 'datos' ? <Chip tono={e.vencida ? 'advertencia' : 'exito'} tamano="sm">{e.fuente.nombre}: con datos{e.vencida ? ' (desactualizada)' : ''}</Chip>
              : e.estado === 'no_conectada' ? <Chip tono="advertencia" tamano="sm" icono="alert">{e.fuente.nombre}: fuente no conectada</Chip>
              : e.estado === 'desactualizada' ? <Chip tono="advertencia" tamano="sm" icono="alert">{e.fuente.nombre}: desactualizada</Chip>
              : e.estado === 'sin_registros' ? <Chip tono="neutro" tamano="sm">{e.fuente.nombre}: sin registros</Chip>
              : <Chip tono="peligro" tamano="sm" icono="alert">{e.fuente.nombre}: error de lectura</Chip>}
            {e.nota && <span className={estilos.nota}> {e.nota}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Actividad reciente
export function ActividadReciente({ items, ahoraMs }) {
  return items.length ? (
    <ul className={estilos.actividad}>
      {items.map(a => (
        <li key={a.clave}><span className={estilos.actividadTipo}>{TIPOS_ACTIVIDAD[a.tipo].etiqueta}</span> <span className={estilos.nota}>· {cuandoLegible(a.cuando, ahoraMs)}</span><div>{a.titulo}</div></li>
      ))}
    </ul>
  ) : <BloqueEstado estado="sin_registros" compacto detalle="Aparecerá aquí cuando completes pendientes o guardes notas, biblioteca o jornadas." />;
}

export { EstadoFuente };
