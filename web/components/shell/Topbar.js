'use client';
import { Suspense } from 'react';
import Icon from '@/components/ui/Icon';
import Breadcrumb from './Breadcrumb';
import UserMenu from './UserMenu';
import NotificationsMenu from './NotificationsMenu';
import FrenteControl from './FrenteControl';
import { useShell } from './ShellProvider';
import estilos from './Topbar.module.css';

// Barra superior contextual: migas de pan a la izquierda; búsqueda, frente, notificaciones y cuenta a la derecha.
export default function Topbar() {
  const { abrirBuscar } = useShell();
  return (
    <header className={estilos.barra}>
      <Breadcrumb />
      <div className={estilos.acciones}>
        <button type="button" className={estilos.buscar} onClick={abrirBuscar} aria-haspopup="dialog" aria-label="Buscar o ir a (Ctrl K)">
          <Icon name="search" size={16} />
          <span className={estilos.buscarTexto}>Buscar o ir a…</span>
          <kbd className={estilos.atajo} aria-hidden="true">Ctrl K</kbd>
        </button>
        <Suspense fallback={null}><FrenteControl /></Suspense>
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
