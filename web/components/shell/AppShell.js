import { Suspense } from 'react';
import '@/styles/shell.css';
import { ShellProvider } from './ShellProvider';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import MoreSheet from './MoreSheet';
import SearchPalette from './SearchPalette';
import RouteEffects from './RouteEffects';
import estilos from './AppShell.module.css';

// Marco de la aplicación: barra lateral (escritorio y tablet), barra superior, barra inferior (móvil),
// asistente flotante y la columna de contenido, que aloja la pantalla tal cual (`.wrap` heredado, con su propio <h1>).
// Las rutas no cambian y las pantallas no se tocan. Los componentes que leen el frente de la URL van dentro de <Suspense>.
export default function AppShell({ children }) {
  const desarrollo = process.env.NODE_ENV !== 'production';
  return (
    <ShellProvider>
      <div className={estilos.marco} data-shell>
        <a href="#contenido" className={estilos.salto}>Saltar al contenido</a>
        <Suspense fallback={null}><Sidebar desarrollo={desarrollo} /></Suspense>
        <div className={estilos.columna}>
          <Topbar />
          <main id="contenido" tabIndex={-1} className={estilos.contenido}>
            <div className="wrap">{children}</div>
          </main>
        </div>
        <Suspense fallback={null}>
          <BottomNav desarrollo={desarrollo} />
          <MoreSheet desarrollo={desarrollo} />
          <SearchPalette desarrollo={desarrollo} />
        </Suspense>
        <RouteEffects />
      </div>
    </ShellProvider>
  );
}
