import '@/styles/shell.css';
import { ShellProvider } from './ShellProvider';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import MoreSheet from './MoreSheet';
import RouteEffects from './RouteEffects';
import estilos from './AppShell.module.css';

// Marco de la aplicación: barra lateral (escritorio y tablet), barra superior, barra inferior (móvil)
// y la columna de contenido, que aloja la pantalla tal cual (`.wrap` heredado, con su propio <h1>).
// Las rutas no cambian y las pantallas no se tocan.
export default function AppShell({ children }) {
  const desarrollo = process.env.NODE_ENV !== 'production';
  return (
    <ShellProvider>
      <div className={estilos.marco} data-shell>
        <a href="#contenido" className={estilos.salto}>Saltar al contenido</a>
        <Sidebar desarrollo={desarrollo} />
        <div className={estilos.columna}>
          <Topbar />
          <main id="contenido" tabIndex={-1} className={estilos.contenido}>
            <div className="wrap">{children}</div>
          </main>
        </div>
        <BottomNav desarrollo={desarrollo} />
        <MoreSheet desarrollo={desarrollo} />
        <RouteEffects />
      </div>
    </ShellProvider>
  );
}
