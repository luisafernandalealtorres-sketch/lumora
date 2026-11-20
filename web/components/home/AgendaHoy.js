import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { esTodoElDia } from '@/lib/domain/agenda';
import BloqueEstado from './BloqueEstado';
import estilos from './Home.module.css';

const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

function Eventos({ eventos }) {
  return (
    <ul className={estilos.agenda}>
      {eventos.map(e => (
        <li key={e.id}>
          <span className={estilos.agendaHora}>{esTodoElDia(e) ? 'Todo el día' : hora(e.inicio)}</span>
          <span className={estilos.agendaTitulo}>
            {e.titulo}
            {e.frente_id ? <Chip frente={e.frente_id} tamano="sm" /> : <Chip tono="neutro" tamano="sm">Sin asignar</Chip>}
          </span>
          {e.detalle && <p className={estilos.agendaDetalle}>{e.detalle}</p>}
        </li>
      ))}
    </ul>
  );
}

// Agenda de hoy: tarjeta propia, solo agenda. Los estados son honestos (ver lib/domain/agenda.js):
// con datos, día libre real, desactualizada, no conectada o error. «Mañana» es plegable.
//   hoy / manana: eventos ya ordenados · info: resultado de estadoAgenda · nota: texto de sincronización
export default function AgendaHoy({ hoy, manana, info, nota }) {
  const n = hoy.length;
  return (
    <Card as="section" id="home-agenda" titulo="Agenda de hoy" icono="calendar" className={estilos.bloque}
      accion={info.estado === 'datos' ? <Chip tono="neutro" tamano="sm">{n} {n === 1 ? 'evento' : 'eventos'}</Chip> : null}>
      {info.estado === 'error' ? <BloqueEstado estado="error_lectura" detalle="No se pudo leer la agenda." />
        : info.estado === 'no_conectada' ? <BloqueEstado estado="no_conectada" detalle="Ningún calendario se ha sincronizado todavía. Esto no significa que no tengas eventos." />
        : info.estado === 'desactualizada' ? <BloqueEstado estado="no_conectada" detalle="La última sincronización es vieja, así que no sabemos si hoy tienes eventos." />
        : info.estado === 'sin_registros' ? <p className={estilos.nota}>Día libre: sin eventos en los calendarios sincronizados.</p>
        : <Eventos eventos={hoy} />}

      {info.estado === 'datos' && info.vencida && <p className={estilos.nota} role="note">Esta agenda puede estar desactualizada.</p>}

      {manana.length > 0 && info.estado !== 'error' && (
        <details className={estilos.plegable}>
          <summary>Mañana ({manana.length})</summary>
          <Eventos eventos={manana} />
        </details>
      )}

      {nota && <p className={estilos.nota}>{nota}</p>}
    </Card>
  );
}
