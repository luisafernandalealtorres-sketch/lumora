// Capa de datos de hábitos nuevos y objetivos de atención (SQL v1.11, etapa 3). No toca `habitos` ni `habito_registros` (Salud heredado).
// - Escrituras de hábitos y tiempo: solo por RPC (habito_crear, habito_programar, habito_archivar, habito_registrar_manual).
// - Renombrar un hábito es una actualización directa de la columna `nombre`, única editable por el cliente (T-8c).
// - Objetivos semanales: CRUD directo sobre objetivos_atencion; la base rechaza semanas pasadas (T-7, semana_cerrada).
import { crearIdentidadDispositivo, crearLlamadorRpc, uuidAleatorio, unica } from './rpc.js';
import { sumarDias } from '../domain/fechas.js';

const desdeISO = fecha => `${fecha}T00:00:00-05:00`;   // America/Bogota es UTC-5 todo el año

export function crearServicioHabitos(supabase, { identidad, uuid = uuidAleatorio } = {}) {
  const ident = identidad ?? crearIdentidadDispositivo({ almacen: typeof window !== 'undefined' ? window.localStorage : null });
  const rpc = crearLlamadorRpc(supabase, ident, uuid);
  const usuario = async () => (await supabase.auth.getUser()).data.user;

  return {
    /** Hábitos, todas sus programaciones y el tiempo registrado desde `desde` (fecha AAAA-MM-DD). */
    async cargarHabitos({ desde }) {
      const [habitos, versiones, tiempos] = await Promise.all([
        unica(supabase.from('habitos_config').select('*').order('creado_en')),
        unica(supabase.from('habitos_config_versiones').select('*').order('vigente_desde')),
        unica(supabase.from('habito_tiempo').select('*').gte('fecha', desde).order('fecha', { ascending: false })),
      ]);
      return { habitos: habitos ?? [], versiones: versiones ?? [], tiempos: tiempos ?? [] };
    },

    /** Historial de modificaciones del tiempo de una ocurrencia (nada se borra: cada cambio agrega una entrada). */
    async historial({ habitoId, fecha }) {
      return (await unica(supabase.from('habito_tiempo_historial').select('*').eq('habito_id', habitoId).eq('fecha', fecha).order('creado_en', { ascending: false }))) ?? [];
    },

    crear: ({ nombre, modo, frecuencia, dias = [], objetivoS, desde = null }) =>
      rpc('habito_crear', { p_nombre: nombre, p_modo: modo, p_frecuencia: frecuencia, p_dias: frecuencia === 'dias' ? dias : [], p_objetivo_s: objetivoS, p_desde: desde }),

    async programar({ habitoId, frecuencia, dias = [], objetivoS, desde }) {
      const r = await supabase.rpc('habito_programar', { p_habito_id: habitoId, p_frecuencia: frecuencia, p_dias: frecuencia === 'dias' ? dias : [], p_objetivo_s: objetivoS, p_desde: desde });
      if (r.error) throw r.error;
      return r.data;
    },

    async archivar({ habitoId, desde = null }) {
      const r = await supabase.rpc('habito_archivar', { p_habito_id: habitoId, p_desde: desde });
      if (r.error) throw r.error;
      return r.data;
    },

    registrarManual: ({ habitoId, fecha, segundos }) => rpc('habito_registrar_manual', { p_habito_id: habitoId, p_fecha: fecha, p_segundos: segundos }),

    async renombrar({ habitoId, nombre }) {
      const r = await supabase.from('habitos_config').update({ nombre: nombre.trim() }).eq('id', habitoId).select().single();
      if (r.error) throw r.error;
      return r.data;
    },

    // ---- Objetivos de atención
    async listarObjetivos({ desde }) {
      return (await unica(supabase.from('objetivos_atencion').select('*').gte('semana_inicio', desde).order('semana_inicio'))) ?? [];
    },

    async guardarObjetivo({ semana, frenteId, puntos }) {
      const u = await usuario();
      const r = await supabase.from('objetivos_atencion').upsert({ user_id: u.id, semana_inicio: semana, frente_id: frenteId, puntos }, { onConflict: 'user_id,semana_inicio,frente_id' }).select().single();
      if (r.error) throw r.error;
      return r.data;
    },

    async eliminarObjetivo({ semana, frenteId }) {
      const r = await supabase.from('objetivos_atencion').delete().eq('semana_inicio', semana).eq('frente_id', frenteId);
      if (r.error) throw r.error;
      return true;
    },

    /** Sesiones Focus completadas desde una fecha (para puntos por frente). */
    async sesionesCompletadas({ desde, hasta }) {
      return (await unica(supabase.from('focus_sesiones').select('id,frente_id,estado,puntos,finalizado_en').eq('estado', 'completada')
        .gte('finalizado_en', desdeISO(desde)).lt('finalizado_en', desdeISO(sumarDias(hasta, 1))).order('finalizado_en', { ascending: false }))) ?? [];
    },
  };
}
