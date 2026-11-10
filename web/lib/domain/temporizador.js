// Dominio puro del temporizador global (Fase 3, etapa 2 y 3 del SQL v1.11).
//
// - Sin React, sin red, sin reloj propio: toda función que depende de "ahora" lo recibe (ms desde epoch).
// - El estado lo deciden las marcas de tiempo de la base (tramo_inicio, acumulado_s…), no un intervalo.
//   Aquí solo se interpretan filas ya leídas. La base sigue siendo la fuente de verdad (§4.3, §4.7).
// - Distingue siempre «sin datos» (null) de cero.

export const TIPOS_TEMPORIZADOR = ['focus', 'descanso', 'habito'];
export const MODALIDADES = [
  { id: 'productivity', nombre: 'Productivity' },
  { id: 'enjoyment', nombre: 'Enjoyment' },
];

/** Valores iniciales de preferencias (§4.1). Coinciden con public._prefs cuando no hay fila. */
export const PREFERENCIAS_INICIALES = Object.freeze({
  focus_min: 30,
  descanso_corto_min: 5,
  descanso_largo_min: 20,
  ciclos_para_largo: 4,
  avisos: true,
  sonido: true,
});

const esFila = v => v !== null && typeof v === 'object';
const aMs = iso => {
  if (typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};
const entero = v => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);

/** Preferencias efectivas: la fila del usuario o, sin fila, los valores iniciales. */
export function preferenciasEfectivas(fila) {
  if (!esFila(fila)) return { ...PREFERENCIAS_INICIALES, personalizadas: false };
  const p = { ...PREFERENCIAS_INICIALES, personalizadas: true };
  for (const k of Object.keys(PREFERENCIAS_INICIALES)) if (fila[k] !== undefined && fila[k] !== null) p[k] = fila[k];
  return p;
}

// ---------------------------------------------------------------------------------------------
// Instantánea del temporizador activo
// ---------------------------------------------------------------------------------------------

/**
 * Construye la instantánea del temporizador activo a partir de las filas leídas.
 * Entrada: { activo, focus, descanso, habito, habitoConfig, objetivoHabitoS, segmentosHabito }
 *   - `activo`: fila de temporizador_activo (o null).
 *   - `focus` / `descanso` / `habito`: la fila del registro al que apunta `activo.ref_id`.
 * Devuelve null si no hay temporizador activo. Si `activo` existe pero falta su registro (lectura
 * incompleta), devuelve { incompleto: true, tipo, id } para que la interfaz lo informe y no lo oculte.
 */
export function instantanea(entrada) {
  const { activo, focus, descanso, habito, habitoConfig, objetivoHabitoS, segmentosHabito } = entrada ?? {};
  if (!esFila(activo)) return null;
  const tipo = activo.tipo;
  const id = activo.ref_id;
  const registro = tipo === 'focus' ? focus : tipo === 'descanso' ? descanso : tipo === 'habito' ? habito : null;
  if (!esFila(registro) || registro.id !== id) return { incompleto: true, tipo, id };

  const corriendo = activo.estado === 'corriendo';
  const base = { tipo, id, corriendo, pausado: !corriendo, version: registro.version ?? null, registro };

  if (tipo === 'habito') {
    const segs = Array.isArray(segmentosHabito) ? segmentosHabito : [];
    const cerrados = segs.reduce((a, s) => a + entero(s.segundos), 0);
    return {
      ...base,
      baseS: cerrados,
      tramoInicioMs: corriendo ? aMs(registro.tramo_inicio) : null,
      objetivoS: Number.isFinite(objetivoHabitoS) ? objetivoHabitoS : null,
      cuentaAtras: false,
      titulo: habitoConfig?.nombre ?? null,
      habitoId: registro.habito_id ?? null,
    };
  }
  return {
    ...base,
    baseS: entero(registro.acumulado_s),
    tramoInicioMs: corriendo ? aMs(registro.tramo_inicio) : null,
    objetivoS: Number.isFinite(registro.duracion_objetivo_s) ? registro.duracion_objetivo_s : null,
    cuentaAtras: true,
    titulo: tipo === 'focus' ? (registro.actividad ?? null) : (registro.tipo === 'largo' ? 'Descanso largo' : 'Descanso corto'),
    modalidad: tipo === 'focus' ? registro.modalidad : null,
    frenteId: tipo === 'focus' ? registro.frente_id : null,
    descansoTipo: tipo === 'descanso' ? registro.tipo : null,
  };
}

