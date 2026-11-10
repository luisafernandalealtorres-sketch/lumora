import HabitosPanel from '@/components/habitos/HabitosPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hábitos' };

// Hábitos nuevos (Fase 3, etapa 3 del SQL v1.11). Independiente de Salud: no toca `habitos` ni `habito_registros`.
export default function Page() {
  return (
    <>
      <header><div><div className="date">Hábitos nuevos</div><h1>Hábitos</h1></div></header>
      <HabitosPanel />
    </>
  );
}
