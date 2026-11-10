'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { crearServicio, ejecutar } from '@/lib/data/temporizador';
import {
  instantanea, leer, descansoSugerido, preferenciasEfectivas, formatoReloj, ETIQUETA_TIPO, traducirError,
} from '@/lib/domain/temporizador';

// Estado global del temporizador. Vive en el shell, así que se conserva al cambiar de ruta; al recargar
// se reconstruye desde la base (marcas de tiempo del servidor), no desde un intervalo ni desde el navegador.
//  - El reloj de 1 s solo repinta; el estado real se relee al volver a la pestaña y cada 30 s (§4.7, sin Realtime).
//  - Al llegar a la meta se avisa (notificación del navegador si hay permiso, sonido si está activado, y siempre
//    un aviso dentro de la aplicación). No se completa nada automáticamente: el usuario decide (§4.5).
export const ContextoTemporizador = createContext(null);
const Ctx = ContextoTemporizador;
const SYNC_MS = 30000;
const CLAVE_AVISADO = 'sb-timer-avisado';

function pitar() {
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!AC) throw new Error('sin audio');
  const ctx = new AC();
  if (ctx.state === 'suspended') { ctx.resume?.(); if (ctx.state === 'suspended') { ctx.close?.(); throw new Error('audio bloqueado'); } }
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.15;
  o.connect(g); g.connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + 0.4);
  o.onended = () => ctx.close?.();
}