/**
 * Lectura del temporizador en un instante: tiempo transcurrido, restante y exceso.
 * - Pausado: el tiempo no avanza (se conserva lo acumulado).
 * - Un instante anterior al inicio del tramo (reloj local atrasado) no produce tiempo negativo.
 * - `restanteS` es null cuando no hay objetivo (hábito sin objetivo conocido): no se inventa uno.
 */
export function leer(inst, ahoraMs) {
  if (!inst || inst.incompleto) return null;
  let transcurridoS = inst.baseS;
  if (inst.corriendo && inst.tramoInicioMs !== null && Number.isFinite(ahoraMs)) {
    transcurridoS += Math.max(0, Math.floor((ahoraMs - inst.tramoInicioMs) / 1000));
  }
  const objetivoS = inst.objetivoS;
  const restanteS = objetivoS === null ? null : Math.max(0, objetivoS - transcurridoS);
  const excedidoS = objetivoS === null ? null : Math.max(0, transcurridoS - objetivoS);
  const meta = objetivoS !== null && transcurridoS >= objetivoS;
  const progreso = objetivoS ? Math.min(1, transcurridoS / objetivoS) : null;
  return { transcurridoS, restanteS, excedidoS, meta, progreso };
}

/** Segundos que faltan para alcanzar el objetivo, o null (sin objetivo, pausado o ya alcanzado). Útil para programar el aviso. */
export function segundosParaMeta(inst, ahoraMs) {
  const l = leer(inst, ahoraMs);
  if (!l || !inst.corriendo || l.restanteS === null || l.meta) return null;
  return l.restanteS;
}

// ---------------------------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------------------------

