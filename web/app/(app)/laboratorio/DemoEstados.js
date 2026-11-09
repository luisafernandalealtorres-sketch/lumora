'use client';
import { useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import EstadoDatos from '@/components/ui/EstadoDatos';
import Ring from '@/components/ui/Ring';
import Sparkline from '@/components/ui/Sparkline';
import estilos from './laboratorio.module.css';

// Demostración interactiva de los cinco estados de datos.
// El "reintento" es simulado con un temporizador: no hay consultas ni escrituras a ningún servicio.
const ESTADOS = [['ok', 'Ok'], ['cargando', 'Cargando'], ['vacio', 'Vacío'], ['error', 'Error'], ['parcial', 'Parcial']];

export default function DemoEstados() {
  const [estado, setEstado] = useState('ok');
  const [reintentos, setReintentos] = useState(0);
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function reintentar() {
    setReintentos(n => n + 1);
    setEstado('cargando');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado('ok'), 1200);
  }

  return (
    <div className={estilos.demoEstados}>
      <div className={estilos.fila} role="group" aria-label="Estado que se muestra">
        {ESTADOS.map(([e, nombre]) => (
          <button
            key={e}
            type="button"
            className={`${estilos.botonDemo} ${estado === e ? estilos.botonDemoActivo : ''}`}
            aria-pressed={estado === e}
            onClick={() => { clearTimeout(temporizador.current); setEstado(e); }}
          >
            {nombre}
          </button>
        ))}
      </div>
      <p className={estilos.texto2}>
        Reintentos simulados: <strong>{reintentos}</strong>. En "Error", el botón Reintentar pasa por "Cargando" y vuelve a "Ok". No hay ninguna consulta real.
      </p>
      <Card titulo="Ejemplo de widget" nivel={3} icono="chart">
        <EstadoDatos estado={estado} onReintentar={reintentar} aviso="Ejemplo: faltan los datos de un mes para completar esta vista.">
          <div className={estilos.contenidoDemo}>
            <Ring valor={0.78} etiqueta="Ejemplo de avance" tamano={72} grosor={8} />
            <Sparkline puntos={[2, 3, 5, 4, 7, 8]} etiqueta="Ejemplo de tendencia" tono="exito" ancho={160} />
          </div>
        </EstadoDatos>
      </Card>
    </div>
  );
}