export function TemporizadorProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const servicio = useMemo(() => crearServicio(supabase), [supabase]);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);            // { codigo, mensaje } de la última lectura o acción
  const [noDisponible, setNoDisponible] = useState(false);
  const [ocupado, setOcupado] = useState(false);        // una acción en curso: bloquea los botones
  const [ahora, setAhora] = useState(() => Date.now());
  const [aviso, setAviso] = useState(null);              // { id, mensaje, sonidoBloqueado?, notificacionBloqueada? }
  const secuencia = useRef(0);
  const tituloBase = useRef(null);

  const recargar = useCallback(async ({ silencioso = false } = {}) => {
    const mia = ++secuencia.current;
    if (!silencioso) setCargando(true);
    try {
      const d = await servicio.cargarEstado();
      if (mia !== secuencia.current) return;            // llegó una lectura más reciente
      setDatos(d); setError(null); setNoDisponible(false);
    } catch (e) {
      if (mia !== secuencia.current) return;
      const t = traducirError(e);
      if (t.codigo === 'fase3_no_disponible') { setNoDisponible(true); setDatos(null); }
      setError(t);
    } finally {
      if (mia === secuencia.current) { setCargando(false); setAhora(Date.now()); }
    }
  }, [servicio]);

  useEffect(() => { recargar(); }, [recargar]);

  const inst = useMemo(() => instantanea(datos), [datos]);
  const lectura = useMemo(() => leer(inst, ahora), [inst, ahora]);
  const prefs = useMemo(() => preferenciasEfectivas(datos?.prefs), [datos]);
  const activo = !!inst && !inst.incompleto;
  const corriendo = activo && inst.corriendo;

  // Reloj de repintado: solo mientras algo corre.
  useEffect(() => {
    if (!corriendo) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [corriendo]);

  // Sincronización: al volver el foco/visibilidad y cada 30 s con la pestaña visible.
  useEffect(() => {
    if (noDisponible) return undefined;
    const alVolver = () => { if (document.visibilityState === 'visible') { setAhora(Date.now()); recargar({ silencioso: true }); } };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    const t = setInterval(() => { if (document.visibilityState === 'visible') recargar({ silencioso: true }); }, SYNC_MS);
    return () => { document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('focus', alVolver); clearInterval(t); };
  }, [recargar, noDisponible]);

  // Título de la pestaña con el reloj mientras hay un temporizador.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!activo || !lectura) {
      if (tituloBase.current !== null) { document.title = tituloBase.current; tituloBase.current = null; }
      return undefined;
    }
    if (tituloBase.current === null) tituloBase.current = document.title;
    const valor = lectura.restanteS !== null && inst.cuentaAtras ? lectura.restanteS : lectura.transcurridoS;
    document.title = `${formatoReloj(valor)} · ${ETIQUETA_TIPO[inst.tipo]}${inst.pausado ? ' (pausa)' : ''}`;
    return undefined;
  }, [activo, lectura, inst]);
  useEffect(() => () => { if (tituloBase.current !== null && typeof document !== 'undefined') document.title = tituloBase.current; }, []);

  // Aviso al alcanzar la meta (una sola vez por temporizador, incluso tras recargar).
  const meta = !!(corriendo && lectura?.meta && inst.objetivoS !== null);
  useEffect(() => {
    if (!meta) return;
    let previo = null;
    try { previo = window.localStorage.getItem(CLAVE_AVISADO); } catch { /* sin almacenamiento */ }
    if (previo === inst?.id) return;
    try { window.localStorage.setItem(CLAVE_AVISADO, inst?.id); } catch { /* sin almacenamiento */ }
    const etiqueta = inst.tipo === 'descanso' ? 'El descanso terminó' : inst.tipo === 'habito' ? 'Alcanzaste el objetivo del hábito' : 'Tu sesión de Focus llegó a la meta';
    const a = { id: inst.id, mensaje: etiqueta, sonidoBloqueado: false, notificacionBloqueada: false };
    if (prefs.avisos && typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') { try { new Notification(etiqueta); } catch { a.notificacionBloqueada = true; } }
      else a.notificacionBloqueada = true;                    // denegado o sin pedir: se informa en la aplicación
    }
    if (prefs.sonido) { try { pitar(); } catch { a.sonidoBloqueado = true; } }
    setAviso(a);
  }, [meta, inst, prefs.avisos, prefs.sonido]);

  const solicitarPermiso = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'no_soportado';
    try { return await Notification.requestPermission(); } catch { return 'denegado'; }
  }, []);

  // Ejecuta una acción: bloquea botones, traduce errores y SIEMPRE relee el estado real (aunque falle, el estado pudo cambiar).
  const accion = useCallback(async (fn) => {
    setOcupado(true); setError(null);
    const r = await ejecutar(fn);
    if (!r.ok) setError(r.error);
    await recargar({ silencioso: true });
    setOcupado(false);
    return r;
  }, [recargar]);

  const api = useMemo(() => ({
    // Focus
    focusIniciar: p => accion(() => servicio.focusIniciar(p)),
    focusPausar: () => accion(() => servicio.focusPausar(inst?.id)),
    focusReanudar: () => accion(() => servicio.focusReanudar(inst?.id)),
    focusCompletar: () => accion(() => servicio.focusCompletar(inst?.id)),
    focusCancelar: () => accion(() => servicio.focusCancelar(inst?.id)),
    // Descansos
    descansoIniciar: p => accion(() => servicio.descansoIniciar(p)),
    descansoPausar: () => accion(() => servicio.descansoPausar(inst?.id)),
    descansoReanudar: () => accion(() => servicio.descansoReanudar(inst?.id)),
    descansoCompletar: () => accion(() => servicio.descansoCompletar(inst?.id)),
    descansoOmitir: p => accion(() => servicio.descansoOmitir(p)),
    descansoCancelar: () => accion(() => servicio.descansoCancelar(inst?.id)),
    // Hábitos
    habitoIniciar: id => accion(() => servicio.habitoIniciar(id)),
    habitoPausar: () => accion(() => servicio.habitoPausar(inst?.id)),
    habitoReanudar: () => accion(() => servicio.habitoReanudar(inst?.id)),
    habitoFinalizar: () => accion(() => servicio.habitoFinalizar(inst?.id)),
    habitoCancelar: () => accion(() => servicio.habitoCancelar(inst?.id)),
    guardarPreferencias: v => accion(() => servicio.guardarPreferencias(v)),
  }), [accion, servicio, inst]);

  const sugerido = useMemo(() => (activo || !datos ? null : descansoSugerido({ sesiones: datos.sesiones, descansos: datos.descansos, prefs: datos.prefs })), [activo, datos]);

  const valor = useMemo(() => ({
    servicio, cargando, error, noDisponible, ocupado, datos, inst, lectura, prefs, ahora, aviso, sugerido,
    activo, incompleto: !!inst?.incompleto,
    recargar, solicitarPermiso, cerrarAviso: () => setAviso(null), limpiarError: () => setError(null),
    ...api,
  }), [servicio, cargando, error, noDisponible, ocupado, datos, inst, lectura, prefs, ahora, aviso, sugerido, activo, recargar, solicitarPermiso, api]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTemporizador() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTemporizador debe usarse dentro de <TemporizadorProvider>');
  return v;
}
