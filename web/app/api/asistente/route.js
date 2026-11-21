import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { atender, validarMensajes } from '@/lib/asistente/servicio';

// Asistente: recibe la conversación, llama a Claude con las herramientas de LECTURA y devuelve la respuesta en vivo
// (una línea JSON por evento). Exige sesión. La clave de Anthropic vive solo aquí, en el servidor, y nunca llega al navegador.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const respuestaJson = (cuerpo, status) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return respuestaJson({ error: 'sin_sesion' }, 401);

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return respuestaJson({ error: 'solicitud' }, 400); }
  const v = validarMensajes(cuerpo?.mensajes);
  if (!v.ok) return respuestaJson({ error: v.codigo }, 400);
  const contexto = { ruta: String(cuerpo?.contexto?.ruta ?? '').slice(0, 80), frente: String(cuerpo?.contexto?.frente ?? '').slice(0, 40) };

  const clave = process.env.ANTHROPIC_API_KEY;
  const cliente = clave ? new Anthropic({ apiKey: clave }) : null;
  const entorno = {
    modelo: process.env.ASISTENTE_MODELO || undefined,
    topeUsd: Number(process.env.ASISTENTE_TOPE_USD ?? 4),
    esfuerzo: process.env.ASISTENTE_ESFUERZO || 'low',
    frentesExcluidos: process.env.ASISTENTE_FRENTES_EXCLUIDOS,
  };

  const codificador = new TextEncoder();
  const flujo = new ReadableStream({
    async start(controlador) {
      const emitir = evento => controlador.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`));
      try {
        const r = await atender({ supabase, cliente, entorno, mensajes: v.mensajes, contexto, ahora: Date.now(), emitir });
        if (!r.ok) emitir({ tipo: 'error', codigo: r.codigo });
      } catch {
        emitir({ tipo: 'error', codigo: 'interno' });
      } finally {
        controlador.close();
      }
    },
  });
  return new Response(flujo, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
