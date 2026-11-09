'use client';
import Icon from './Icon';
import estilos from './ErrorState.module.css';

// Estado de error: algo falló al leer o procesar. Se anuncia a los lectores de pantalla (role="alert").
// Es visual y semánticamente distinto del vacío: un error NUNCA debe mostrarse como "sin datos".
// - `onReintentar`: si se da, aparece el botón de reintento (operable con teclado, foco visible).
// - `detalle`: texto técnico opcional, plegado, para quien necesite el detalle.
export default function ErrorState({
  titulo = 'No pudimos cargar esta información',
  mensaje = 'Hubo un problema al consultar los datos. No significa que estén vacíos.',
  detalle,
  onReintentar,
  textoReintentar = 'Reintentar',
  compacto = false,
  className,
}) {
  const clases = [estilos.error, compacto ? estilos.compacto : '', className].filter(Boolean).join(' ');
  return (
    <div className={clases} role="alert">
      <span className={estilos.icono} aria-hidden="true">
        <Icon name="alert" size={compacto ? 18 : 22} />
      </span>
      <div className={estilos.texto}>
        <p className={estilos.titulo}>{titulo}</p>
        <p className={estilos.mensaje}>{mensaje}</p>
        {detalle && (
          <details className={estilos.detalle}>
            <summary>Detalle técnico</summary>
            <code>{detalle}</code>
          </details>
        )}
      </div>
      {onReintentar && (
        <button type="button" className={estilos.boton} onClick={onReintentar}>
          {textoReintentar}
        </button>
      )}
    </div>
  );
}
