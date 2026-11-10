'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useTemporizador } from './TemporizadorProvider';
import { mensajeCierreFocus } from '@/lib/domain/temporizador';
import estilos from './Timer.module.css';

const ETIQUETA_COMPLETAR = { focus: 'Completar', descanso: 'Terminar', habito: 'Finalizar' };

/**
 * Controles del temporizador activo (pausar/reanudar, completar/terminar/finalizar, cancelar con confirmación).
 * Despacha según el tipo. Muestra el resultado que decidió el servidor (completada / parcial / cancelada).
 */
export default function Controles({ compacto = false, onResultado }) {
  const t = useTemporizador();
  const [confirmando, setConfirmando] = useState(false);
  const { inst, ocupado } = t;
  if (!inst || inst.incompleto) return null;

  const pausar = () => (inst.tipo === 'focus' ? t.focusPausar() : inst.tipo === 'descanso' ? t.descansoPausar() : t.habitoPausar());
  const reanudar = () => (inst.tipo === 'focus' ? t.focusReanudar() : inst.tipo === 'descanso' ? t.descansoReanudar() : t.habitoReanudar());
  const cerrar = () => (inst.tipo === 'focus' ? t.focusCompletar() : inst.tipo === 'descanso' ? t.descansoCompletar() : t.habitoFinalizar());
  const cancelar = () => (inst.tipo === 'focus' ? t.focusCancelar() : inst.tipo === 'descanso' ? t.descansoCancelar() : t.habitoCancelar());

  async function alCerrar() {
    const r = await cerrar();
    if (r.ok && inst.tipo === 'focus') onResultado?.(mensajeCierreFocus(r.data));
  }
  async function alCancelar() {
    setConfirmando(false);
    const r = await cancelar();
    if (r.ok && inst.tipo === 'focus') onResultado?.(mensajeCierreFocus(r.data));
  }

  const cls = `${estilos.controles} ${compacto ? estilos.compacto : ''}`.trim();
  if (confirmando) {
    const aviso = inst.tipo === 'habito'
      ? '¿Cancelar? Se descarta solo el tramo en curso; los tramos ya cerrados se conservan.'
      : inst.tipo === 'focus' ? '¿Cancelar la sesión? Queda registrada como cancelada, sin punto.' : '¿Cancelar el descanso?';
    return (
      <div className={cls} role="group" aria-label="Confirmar cancelación">
        {!compacto && <span className={estilos.confirmaTexto}>{aviso}</span>}
        <button type="button" className={`${estilos.boton} ${estilos.peligro}`} onClick={alCancelar} disabled={ocupado}>Sí, cancelar</button>
        <button type="button" className={estilos.boton} onClick={() => setConfirmando(false)}>No</button>
      </div>
    );
  }
  return (
    <div className={cls} role="group" aria-label="Controles del temporizador">
      {inst.pausado
        ? <button type="button" className={`${estilos.boton} ${estilos.primario}`} onClick={reanudar} disabled={ocupado}><Icon name="arrowRight" size={16} />Reanudar</button>
        : <button type="button" className={estilos.boton} onClick={pausar} disabled={ocupado}>Pausar</button>}
      <button type="button" className={`${estilos.boton} ${inst.corriendo && t.lectura?.meta ? estilos.primario : ''}`.trim()} onClick={alCerrar} disabled={ocupado}>
        <Icon name="check" size={16} />{ETIQUETA_COMPLETAR[inst.tipo]}
      </button>
      <button type="button" className={estilos.boton} onClick={() => setConfirmando(true)} disabled={ocupado}>
        <Icon name="x" size={16} />Cancelar
      </button>
    </div>
  );
}
