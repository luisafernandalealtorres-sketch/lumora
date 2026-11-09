'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Chip from '@/components/ui/Chip';
import { migas } from '@/lib/domain/navegacion';
import { nombreFrenteActivo } from '@/lib/domain/frenteActivo';
import { estadoAsistente, puedeEnviar, ESTADO_INICIAL, FUTURO_ASISTENTE } from '@/lib/domain/asistente';
import { useShell } from './ShellProvider';
import { useDialogo } from './useDialogo';
import { useFrenteActivo } from './useFrenteActivo';
import estilos from './AssistantDrawer.module.css';

// Panel del asistente. La IA NO está conectada: no hay chat, respuestas ni acciones simuladas.
// Muestra el estado real ("No conectado"), el contexto actual (pantalla y frente) y lo que vendrá, marcado como pendiente.
// Escritorio: panel lateral que no bloquea la pantalla. Móvil: hoja modal.
export default function AssistantDrawer() {
  const { asistenteAbierto, cerrar } = useShell();
  const ruta = usePathname();
  const { frente } = useFrenteActivo();
  const panel = useRef(null);
  const [modal, setModal] = useState(false);
  const estado = estadoAsistente(ESTADO_INICIAL);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const act = () => setModal(mq.matches);
    act();
    mq.addEventListener('change', act);
    return () => mq.removeEventListener('change', act);
  }, []);

  // Móvil: diálogo modal con trampa de foco. Escritorio: no modal; Escape lo cierra y devuelve el foco al botón flotante.
  useDialogo(panel, asistenteAbierto && modal, cerrar);
  useEffect(() => {
    if (!asistenteAbierto || modal) return undefined;
    panel.current?.querySelector('button')?.focus();
    function tecla(e) {
      if (e.key === 'Escape' && panel.current?.contains(document.activeElement)) {
        cerrar();
        document.querySelector('[data-asistente-boton]')?.focus();
      }
    }
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [asistenteAbierto, modal, cerrar]);

  if (!asistenteAbierto) return null;

  const lugar = migas(ruta, { desarrollo: process.env.NODE_ENV !== 'production' }).map(m => m.nombre).join(' › ') || 'Cerebro de Lu';
  const nombreFrente = nombreFrenteActivo(frente) ?? 'Todos los frentes';

  return (
    <div className={`${estilos.contenedor} ${modal ? estilos.modal : ''}`} onMouseDown={e => { if (modal && e.target === e.currentTarget) cerrar(); }}>
      <aside
        id="panel-asistente"
        ref={panel}
        className={estilos.panel}
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal ? 'true' : undefined}
        aria-labelledby="asistente-titulo"
      >
        <div className={estilos.cabecera}>
          <span className={estilos.marca} aria-hidden="true"><Icon name="sparkles" size={18} /></span>
          <div className={estilos.titulos}>
            <h2 id="asistente-titulo" className={estilos.titulo}>Asistente</h2>
            <p className={estilos.sub}>Segundo cerebro</p>
          </div>
          <Chip tono="neutro" tamano="sm">{estado.etiqueta}</Chip>
          <button type="button" className={estilos.cerrar} onClick={cerrar} aria-label="Cerrar el asistente">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className={estilos.cuerpo}>
          <div className={estilos.contexto}>
            <p className={estilos.rotulo}>Contexto actual</p>
            <p className={estilos.dato}>{lugar}</p>
            <p className={estilos.dato}>{nombreFrente}</p>
          </div>

          <p className={estilos.texto}>
            El asistente todavía no está conectado. {estado.descripcion} Hasta entonces no responde mensajes ni ejecuta acciones.
          </p>

          <div>
            <p className={estilos.rotulo}>Cuando se conecte</p>
            <ul className={estilos.futuro}>
              {FUTURO_ASISTENTE.map(t => (
                <li key={t} className={estilos.punto}>
                  <span>{t}</span>
                  <Chip tono="neutro" tamano="sm">Pendiente</Chip>
                </li>
              ))}
            </ul>
          </div>

          <div className={estilos.compositor}>
            <label className={estilos.rotulo} htmlFor="asistente-mensaje">Mensaje</label>
            <textarea id="asistente-mensaje" className={estilos.campo} rows={3} disabled placeholder="Disponible cuando se conecte el asistente" />
            <button type="button" className={estilos.enviar} disabled={!puedeEnviar(ESTADO_INICIAL)}>Enviar</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
