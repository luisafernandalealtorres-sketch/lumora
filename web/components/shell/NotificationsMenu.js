'use client';
import Icon from '@/components/ui/Icon';
import Desplegable from './Desplegable';
import estilos from './NotificationsMenu.module.css';

// Notificaciones: SOLO visuales en la Fase 2. No hay origen de datos, así que no hay contador ni insignia.
// Las alertas reales por reglas (vencimientos, presupuesto…) se conectan en la Fase 5.
export default function NotificationsMenu() {
  return (
    <Desplegable etiqueta="Notificaciones" titulo="Notificaciones" boton={<Icon name="bell" size={18} />}>
      <div className={estilos.contenido}>
        <p className={estilos.titulo}>Notificaciones</p>
        <p className={estilos.vacio}>Aún no hay notificaciones.</p>
        <p className={estilos.nota}>
          Aquí verás alertas por reglas, como vencimientos o presupuesto, cuando se activen. Todavía no están conectadas.
        </p>
      </div>
    </Desplegable>
  );
}
