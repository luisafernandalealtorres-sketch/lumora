// Capa de datos del temporizador global: lee tablas y llama a las RPC del SQL v1.11 (etapas 2 y 3).
//
// - El cliente NO escribe en las tablas de temporizadores: solo lee (T-1, T-8c). Toda escritura pasa por una RPC.
// - Cada operación lleva un identificador único (`p_op_id`), el del dispositivo y una secuencia creciente (`p_seq`),
//   de modo que reintentar la misma operación es idempotente en el servidor.
// - Recibe el cliente de Supabase por parámetro (no lo crea) para poder probarse contra una base real local.
// - NO implementa la cola sin conexión ni `operaciones_aplicar` (etapa 4, pendiente de T-9).
import { traducirError } from '../domain/temporizador.js';
import { crearIdentidadDispositivo, crearLlamadorRpc, uuidAleatorio, unica } from './rpc.js';

export { crearIdentidadDispositivo };

/**
 * Servicio del temporizador. `supabase` es un cliente de @supabase/supabase-js (navegador) ya autenticado.
 */
export function crearServicio(supabase, { identidad, uuid = uuidAleatorio } = {}) {
  const ident = identidad ?? crearIdentidadDispositivo({ almacen: typeof window !== 'undefined' ? window.localStorage : null });

  const rpc = crearLlamadorRpc(supabase, ident, uuid);

  return {
    dispositivoId: () => ident.dispositivoId,

    /** Lee todo lo necesario para pintar el temporizador y las listas. Lanza el error de Supabase si algo falla. */
    async cargarEstado({ limiteSesiones = 60, limiteDescansos = 30 } = {}) {
      const [activo, prefs, sesiones, descansos] = await Promise.all([
        unica(supabase.from('temporizador_activo').select('*').maybeSingle()),
        unica(supabase.from('preferencias_usuario').select('*').maybeSingle()),
        unica(supabase.from('focus_sesiones').select('*').in('estado', ['completada', 'parcial', 'cancelada', 'en_curso', 'pausada'])
          .order('iniciado_en', { ascending: false }).limit(limiteSesiones)),
        unica(supabase.from('descansos').select('*').order('finalizado_en', { ascending: false, nullsFirst: true }).limit(limiteDescansos)),
      ]);
      const out = { activo, prefs, sesiones: sesiones ?? [], descansos: descansos ?? [], focus: null, descanso: null, habito: null, habitoConfig: null, objetivoHabitoS: null, segmentosHabito: [] };
      if (activo) {
        if (activo.tipo === 'focus') out.focus = out.sesiones.find(s => s.id === activo.ref_id) ?? await unica(supabase.from('focus_sesiones').select('*').eq('id', activo.ref_id).maybeSingle());
        else if (activo.tipo === 'descanso') out.descanso = out.descansos.find(d => d.id === activo.ref_id) ?? await unica(supabase.from('descansos').select('*').eq('id', activo.ref_id).maybeSingle());
        else if (activo.tipo === 'habito') {
          out.habito = await unica(supabase.from('habito_temporizadores').select('*').eq('id', activo.ref_id).maybeSingle());
          if (out.habito) {
            const [cfg, vers, segs] = await Promise.all([
              unica(supabase.from('habitos_config').select('*').eq('id', out.habito.habito_id).maybeSingle()),
              unica(supabase.from('habitos_config_versiones').select('*').eq('habito_id', out.habito.habito_id).order('vigente_desde', { ascending: false }).limit(1)),
              unica(supabase.from('habito_segmentos').select('*').eq('temporizador_id', out.habito.id)),
            ]);
            out.habitoConfig = cfg;
            out.objetivoHabitoS = vers?.[0]?.objetivo_s ?? null;
            out.segmentosHabito = (segs ?? []).filter(s => !s.reemplazado_en);
          }
        }
      }
      return out;
    },

    /** Hábitos que se pueden cronometrar (modo temporizador y no archivados). */
    async listarHabitosConTemporizador() {
      const filas = await unica(supabase.from('habitos_config').select('id,nombre,modo_registro,archivado_desde').eq('modo_registro', 'temporizador').order('creado_en'));
      return (filas ?? []).filter(h => !h.archivado_desde);
    },

    /** Pendientes abiertos para asociar a una sesión (tabla heredada, solo lectura). */
    async listarPendientesAbiertos() {
      const filas = await unica(supabase.from('pendientes').select('id,texto,frente,hecho').eq('hecho', false).order('creado_en').limit(100));
      return filas ?? [];
    },

    async guardarPreferencias(valores) {
      const permitido = ['focus_min', 'descanso_corto_min', 'descanso_largo_min', 'ciclos_para_largo', 'avisos', 'sonido'];
      const fila = {};
      for (const k of permitido) if (valores[k] !== undefined) fila[k] = valores[k];
      const { data: { user } } = await supabase.auth.getUser();
      const r = await supabase.from('preferencias_usuario').upsert({ user_id: user.id, ...fila }, { onConflict: 'user_id' }).select().single();
      if (r.error) throw r.error;
      return r.data;
    },

    // ---- Focus
    focusIniciar: ({ modalidad, frenteId, actividad = null, intencion = null, pendienteId = null }) =>
      rpc('focus_iniciar', { p_modalidad: modalidad, p_frente_id: frenteId, p_actividad: actividad, p_intencion: intencion, p_pendiente_id: pendienteId }),
    focusPausar: id => rpc('focus_pausar', { p_sesion_id: id }),
    focusReanudar: id => rpc('focus_reanudar', { p_sesion_id: id }),
    focusCompletar: id => rpc('focus_completar', { p_sesion_id: id }),
    focusCancelar: id => rpc('focus_cancelar', { p_sesion_id: id }),

    // ---- Descansos
    descansoIniciar: ({ tipo, sesionOrigenId = null }) => rpc('descanso_iniciar', { p_tipo: tipo, p_sesion_origen_id: sesionOrigenId }),
    descansoPausar: id => rpc('descanso_pausar', { p_descanso_id: id }),
    descansoReanudar: id => rpc('descanso_reanudar', { p_descanso_id: id }),
    descansoCompletar: id => rpc('descanso_completar', { p_descanso_id: id }),
    descansoOmitir: ({ tipo, sesionOrigenId = null }) => rpc('descanso_omitir', { p_tipo: tipo, p_sesion_origen_id: sesionOrigenId }),
    descansoCancelar: id => rpc('descanso_cancelar', { p_descanso_id: id }),

    // ---- Temporizador de hábitos
    habitoIniciar: habitoId => rpc('habito_timer_iniciar', { p_habito_id: habitoId }),
    habitoPausar: id => rpc('habito_timer_pausar', { p_temporizador_id: id }),
    habitoReanudar: id => rpc('habito_timer_reanudar', { p_temporizador_id: id }),
    habitoFinalizar: id => rpc('habito_timer_finalizar', { p_temporizador_id: id }),
    habitoCancelar: id => rpc('habito_timer_cancelar', { p_temporizador_id: id }),
  };
}

/** Ejecuta una acción del servicio y devuelve { ok, data } o { ok: false, error: {codigo, mensaje} }; nunca lanza. */
export async function ejecutar(accion) {
  try {
    return { ok: true, data: await accion() };
  } catch (e) {
    return { ok: false, error: traducirError(e) };
  }
}
