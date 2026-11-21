// Herramientas de LECTURA del asistente. Cada una consulta la base con la sesión de Luisa (la seguridad por usuario de Supabase
// aplica igual que en la app), quita los frentes excluidos y devuelve un resumen corto: lo que se devuelve viaja a Anthropic,
// así que se limita en filas y en texto. Ninguna escribe nada. `proponer_recuerdo` solo PROPONE: no guarda.
import { resumenPendientes, prioridadesHoy, avanceMetas, resumenGastos } from '../domain/resumen.js';
import { sumarDias } from '../domain/fechas.js';
import { esTodoElDia, haceCuanto } from '../domain/agenda.js';
import { esNegocio, CATEGORIAS } from '../format.js';
import { frentePermitido, sinFrentesExcluidos } from './privacidad.js';

const MAX_TEXTO = 300;           // caracteres de texto libre que se envían por registro
const MAX_RESPUESTA = 7000;      // caracteres por respuesta de herramienta
const recortar = (t, n = MAX_TEXTO) => (typeof t === 'string' && t.length > n ? `${t.slice(0, n)}…` : t ?? null);
const entero = (v, min, max, def) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

export const HERRAMIENTAS = [
  {
    name: 'resumen_del_dia',
    description: 'Panorama de hoy: pendientes abiertos (con los más urgentes), vencidos, y los eventos de hoy y mañana de la agenda. Úsala para «¿qué tengo hoy?», «¿cómo va mi día?».',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: 'consultar_pendientes',
    description: 'Lista de pendientes con su frente y fecha límite. Úsala para preguntas sobre tareas por hacer, hechas o de un frente.',
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['abiertos', 'hechos', 'todos'], description: 'Por defecto abiertos.' },
        frente: { type: 'string', description: 'Slug del frente (por ejemplo tanku, ticketcode-eve, hama). Opcional.' },
        limite: { type: 'integer', description: 'Máximo de filas, de 1 a 30. Por defecto 15.' },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'consultar_agenda',
    description: 'Eventos de la agenda (Google Calendar, solo lectura) de hoy, de mañana o de ambos días, con su frente y la hora de la última sincronización.',
    input_schema: {
      type: 'object',
      properties: { dia: { type: 'string', enum: ['hoy', 'manana', 'ambos'], description: 'Por defecto ambos.' } },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'consultar_gastos',
    description: 'Gasto de un mes: total, negocio contra personal, por categoría y los mayores gastos. Úsala para «¿cuánto he gastado?».',
    input_schema: {
      type: 'object',
      properties: {
        mes: { type: 'string', description: 'Mes como AAAA-MM. Por defecto el mes actual.' },
        categoria: { type: 'string', enum: CATEGORIAS, description: 'Filtra una categoría. Opcional.' },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'consultar_metas',
    description: 'Metas con su avance (hitos y pendientes vinculados).',
    input_schema: {
      type: 'object',
      properties: { estado: { type: 'string', enum: ['activa', 'pausada', 'lograda'], description: 'Por defecto activa.' } },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'buscar_notas',
    description: 'Busca en las notas e ideas de Cerebro por palabras del título o del contenido.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Palabras a buscar (máximo 80 caracteres).' },
        limite: { type: 'integer', description: 'Máximo de notas, de 1 a 8. Por defecto 5.' },
      },
      required: ['texto'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'consultar_jornada',
    description: 'Relatos recientes de Jornada (cómo le fue en los últimos días) y su racha.',
    input_schema: {
      type: 'object',
      properties: { dias: { type: 'integer', description: 'Cuántos días atrás, de 1 a 14. Por defecto 7.' } },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'proponer_recuerdo',
    description: 'Propone a Luisa guardar un hecho duradero (preferencia o decisión) en su memoria. NO lo guarda: solo muestra una tarjeta que ella puede aprobar o descartar.',
    input_schema: {
      type: 'object',
      properties: { texto: { type: 'string', description: 'Una frase corta en tercera persona, de 5 a 300 caracteres.' } },
      required: ['texto'],
      additionalProperties: false,
    },
    strict: true,
  },
];

export const NOMBRES_HERRAMIENTAS = HERRAMIENTAS.map(h => h.name);

/** Resultado de una herramienta como texto, recortado. Un error nunca expone detalles internos. */
const salida = obj => {
  const t = JSON.stringify(obj);
  return t.length > MAX_RESPUESTA ? `${t.slice(0, MAX_RESPUESTA)}…[recortado]` : t;
};

/**
 * Ejecuta una herramienta. Devuelve { contenido, esError }.
 * @param {string} nombre
 * @param {object} entrada  Lo que pidió el modelo (se valida aquí; nunca se confía en él)
 * @param {object} ctx  { supabase, hoy, excluidos, nombreFrente(slug), emitir(evento) }
 */
export async function ejecutarHerramienta(nombre, entrada, ctx) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  try {
    switch (nombre) {
      case 'resumen_del_dia': return ok(await resumenDelDia(ctx));
      case 'consultar_pendientes': return ok(await consultarPendientes(e, ctx));
      case 'consultar_agenda': return ok(await consultarAgenda(e, ctx));
      case 'consultar_gastos': return ok(await consultarGastos(e, ctx));
      case 'consultar_metas': return ok(await consultarMetas(e, ctx));
      case 'buscar_notas': return ok(await buscarNotas(e, ctx));
      case 'consultar_jornada': return ok(await consultarJornada(e, ctx));
      case 'proponer_recuerdo': return proponerRecuerdo(e, ctx);
      default: return { contenido: salida({ error: 'herramienta_desconocida' }), esError: true };
    }
  } catch {
    return { contenido: salida({ error: 'no_disponible', detalle: 'No se pudo leer ese dato ahora.' }), esError: true };
  }
}

const ok = obj => ({ contenido: salida(obj), esError: false });
const leer = async consulta => { const { data, error } = await consulta; if (error) throw new Error('lectura'); return data ?? []; };

// ---------------------------------------------------------------- Pendientes y agenda
async function pendientesDe(ctx) {
  return sinFrentesExcluidos(await leer(ctx.supabase.from('pendientes').select('id,texto,frente,hecho,hecho_en,fecha_limite,creado_en')), ctx.excluidos);
}

async function eventosDe(ctx, desde, hasta) {
  const filas = await leer(ctx.supabase.from('agenda_hoy').select('fecha,inicio,fin,titulo,frente_id').gte('fecha', desde).lte('fecha', hasta).order('inicio'));
  return filas.map(f => ({
    fecha: f.fecha, hora: esTodoElDia(f) ? 'todo el día' : hora(f.inicio), titulo: recortar(f.titulo, 120),
    frente: f.frente_id ?? 'sin asignar',
  }));
}

async function sincronizacion(ctx) {
  const fuentes = await leer(ctx.supabase.from('calendarios_fuente').select('nombre,estado,ultima_sincronizacion'));
  const ultima = fuentes.filter(f => f.estado === 'activa' && f.ultima_sincronizacion).map(f => f.ultima_sincronizacion).sort().pop() ?? null;
  return {
    ultima_sincronizacion: ultima ? haceCuanto(ultima, ctx.ahoraMs ?? Date.now()) : 'nunca',
    cuentas_sin_conectar: fuentes.filter(f => f.estado === 'pendiente').map(f => f.nombre),
  };
}

async function resumenDelDia(ctx) {
  const pend = await pendientesDe(ctx);
  const r = resumenPendientes({ pendientes: pend, hoy: ctx.hoy });
  const p = prioridadesHoy({ pendientes: pend, hoy: ctx.hoy, limite: 5 });
  const manana = sumarDias(ctx.hoy, 1);
  const eventos = await eventosDe(ctx, ctx.hoy, manana);
  return {
    fecha: ctx.hoy,
    pendientes: { abiertos: r.abiertos, vencidos: r.vencidos, vencen_hoy: r.vencenHoy, completados_hoy: r.completadosHoy,
      mas_urgentes: p.items.map(x => ({ texto: recortar(x.texto, 120), frente: ctx.nombreFrente(x.frente), motivo: x.motivo })) },
    agenda: { hoy: eventos.filter(x => x.fecha === ctx.hoy), manana: eventos.filter(x => x.fecha === manana), ...(await sincronizacion(ctx)) },
  };
}

async function consultarPendientes(e, ctx) {
  const estado = ['abiertos', 'hechos', 'todos'].includes(e.estado) ? e.estado : 'abiertos';
  const limite = entero(e.limite, 1, 30, 15);
  let filas = await pendientesDe(ctx);
  if (typeof e.frente === 'string' && e.frente) {
    if (!frentePermitido(e.frente, ctx.excluidos)) return { aviso: 'Ese frente está fuera del alcance del asistente por decisión de Luisa.' };
    filas = filas.filter(f => f.frente === e.frente);
  }
  if (estado === 'abiertos') filas = filas.filter(f => !f.hecho);
  if (estado === 'hechos') filas = filas.filter(f => f.hecho);
  filas.sort((a, b) => String(a.fecha_limite ?? '9999').localeCompare(String(b.fecha_limite ?? '9999')));
  return {
    total: filas.length,
    pendientes: filas.slice(0, limite).map(f => ({ texto: recortar(f.texto, 160), frente: ctx.nombreFrente(f.frente), fecha_limite: f.fecha_limite, hecho: f.hecho })),
    ...(filas.length === 0 ? { nota: 'Sin registros con esos criterios.' } : {}),
  };
}

async function consultarAgenda(e, ctx) {
  const dia = ['hoy', 'manana', 'ambos'].includes(e.dia) ? e.dia : 'ambos';
  const manana = sumarDias(ctx.hoy, 1);
  const desde = dia === 'manana' ? manana : ctx.hoy, hasta = dia === 'hoy' ? ctx.hoy : manana;
  const eventos = await eventosDe(ctx, desde, hasta);
  return { eventos, ...(eventos.length === 0 ? { nota: 'Sin eventos sincronizados en ese rango.' } : {}), ...(await sincronizacion(ctx)) };
}

// ---------------------------------------------------------------- Gastos, metas, notas, jornada
function primerDiaDelMesSiguiente(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
}

async function consultarGastos(e, ctx) {
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(e.mes ?? '') ? e.mes : ctx.hoy.slice(0, 7);
  let gastos = sinFrentesExcluidos(await leer(ctx.supabase.from('gastos').select('fecha,lugar,categoria,valor_cop,frente').gte('fecha', `${mes}-01`).lt('fecha', primerDiaDelMesSiguiente(mes))), ctx.excluidos);
  if (CATEGORIAS.includes(e.categoria)) gastos = gastos.filter(g => g.categoria === e.categoria);
  const r = resumenGastos({ gastos, presupuestos: [], mes, esNegocio });
  const porCategoria = CATEGORIAS.map(c => ({ categoria: c, total: gastos.filter(g => g.categoria === c).reduce((s, g) => s + Number(g.valor_cop), 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  return {
    mes, registros: r.cantidad, total_cop: r.total, negocio_cop: r.negocio, personal_cop: r.personal,
    por_categoria: porCategoria,
    mayores: [...gastos].sort((a, b) => Number(b.valor_cop) - Number(a.valor_cop)).slice(0, 5).map(g => ({ fecha: g.fecha, lugar: recortar(g.lugar, 60), categoria: g.categoria, valor_cop: Number(g.valor_cop), frente: ctx.nombreFrente(g.frente) })),
    ...(r.cantidad === 0 ? { nota: 'Sin gastos registrados en ese mes (no significa que no hayas gastado).' } : {}),
  };
}

async function consultarMetas(e, ctx) {
  const estado = ['activa', 'pausada', 'lograda'].includes(e.estado) ? e.estado : 'activa';
  const metas = sinFrentesExcluidos(await leer(ctx.supabase.from('metas').select('id,titulo,frente,estado,fecha_meta')), ctx.excluidos);
  const hitos = await leer(ctx.supabase.from('hitos').select('meta_id,hecho'));
  const vinculados = await leer(ctx.supabase.from('pendientes').select('meta_id,hecho').not('meta_id', 'is', null));
  const av = avanceMetas({ metas: metas.map(m => ({ ...m, estado: 'activa' })), hitos, pendientes: vinculados });
  const lista = metas.filter(m => m.estado === estado).map(m => {
    const a = av.porMeta.find(x => x.id === m.id);
    return { titulo: recortar(m.titulo, 120), frente: ctx.nombreFrente(m.frente), fecha_meta: m.fecha_meta, avance_pct: a?.avance == null ? null : Math.round(a.avance * 100), hechos: a?.hechos ?? 0, total: a?.total ?? 0 };
  });
  return { estado, metas: lista, ...(lista.length === 0 ? { nota: 'Sin metas con ese estado.' } : {}) };
}

const limpiarBusqueda = t => String(t ?? '').replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

async function buscarNotas(e, ctx) {
  const texto = limpiarBusqueda(e.texto);
  if (texto.length < 2) return { aviso: 'Escribe al menos 2 letras para buscar.' };
  const limite = entero(e.limite, 1, 8, 5);
  const filas = sinFrentesExcluidos(await leer(
    ctx.supabase.from('notas').select('titulo,contenido,etiquetas,frente,actualizado_en').or(`titulo.ilike.%${texto}%,contenido.ilike.%${texto}%`).order('actualizado_en', { ascending: false }).limit(limite * 2),
  ), ctx.excluidos).slice(0, limite);
  return {
    encontradas: filas.length,
    notas: filas.map(n => ({ titulo: recortar(n.titulo, 120), extracto: recortar(n.contenido), etiquetas: n.etiquetas ?? [], frente: ctx.nombreFrente(n.frente), actualizada: String(n.actualizado_en ?? '').slice(0, 10) })),
    ...(filas.length === 0 ? { nota: 'Ninguna nota coincide.' } : {}),
  };
}

async function consultarJornada(e, ctx) {
  const dias = entero(e.dias, 1, 14, 7);
  const desde = sumarDias(ctx.hoy, -(dias - 1));
  const filas = await leer(ctx.supabase.from('jornadas').select('fecha,relato,salio_bien,no_salio,mejora_manana').gte('fecha', desde).order('fecha', { ascending: false }));
  const conRelato = filas.filter(j => j.relato);
  return {
    desde, jornadas: conRelato.map(j => ({ fecha: j.fecha, relato: recortar(j.relato), salio_bien: (j.salio_bien ?? []).map(x => recortar(x, 120)), no_salio: recortar(j.no_salio, 200), mejora_manana: recortar(j.mejora_manana, 160) })),
    ...(conRelato.length === 0 ? { nota: 'Sin jornadas escritas en ese rango.' } : {}),
  };
}

// ---------------------------------------------------------------- Memoria (solo propone)
function proponerRecuerdo(e, ctx) {
  const texto = String(e.texto ?? '').replace(/\s+/g, ' ').trim();
  if (texto.length < 5 || texto.length > 300) return { contenido: salida({ error: 'texto_invalido', detalle: 'Debe tener entre 5 y 300 caracteres.' }), esError: true };
  ctx.emitir?.({ tipo: 'propuesta_memoria', texto });
  return { contenido: salida({ estado: 'propuesta_mostrada', detalle: 'Se le mostró a Luisa. Solo se guarda si lo aprueba; no lo des por guardado.' }), esError: false };
}
