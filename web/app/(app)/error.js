'use client';

export default function Error({ error, reset }) {
  return (
    <section role="alert" style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
      <h2>No pudimos cargar esta pantalla</h2>
      <p className="sub">
        Hubo un problema al consultar tus datos. Tus datos no se perdieron: esto es un error de lectura, no una pantalla vacía.
      </p>
      {error?.digest && <p className="sub">Código del error: {error.digest}</p>}
      <button className="btn" onClick={() => reset()}>Reintentar</button>
    </section>
  );
}
