import estilos from './Pantalla.module.css';

// Marco común de las pantallas: fondo ambiental + encabezado degradado.
// - `fecha`: línea pequeña sobre el título (por ejemplo el mes o la sección).
// - `titulo`: el único <h1> de la pantalla.
// - `resumen`: texto corto con datos reales; si no hay datos, no se pasa (nunca un cero decorativo).
// - `acciones`: contenido a la derecha del encabezado (un chip, un botón).
export default function Pantalla({ fecha, titulo, resumen, acciones, children }) {
  return (
    <div className={estilos.pantalla}>
      <header className={estilos.encabezado}>
        <div className={estilos.texto}>
          {fecha && <div className="date">{fecha}</div>}
          <h1>{titulo}</h1>
          {resumen && <p className={estilos.resumen}>{resumen}</p>}
        </div>
        {acciones && <div className={estilos.acciones}>{acciones}</div>}
      </header>
      {children}
    </div>
  );
}