/** «mm:ss» (o «h:mm:ss» desde una hora). Un valor ausente o inválido es «--:--», nunca «00:00». */
export function formatoReloj(segundos) {
  if (!Number.isFinite(segundos) || segundos < 0) return '--:--';
  const s = Math.floor(segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dos = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(r)}` : `${dos(m)}:${dos(r)}`;
}

/** Duración legible: «25 min», «1 h 05 min», «45 s». Ausente → null. */
export function duracionLegible(segundos) {
  if (!Number.isFinite(segundos) || segundos < 0) return null;
  const s = Math.floor(segundos);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

export const ETIQUETA_TIPO = { focus: 'Focus', descanso: 'Descanso', habito: 'Hábito' };

// ---------------------------------------------------------------------------------------------
// Ciclos y descansos sugeridos (§4.4, P9, T-12)
// ---------------------------------------------------------------------------------------------

/**
 * Contador de ciclos derivado (no se guarda): sesiones Focus «completada» cuyo fin es posterior al último
 * descanso largo completado u omitido. Replica public._ciclos_desde_ultimo_largo.
 */
export function contarCiclos(sesiones, descansos) {
  const ses = Array.isArray(sesiones) ? sesiones : [];
  const des = Array.isArray(descansos) ? descansos : [];
  let corte = -Infinity;
  for (const d of des) {
    if (d.tipo === 'largo' && (d.estado === 'completado' || d.estado === 'omitido')) {
      const t = aMs(d.finalizado_en);
      if (t !== null && t > corte) corte = t;
    }
  }
  return ses.filter(s => {
    if (s.estado !== 'completada') return false;
    const t = aMs(s.finalizado_en);
    return t !== null && t > corte;
  }).length;
}

/**
 * Descanso sugerido tras la última sesión Focus finalizada, o null.
 * - Solo si la última sesión finalizada fue «completada» (las parciales y canceladas no cuentan ni sugieren).
 * - Solo si aún no hay un descanso (en cualquier estado) originado por esa sesión ni posterior a ella.
 * - Con `ciclos >= ciclos_para_largo` se sugiere únicamente el largo; si no, el corto (T-12).
 * - Nunca se inicia solo: es una sugerencia.
 */
export function descansoSugerido({ sesiones, descansos, prefs }) {
  const ses = (Array.isArray(sesiones) ? sesiones : []).filter(s => aMs(s.finalizado_en) !== null);
  if (!ses.length) return null;
  const ultima = ses.reduce((a, b) => (aMs(b.finalizado_en) > aMs(a.finalizado_en) ? b : a));
  if (ultima.estado !== 'completada') return null;
  const finUltima = aMs(ultima.finalizado_en);
  const des = Array.isArray(descansos) ? descansos : [];
  const yaDecidido = des.some(d => d.sesion_origen_id === ultima.id
    || (aMs(d.finalizado_en) !== null && aMs(d.finalizado_en) >= finUltima)
    || (aMs(d.iniciado_en) !== null && aMs(d.iniciado_en) >= finUltima));
  if (yaDecidido) return null;
  const p = preferenciasEfectivas(prefs);
  const ciclos = contarCiclos(ses, des);
  const largo = ciclos >= p.ciclos_para_largo;
  return {
    tipo: largo ? 'largo' : 'corto',
    duracionS: (largo ? p.descanso_largo_min : p.descanso_corto_min) * 60,
    ciclos,
    ciclosParaLargo: p.ciclos_para_largo,
    sesionOrigenId: ultima.id,
  };
}

/** Puntos de atención de una lista de sesiones: solo cuentan las «completada» (1 por sesión; T-2, §4.6). */
export function puntosDeSesiones(sesiones) {
  return (Array.isArray(sesiones) ? sesiones : []).filter(s => s.estado === 'completada').reduce((a, s) => a + (s.puntos ?? 1), 0);
}

/** Resumen de un conjunto de sesiones para una lista. */
export function resumenSesiones(sesiones) {
  const l = Array.isArray(sesiones) ? sesiones : [];
  const cuenta = e => l.filter(s => s.estado === e).length;
  return {
    total: l.length,
    completadas: cuenta('completada'),
    parciales: cuenta('parcial'),
    canceladas: cuenta('cancelada'),
    puntos: puntosDeSesiones(l),
    efectivoS: l.reduce((a, s) => a + entero(s.tiempo_efectivo_s), 0),
  };
}

export const ETIQUETA_ESTADO_SESION = {
  completada: 'Completada', parcial: 'Parcial', cancelada: 'Cancelada', en_curso: 'En curso', pausada: 'Pausada',
};

// ---------------------------------------------------------------------------------------------
// Errores de la base → mensajes claros
// ---------------------------------------------------------------------------------------------

/**
 * Traduce un error de Supabase/PostgREST (o de una excepción del SQL v1.11) a un código estable y un mensaje.
 * Un error nunca se presenta como «sin datos». Códigos: fase3_no_disponible, temporizador_ocupado, transicion_invalida,
 * no_autenticado, sin_permiso, red, desconocido, y los de validación del SQL (sesion_no_encontrada, parametro_invalido…).
 */
export function traducirError(err) {
  if (!err) return null;
  const texto = String(err.message ?? err.error_description ?? err);
  const detalle = typeof err.details === 'string' ? err.details : (typeof err.detail === 'string' ? err.detail : '');
  const codigo = String(err.code ?? '');

  if (codigo === 'PGRST202' || codigo === '42883' || /could not find the function|schema cache|does not exist/i.test(texto) && /function|funci/i.test(texto)) {
    return { codigo: 'fase3_no_disponible', mensaje: 'La base de datos todavía no tiene activadas las funciones de la Fase 3. Hace falta aplicar la migración v1.11 (con tu autorización).' };
  }
  if (codigo === '42703' || /column .* does not exist/i.test(texto)) {
    return { codigo: 'fase3_no_disponible', mensaje: 'La base de datos todavía no tiene las columnas de la Fase 3 (por ejemplo la prioridad de los pendientes). Hace falta aplicar la migración v1.11 (con tu autorización).' };
  }
  if (codigo === '42P01' || codigo === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(texto)) {
    return { codigo: 'fase3_no_disponible', mensaje: 'Las tablas de la Fase 3 todavía no existen en la base de datos. Hace falta aplicar la migración v1.11 (con tu autorización).' };
  }
  if (/temporizador_ocupado/.test(texto)) {
    const m = /^(focus|descanso|habito):([0-9a-f-]{36}):(corriendo|pausado)$/i.exec(detalle.trim());
    return {
      codigo: 'temporizador_ocupado',
      mensaje: 'Ya hay un temporizador activo. Complétalo o cancélalo antes de iniciar otro.',
      ocupado: m ? { tipo: m[1].toLowerCase(), id: m[2], estado: m[3].toLowerCase() } : null,
    };
  }
  if (/transicion_invalida/.test(texto)) return { codigo: 'transicion_invalida', mensaje: 'Esa acción ya no es posible porque el estado cambió (¿otro dispositivo?). Se actualizó la vista.' };
  if (/sesion_no_encontrada|temporizador_no_encontrado|descanso_no_encontrado/.test(texto)) return { codigo: 'no_encontrado', mensaje: 'El registro ya no existe. Se actualizó la vista.' };
  if (/no_autenticado/.test(texto) || codigo === '28000') return { codigo: 'no_autenticado', mensaje: 'Tu sesión expiró. Vuelve a entrar.' };
  if (/sin_ocurrencia/.test(texto)) return { codigo: 'sin_ocurrencia', mensaje: 'Ese hábito no está programado en esa fecha, así que no se puede registrar tiempo allí.' };
  if (/fecha_no_permitida/.test(texto)) return { codigo: 'fecha_no_permitida', mensaje: 'Esa fecha no está permitida (no se registra tiempo futuro ni se programa hacia atrás).' };
  if (/version_existente/.test(texto)) return { codigo: 'version_existente', mensaje: 'Ya existe una programación que empieza en esa fecha.' };
  if (/semana_cerrada/.test(texto)) return { codigo: 'semana_cerrada', mensaje: 'Los objetivos de semanas anteriores no se pueden modificar.' };
  if (/habito_invalido/.test(texto)) return { codigo: 'habito_invalido', mensaje: 'Ese hábito no existe o está archivado.' };
  if (/modo_no_temporizador/.test(texto)) return { codigo: 'modo_no_temporizador', mensaje: 'Ese hábito se registra de forma manual, no con temporizador.' };
  if (/pendiente_invalido/.test(texto)) return { codigo: 'pendiente_invalido', mensaje: 'Ese pendiente no existe.' };
  if (/parametro_invalido/.test(texto)) return { codigo: 'parametro_invalido', mensaje: 'Alguno de los datos enviados no es válido.' };
  if (codigo === '42501' || /permission denied/i.test(texto)) return { codigo: 'sin_permiso', mensaje: 'No tienes permiso para esa operación.' };
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(texto)) return { codigo: 'red', mensaje: 'No hay conexión con el servidor. Reintenta cuando vuelva la red.' };
  return { codigo: 'desconocido', mensaje: `No se pudo completar la operación: ${texto}` };
}

// ---------------------------------------------------------------------------------------------
// Mensajes de cierre
// ---------------------------------------------------------------------------------------------

/**
 * Mensaje tras cerrar una sesión Focus según el estado que decidió el servidor (T-2):
 * «completada» = 1 punto; «parcial» = sin punto; «cancelada» = descartada, sin punto.
 */
export function mensajeCierreFocus(fila) {
  if (!esFila(fila)) return null;
  const t = duracionLegible(fila.tiempo_efectivo_s);
  if (fila.estado === 'completada') return `Sesión completada${t ? ` (${t})` : ''}: +1 punto de atención.`;
  if (fila.estado === 'parcial') return `Sesión guardada como parcial${t ? ` (${t})` : ''}: no genera punto de atención.`;
  if (fila.estado === 'cancelada') return 'Sesión cancelada: se conserva sin puntos.';
  return null;
}
