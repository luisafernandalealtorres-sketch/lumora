import FocusPanel from '@/components/timer/FocusPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Focus' };

// Focus Mode y temporizadores (Fase 3). Toda la lectura y escritura pasa por el TemporizadorProvider del shell,
// que lee tablas (solo lectura) y llama a las RPC del SQL v1.11. No toca las tablas heredadas de Salud.
export default function Page() {
  return (
    <>
      <header>
        <div>
          <div className="date">Temporizador global</div>
          <h1>Focus</h1>
        </div>
      </header>
      <FocusPanel />
    </>
  );
}
