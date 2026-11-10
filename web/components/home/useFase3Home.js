'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cargarLifePulseVarios } from '@/lib/data/lifePulse';
import { fechaBogota } from '@/lib/domain/fechas';
import { traducirError } from '@/lib/domain/temporizador';

/**
 * Carga UNA sola vez los datos de la Fase 3 que usa Home (Life Pulse de hoy y de la semana, sesiones de Focus de la semana).
 * Estados: 'cargando' | 'ok' | 'fase3_no_activada' (la base aún no tiene las tablas) | 'error_lectura' (falló otra cosa).
 * Un error nunca se convierte en «ok» vacío. `cargador` es inyectable (pruebas).
 */
export function useFase3Home(cargador = null) {
  const supabase = useMemo(() => (cargador ? null : createClient()), [cargador]);
  const [s, setS] = useState({ estado: 'cargando', dia: null, semana: null, sesiones: null, error: null });
  useEffect(() => {
    let vivo = true;
    const hoy = fechaBogota();
    const periodos = [{ tipo: 'dia', ancla: hoy }, { tipo: 'semana', ancla: hoy }];
    (cargador ? cargador({ periodos }) : cargarLifePulseVarios(supabase, { periodos }))
      .then(d => vivo && setS({ estado: 'ok', dia: d.resultados[0], semana: d.resultados[1], sesiones: d.sesiones ?? [], error: null }))
      .catch(e => {
        if (!vivo) return;
        const t = traducirError(e);
        setS({ estado: t.codigo === 'fase3_no_disponible' ? 'fase3_no_activada' : 'error_lectura', dia: null, semana: null, sesiones: null, error: t });
      });
    return () => { vivo = false; };
  }, [supabase, cargador]);
  return s;
}
