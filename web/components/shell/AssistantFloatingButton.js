'use client';
import Icon from '@/components/ui/Icon';
import { useShell } from './ShellProvider';
import estilos from './AssistantFloatingButton.module.css';

// Acceso flotante al asistente. Es independiente de la navegación principal y está siempre disponible,
// en escritorio y en móvil (en móvil queda sobre la barra inferior).
export default function AssistantFloatingButton() {
  const { asistenteAbierto, alternarAsistente } = useShell();
  return (
    <button
      type="button"
      className={`${estilos.boton} ${asistenteAbierto ? estilos.abierto : ''}`}
      onClick={alternarAsistente}
      aria-expanded={asistenteAbierto}
      aria-controls="panel-asistente"
      aria-label={asistenteAbierto ? 'Cerrar el asistente' : 'Abrir el asistente'}
      data-asistente-boton
    >
      <Icon name={asistenteAbierto ? 'x' : 'sparkles'} size={22} />
    </button>
  );
}
