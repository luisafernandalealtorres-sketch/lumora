'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useTemporizador } from './TemporizadorProvider';
import Controles from './Controles';
import { formatoReloj, ETIQUETA_TIPO } from '@/lib/domain/temporizador';
import estilos from './Timer.module.css';

/**
 * Componente compacto y persistente (§4.5): visible en todas las pantallas mientras haya un temporizador activo
 * o un aviso pendiente. Vive en el shell, por eso no se pierde al cambiar de ruta. En /focus no se repite (la página
 * ya muestra el temporizador completo), pero el aviso de meta sí se sigue mostrando.
 */
export default function MiniTemporizador() {
  const t = useTemporizador();
  const ruta = usePathname();
  const { inst, lectura, aviso, error, incompleto } = t;
  const enFocus = ruta === '/focus';
  const hayError = error && error.codigo !== 'fase3_no_disponible';

  if (!inst && !aviso && !hayError) return null;
  if (enFocus && !aviso) return null;

  const valor = lectura ? (inst.cuentaAtras && lectura.restanteS !== null ? lectura.restanteS : lectura.transcurridoS) : null;
  const etiqueta = inst && !incompleto
    ? `${ETIQUETA_TIPO[inst.tipo]}${inst.titulo ? ` · ${inst.titulo}` : ''}${inst.pausado ? ' · en pausa' : ''}`
    : null;

  return (
    <div className={estilos.mini} data-tipo={inst?.tipo ?? 'aviso'}>
      {aviso && (
        <div className={estilos.aviso} role="status">
          <span><b>{aviso.mensaje}.</b> Revisa el temporizador y decide cómo cerrarlo.
            {aviso.sonidoBloqueado && ' El navegador no permitió reproducir el sonido.'}
            {aviso.notificacionBloqueada && ' Las notificaciones del navegador no están permitidas: este aviso se muestra solo aquí.'}
          </span>
          <span className={estilos.avisoAcciones}>
            {aviso.notificacionBloqueada && typeof Notification !== 'undefined' && Notification.permission === 'default' && (
              <button type="button" className={estilos.boton} onClick={t.solicitarPermiso}>Permitir notificaciones</button>
            )}
            <button type="button" className={estilos.boton} onClick={t.cerrarAviso}>Entendido</button>
          </span>
        </div>
      )}
      {hayError && (
        <div className={`${estilos.aviso} ${estilos.avisoError}`} role="alert">
          <span>{error.mensaje}</span>
          <button type="button" className={estilos.boton} onClick={t.limpiarError}>Cerrar</button>
        </div>
      )}
      {inst && !enFocus && (
        incompleto ? (
          <div className={estilos.fila}><span>Hay un temporizador activo pero no se pudo leer su detalle.</span>
            <button type="button" className={estilos.boton} onClick={() => t.recargar()}>Reintentar</button></div>
        ) : (
          <div className={estilos.fila}>
            <Link href="/focus" className={estilos.enlace} aria-label={`Abrir temporizador: ${etiqueta}`}>
              <Icon name={inst.tipo === 'descanso' ? 'sun' : inst.tipo === 'habito' ? 'heart' : 'bolt'} size={18} />
              <span className={estilos.etiqueta}>{etiqueta}</span>
              <span className={estilos.reloj} aria-hidden="true">{formatoReloj(valor)}</span>
            </Link>
            <Controles compacto />
          </div>
        )
      )}
    </div>
  );
}
