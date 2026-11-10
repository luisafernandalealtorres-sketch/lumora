'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ProgressBar from '@/components/ui/ProgressBar';
import Skeleton from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import { crearServicioHabitos } from '@/lib/data/habitos';
import { ejecutar } from '@/lib/data/temporizador';
import { useFrenteActivo } from '@/components/shell/useFrenteActivo';
import { nombreFrenteActivo } from '@/lib/domain/frenteActivo';
import { fechaBogota, sumarDias } from '@/lib/domain/fechas';
import { traducirError } from '@/lib/domain/temporizador';
import { FRENTES_ATENCION, balanceSemana, lunesDe, objetivosPorSemana, semanaCerrada } from '@/lib/domain/atencion';
import estilos from '@/components/timer/Timer.module.css';

const fmt = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const rango = lunes => {
  const f = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${f(lunes)} – ${f(sumarDias(lunes, 6))}`;
};

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
  if (cargando) return <Skeleton variante="bloque" alto={220} etiqueta="Cargando objetivos y balance" />;
  if (error?.codigo === 'fase3_no_disponible') {
    return (
      <Card as="section" id="atencion-no-disponible" titulo="Atención aún no está activada" icono="alert">
        <p>{error.mensaje}</p>
        <p className={estilos.nota}>La interfaz está lista, pero las tablas de objetivos y sesiones de la Fase 3 todavía no existen en la base de datos. No se guarda nada mientras tanto.</p>
      </Card>
    );
  }
  if (error) return <ErrorState titulo="No se pudo leer la atención" mensaje={error.mensaje} onReintentar={cargar} />;

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

  return (
    <div className={estilos.pagina}>
      {aviso && (
        <div className={`${estilos.aviso} ${aviso.ok ? '' : estilos.avisoError}`} role={aviso.ok ? 'status' : 'alert'}>
          <span>{aviso.texto}</span>
          <button type="button" className={estilos.boton} onClick={() => setAviso(null)}>Cerrar</button>
        </div>
      )}

      <div className={estilos.controles} role="group" aria-label="Semana">
        <button type="button" className={estilos.boton} onClick={() => setLunes(sumarDias(lunes, -7))} disabled={lunes <= sumarDias(lunesActual, -84)}>Semana anterior</button>
        <b>{rango(lunes)}</b>
        <button type="button" className={estilos.boton} onClick={() => setLunes(sumarDias(lunes, 7))} disabled={lunes >= sumarDias(lunesActual, 28)}>Semana siguiente</button>
        {lunes !== lunesActual && <button type="button" className={estilos.boton} onClick={() => setLunes(lunesActual)}>Esta semana</button>}
      </div>

      {frente && (
        <p className={estilos.aviso} role="note">
          <span>Balance filtrado por <Chip frente={frente} tamano="sm">{nombreFrenteActivo(frente)}</Chip>. Los objetivos de abajo siguen mostrando todos los frentes.</span>
          <button type="button" className={estilos.boton} onClick={quitar}>Ver todos</button>
        </p>
      )}

      <Card as="section" id="atencion-balance" titulo={frente ? `Balance · ${nombreFrenteActivo(frente)}` : "Balance de atención"} icono="chart"
        accion={balance.enCurso ? <Chip tono="advertencia" tamano="sm">En curso</Chip> : cerrada ? <Chip tono="neutro" tamano="sm">Semana cerrada</Chip> : <Chip tono="neutro" tamano="sm">Aún no empieza</Chip>}>
        {balance.estado === 'ok' && (
          <>
            <ProgressBar valor={balance.valor / 100} etiqueta="Balance de la semana" tono="primario" mostrarValor />
            <p className={estilos.nota}>{balance.enCurso ? `Se compara con el objetivo de los ${balance.diasElegibles} días transcurridos (incluye hoy).` : 'Se compara con el objetivo semanal completo.'} El exceso en un frente no compensa el déficit de otro.</p>
          </>
        )}
        {balance.estado === 'sin_objetivo' && <EmptyState compacto icono="target" titulo="Sin objetivo" descripcion={`No hay objetivos para esta semana: no se hereda ninguno de otras semanas. Puntos registrados: ${balance.puntosTotales}.`} />}
        {balance.estado === 'no_iniciado' && <EmptyState compacto icono="calendar" titulo="Esta semana aún no empieza" descripcion="Los días futuros no se contabilizan todavía." />}

        {balance.estado !== 'no_iniciado' && (
          <ul className={estilos.lista} aria-label="Puntos por frente">
            {balance.frentes.map(f => (
              <li key={f.id} className={estilos.item} style={{ display: 'grid' }}>
                <div className={estilos.fila}>
                  <Chip frente={f.id} tamano="sm">{f.nombre}</Chip>
                  <span>{f.puntos} {f.puntos === 1 ? 'punto' : 'puntos'}{f.objetivo > 0 ? ` de ${fmt(f.objetivo)}` : ''}</span>
                </div>
                {f.cumplimiento !== null
                  ? <ProgressBar valor={f.cumplimiento} etiqueta={`Cumplimiento de ${f.nombre}`} tono={f.id} mostrarValor tamano="sm" />
                  : <p className={estilos.nota}>Sin objetivo: no cuenta en el balance ni se penaliza.</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ObjetivosForm key={`${lunes}-${objetivos.length}`} cerrada={cerrada} rango={rango(lunes)} objetivos={objetivosSemana} ocupado={ocupado} onGuardar={guardar} />
    </div>
  );
}

function ObjetivosForm({ cerrada, rango: r, objetivos, ocupado, onGuardar }) {
  const [v, setV] = useState(() => Object.fromEntries(FRENTES_ATENCION.map(f => [f.id, objetivos[f.id] === undefined ? '' : String(objetivos[f.id])])));
  return (
    <Card as="section" id="atencion-objetivos" titulo={`Objetivos de la semana ${r}`} icono="target">
      {cerrada && <p className={estilos.nota} role="note">Esta semana ya terminó: sus objetivos son inmutables (la base de datos los protege).</p>}
      <form className={estilos.form} onSubmit={e => { e.preventDefault(); onGuardar(v); }}>
        <div className={estilos.dos}>
          {FRENTES_ATENCION.map(f => (
            <label key={f.id} className={estilos.campo}>{f.nombre} (puntos)
              <input type="number" inputMode="numeric" min="0" step="1" value={v[f.id]} disabled={cerrada} placeholder="Sin objetivo"
                onChange={e => setV({ ...v, [f.id]: e.target.value })} />
            </label>
          ))}
        </div>
        <p className={estilos.nota}>Un punto = una sesión de Focus completada. Deja un frente vacío para no fijarle objetivo. Los hábitos no suman puntos.</p>
        {!cerrada && <button type="submit" className={`${estilos.boton} ${estilos.primario}`} disabled={ocupado}>Guardar objetivos</button>}
      </form>
    </Card>
  );
}
