'use client';
import Breadcrumb from './Breadcrumb';
import UserMenu from './UserMenu';
import estilos from './Topbar.module.css';

// Barra superior contextual: migas de pan a la izquierda y cuenta a la derecha.
// Búsqueda, notificaciones y selector de frente entran en la subfase 2.3.
export default function Topbar() {
  return (
    <header className={estilos.barra}>
      <Breadcrumb />
      <div className={estilos.acciones}>
        <UserMenu />
      </div>
    </header>
  );
}
