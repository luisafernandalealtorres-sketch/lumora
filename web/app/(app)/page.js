import { createClient } from '@/lib/supabase/server';
import HomeApp from '@/components/home/HomeApp';
import { horaBogota, sumarDias } from '@/lib/domain/fechas';
import { leerFuente } from '@/lib/domain/estadosHome';
import { tablaFuentesInexistente } from '@/lib/domain/agenda';

export const dynamic = 'force-dynamic';

// Home, centro de control. El servidor lee las fuentes heredadas; cada una por separado: si una falla, solo esa se marca
// «Error de lectura» (no se vacía ni se tira la pantalla). Nada se inventa. La Fase 3 se carga en el cliente.
export default async function Home() {
  const supabase = createClient();
  const ahora = new Date();
  const hoy = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const fechaLarga = ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' });
  const desdeHabitos = sumarDias(hoy, -45);

  const consultas = {
    frentes: supabase.from('frentes').select('*').order('orden'),
    pendientes: supabase.from('pendientes').select('*').order('creado_en'),
    metas: supabase.from('metas').select('id,titulo,frente,estado').order('creado_en'),
    hitos: supabase.from('hitos').select('id,meta_id,hecho,fecha'),
    gastos: supabase.from('gastos').select('fecha,valor_cop,categoria,frente').gte('fecha', `${hoy.slice(0, 7)}-01`),
    presupuestos: supabase.from('presupuestos').select('categoria,monto_cop'),
    recurrentes: supabase.from('recurrentes').select('*').eq('activo', true),
    jornadas: supabase.from('jornadas').select('fecha').order('fecha', { ascending: false }).limit(90),
    notas: supabase.from('notas').select('id,titulo,frente,actualizado_en').order('actualizado_en', { ascending: false }).limit(300),
    biblioteca: supabase.from('biblioteca').select('id,titulo,guardado_en').order('guardado_en', { ascending: false }).limit(8),
    habitos: supabase.from('habitos').select('*').eq('activo', true).order('creado_en'),
    registros_habitos: supabase.from('habito_registros').select('habito_id,fecha,valor').gte('fecha', desdeHabitos),
    agenda: supabase.from('agenda_hoy').select('*').eq('fecha', hoy).order('inicio'),
    agenda_fuentes: supabase.from('calendarios_fuente').select('calendario_id,nombre,frente_id,estado,ultima_sincronizacion,ultimo_error'),
    correos: supabase.from('correos_hoy').select('*').eq('fecha', hoy).order('urgente', { ascending: false }),
    resumen: supabase.from('resumen_dia').select('*').eq('fecha', hoy).maybeSingle(),
  };
  const nombres = Object.keys(consultas);
  const respuestas = await Promise.all(nombres.map(n => consultas[n]));
  const datos = { hoy, hora: horaBogota(ahora), fechaLarga, ahoraMs: ahora.getTime() };
  const errores = [];
  nombres.forEach((n, i) => {
    const f = leerFuente(respuestas[i]);
    // Las fuentes de calendario pueden no existir todavía (migración sin aplicar): eso no es un error, la agenda queda «no conectada».
    if (!f.ok && !(n === 'agenda_fuentes' && tablaFuentesInexistente(f.error))) errores.push(n);
    const clave = n === 'registros_habitos' ? 'registrosHabitos' : n === 'agenda_fuentes' ? 'agendaFuentes' : n;
    datos[clave] = f.ok ? f.data : null;
  });
  const frentes = datos.frentes ?? [];
  delete datos.frentes;

  return <HomeApp datos={datos} errores={errores} frentes={frentes} />;
}
