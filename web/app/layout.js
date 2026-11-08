import '@/styles/tokens.css';
import './globals.css';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { SCRIPT_TEMA } from '@/lib/theme';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700'] });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata = { title: 'Cerebro de Lu', description: 'Mi día, pendientes y avance por frente.' };

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: el script de tema añade data-theme a <html> antes de hidratar.
    <html lang="es" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
