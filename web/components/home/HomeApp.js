'use client';
import { useMemo } from 'react';
import { esNegocio } from '@/lib/format';
import { FUENTES_HOME, estadoFuente } from '@/lib/domain/fuentes';
import { estadoAgenda, haceCuanto, eventosDeHoy } from '@/lib/domain/agenda';
import { resumenPendientes, prioridadesHoy, avanceMetas, resumenGastos, resumenJornada, resumenHabitosSalud, recurrentesProximos } from '@/lib/domain/resumen';
import { mapaFrentes } from '@/lib/domain/mapaFrentes';
import { generarAlertas } from '@/lib/domain/alertas';
import { actividadReciente } from '@/lib/domain/actividad';
import { useFase3Home } from './useFase3Home';
import { BloqueFocus, BloqueLifePulse } from './HomeCentro';
import { Encabezado, ProximasAcciones, MapaFrentes, ResumenEjecutivo, FranjaFuentes, NotaFase3 } from './Bloques';
import HoyPrioridades from './HoyPrioridades';
import AccesosRapidos from './AccesosRapidos';
import estilos from './Home.module.css';

// Home, centro de control (diseño aprobado 05_HOME_CENTRO_DE_CONTROL). Recibe los datos heredados ya leídos en el servidor
// (con la lista de fuentes que fallaron) y carga aparte los de la Fase 3. Toda cifra sale de funciones puras con pruebas.
export default function HomeApp({ datos, errores, frentes }) {
  const f3 = useFase3Home();
  const { hoy, hora, fechaLarga, ahoraMs } = datos;
  const err = nombre => errores.includes(nombre);

  const calc = useMemo(() => {
    const pend = datos.pendientes ?? [];
    const resumenPend = resumenPendientes({ pendientes: pend, hoy });
    const prioridades = prioridadesHoy({ pendientes: pend, hoy, limite: 5 });
    const metas = avanceMetas({ metas: datos.metas ?? [], hitos: datos.hitos ?? [], pendientes: pend });
    const gastos = resumenGastos({ gastos: datos.gastos ?? [], presupuestos: datos.presupuestos ?? [], mes: hoy.slice(0, 7), esNegocio });
    const jornada = resumenJornada({ fechas: datos.jornadas ?? [], hoy });
    const habitos = resumenHabitosSalud({ habitos: datos.habitos ?? [], registros: datos.registrosHabitos ?? [], hoy });
    const recurrentes = recurrentesProximos({ recurrentes: datos.recurrentes ?? [], hoy });
    const actividad = actividadReciente({ pendientes: pend, notas: datos.notas, biblioteca: datos.biblioteca, jornadas: datos.jornadas, limite: 8 });
    return { resumenPend, prioridades, metas, gastos, jornada, habitos, recurrentes, actividad };
  }, [datos, hoy]);

  const fase3Ok = f3.estado === 'ok';
  const mapa = useMemo(() => mapaFrentes({
    pendientes: err('pendientes') ? [] : datos.pendientes, notas: err('notas') ? [] : datos.notas, metas: err('metas') ? [] : datos.metas, hitos: err('hitos') ? [] : datos.hitos,
    gastos: err('gastos') ? [] : datos.gastos, sesiones: fase3Ok ? f3.sesiones : undefined, balance: fase3Ok ? f3.semana.balance : undefined, hoy, esNegocio,
  }), [datos, errores, fase3Ok, f3, hoy]); // eslint-disable-line react-hooks/exhaustive-deps

  const alertas = useMemo(() => generarAlertas({
    hoy, hora,
    pendientes: err('pendientes') ? undefined : datos.pendientes,
    metas: err('metas') || err('hitos') || err('pendientes') ? undefined : calc.metas,
    gastos: err('gastos') || err('presupuestos') ? undefined : calc.gastos,
    recurrentes: err('recurrentes') ? undefined : calc.recurrentes,
    jornada: err('jornadas') ? undefined : calc.jornada,
    mapa: err('pendientes') ? undefined : mapa,
    errores,
  }), [datos, calc, mapa, errores, hoy, hora]); // eslint-disable-line react-hooks/exhaustive-deps

  const conError = (fuente, filas, nombre) => estadoFuente({ fuente, filas, error: err(nombre) ? true : null });
  const estResumen = conError(FUENTES_HOME.resumen, datos.resumen, 'resumen');
  // Agenda: estado honesto según la última sincronización de los calendarios (ver lib/domain/agenda.js).
  const infoAgenda = estadoAgenda({ filas: datos.agenda, fuentes: datos.agendaFuentes, error: err('agenda') ? true : null, ahoraMs });
  const notaAgenda = [
    infoAgenda.ultima && infoAgenda.estado !== 'error' ? `sincronizada ${haceCuanto(infoAgenda.ultima, ahoraMs)}` : null,
    infoAgenda.pendientes.length ? `falta conectar: ${infoAgenda.pendientes.join(', ')}` : null,
    infoAgenda.conError.length ? `con error: ${infoAgenda.conError.join(', ')}` : null,
  ].filter(Boolean).join(' · ');
  const estAgenda = { ...infoAgenda, fuente: FUENTES_HOME.agenda, nota: notaAgenda };
  const fuentes = [estAgenda, conError(FUENTES_HOME.correos, datos.correos, 'correos'), estResumen];
  const alertaDestacada = alertas.items.find(a => a.tipo === 'alerta') ?? null;
  const erroresKpi = [
    ...(err('pendientes') ? ['pendientes'] : []), ...(err('metas') || err('hitos') ? ['metas'] : []),
    ...(err('gastos') || err('presupuestos') ? ['gastos'] : []), ...(err('jornadas') ? ['jornadas'] : []), ...(err('habitos') || err('registros_habitos') ? ['habitos'] : []),
  ];

  return (
    <div className={estilos.pagina}>
      <Encabezado fechaLarga={fechaLarga} hora={hora} resumenEstado={estResumen} resumenTexto={datos.resumen?.texto} alerta={alertaDestacada} />
      {f3.estado === 'fase3_no_activada' && <NotaFase3 />}
      <div className={estilos.rejilla}>
        <div className={estilos.aFocus}><BloqueFocus /></div>
        <div className={estilos.aPulso}><BloqueLifePulse f3={f3} /></div>
        <div className={estilos.aProximas}><ProximasAcciones alertas={alertas} /></div>
        <div className={estilos.aHoy}>
          <HoyPrioridades
            prioridades={calc.prioridades} resumen={calc.resumenPend} errorPendientes={err('pendientes')}
            frentes={frentes} pendientesInicial={datos.pendientes ?? []} metas={(datos.metas ?? []).filter(m => m.estado === 'activa')}
            agenda={infoAgenda.estado === 'datos' ? eventosDeHoy(datos.agenda) : []} agendaInfo={infoAgenda}
            correos={estadoFuente({ fuente: FUENTES_HOME.correos, filas: datos.correos }).estado === 'datos' ? datos.correos : []}
            actividad={calc.actividad} ahoraMs={ahoraMs}
          />
        </div>
        <div className={estilos.aMapa}><MapaFrentes mapa={mapa} errores={errores} f3Estado={f3.estado} filtroFrente={null} /></div>
        <div className={estilos.aResumen}>
          <ResumenEjecutivo pend={calc.resumenPend} metas={calc.metas} gastos={calc.gastos} jornada={calc.jornada} habitos={calc.habitos} errores={erroresKpi} />
        </div>
        <div className={estilos.aFuentes}><FranjaFuentes estados={fuentes} /></div>
        <div className={estilos.aAccesos}><AccesosRapidos frentes={frentes} hoy={hoy} /></div>
      </div>
    </div>
  );
}
