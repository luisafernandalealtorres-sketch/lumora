import AppShell from '@/components/shell/AppShell';

// El shell (barra lateral, barra superior, barra inferior móvil) aloja las pantallas sin tocarlas.
// El menú anterior (components/Nav.js) queda sin uso como respaldo.
export default function AppLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
