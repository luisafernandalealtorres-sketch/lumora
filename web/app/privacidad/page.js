// Política de privacidad pública de «Cerebro de Lu». Es una página de servidor, sin datos del usuario ni sesión.
// No incluye correos ni nombres: el contacto sale de CONTACTO_PRIVACIDAD (variable de entorno) y, si falta,
// remite al correo de asistencia que Google muestra en la pantalla de permisos.

export const metadata = { title: 'Política de privacidad · Cerebro de Lu' };

const ESTILO = { maxWidth: 720, margin: '0 auto', padding: '32px 16px 64px', lineHeight: 1.6 };

export default function Privacidad() {
  const contacto = process.env.CONTACTO_PRIVACIDAD;
  return (
    <main style={ESTILO}>
      <h1>Política de privacidad</h1>
      <p className="sub">Cerebro de Lu · Última actualización: 20 de noviembre de 2026</p>

      <h2>Qué es esta aplicación</h2>
      <p>
        Cerebro de Lu es una aplicación personal y de uso privado para organizar el día: pendientes, metas, gastos, hábitos,
        notas, jornada y agenda. Solo puede usarla la persona que la administra. No es un servicio público ni se ofrece a terceros.
      </p>

      <h2>Qué información usa</h2>
      <ul>
        <li><b>Cuenta de Google para iniciar sesión:</b> el correo y el nombre de la cuenta, solo para identificar a la persona autorizada.</li>
        <li>
          <b>Google Calendar (solo lectura):</b> cuando se conecta una cuenta de Google, la aplicación lee los eventos de los calendarios
          elegidos para mostrar la agenda de hoy y de mañana. Guarda únicamente el título, la hora de inicio y fin y un detalle corto de cada evento.
          No guarda la lista de invitados, enlaces de reunión ni archivos adjuntos, y no crea, cambia ni borra eventos.
        </li>
        <li><b>Datos que la propia persona escribe:</b> pendientes, gastos, notas, hábitos y similares.</li>
      </ul>

      <h2>Dónde se guarda y con quién se comparte</h2>
      <p>
        Los datos se guardan en una base de datos de Supabase protegida con acceso por usuario, y la aplicación se aloja en Vercel.
        Estos proveedores solo procesan la información para que la aplicación funcione. La información no se vende, no se usa para publicidad
        y no se comparte con otros terceros.
      </p>

      <h2>Uso limitado de la información de Google</h2>
      <p>
        El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google se ajustará a la
        Política de datos de usuario de los servicios de las API de Google, incluidos los requisitos de uso limitado.
        La información de Google Calendar solo se usa para mostrar la agenda dentro de esta aplicación. No se usa para entrenar modelos
        de inteligencia artificial generalizados ni para ningún otro fin.
      </p>

      <h2>Cuánto tiempo se conserva y cómo borrarla</h2>
      <ul>
        <li>Los eventos de la agenda se reemplazan en cada sincronización y se eliminan los de días anteriores.</li>
        <li>Al desconectar una cuenta, se eliminan sus credenciales y sus eventos guardados.</li>
        <li>
          En cualquier momento puedes retirar el acceso desde tu cuenta de Google, en
          {' '}<a href="https://myaccount.google.com/permissions" rel="noopener noreferrer">myaccount.google.com/permissions</a>.
        </li>
      </ul>

      <h2>Contacto</h2>
      <p>
        {contacto
          ? <>Para preguntas o solicitudes sobre esta política, escribe a <b>{contacto}</b>.</>
          : <>Para preguntas o solicitudes sobre esta política, usa el correo de asistencia que aparece en la pantalla de permisos de Google al conectar una cuenta.</>}
      </p>
    </main>
  );
}
