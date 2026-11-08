import './globals.css';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700'] });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata = { title: 'Cerebro de Lu', description: 'Mi día, pendientes y avance por frente.' };

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
