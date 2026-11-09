'use client';
import Icon from '@/components/ui/Icon';
import { nombreFrenteActivo } from '@/lib/domain/frenteActivo';
import Desplegable from './Desplegable';
import FrenteSelector from './FrenteSelector';
import { useFrenteActivo } from './useFrenteActivo';
import estilos from './FrenteControl.module.css';

// Control de frente de la barra superior: muestra el frente activo (o "Todos") y abre el selector.
// Con un frente activo aparece además un botón para quitar el filtro.
// El filtro vive en la URL. Los módulos antiguos todavía no lo leen: el shell lo dice y no simula filtrado.
export default function FrenteControl() {
  const { frente, elegir, quitar, pantallaAplica } = useFrenteActivo();
  const nombre = nombreFrenteActivo(frente);

  return (
    <div className={estilos.grupo}>
      <Desplegable
        etiqueta={nombre ? `Frente: ${nombre}. Cambiar` : 'Frente: todos. Cambiar'}
        titulo="Frente"
        claseBoton={`${estilos.boton} ${nombre ? estilos.activo : ''}`}
        boton={<><Icon name="layers" size={16} /><span className={estilos.texto}>{nombre ?? 'Todos los frentes'}</span><Icon name="chevronDown" size={14} /></>}
      >
        {cerrar => (
          <div className={estilos.panel}>
            <FrenteSelector frente={frente} onElegir={id => { elegir(id); cerrar(); }} />
            <p className={estilos.nota} role="note">
              {pantallaAplica
                ? 'Esta pantalla muestra solo el frente elegido.'
                : 'Esta pantalla aún no aplica el filtro de frente: el contenido no cambia. El frente se guarda y se aplicará cuando se rediseñe.'}
            </p>
          </div>
        )}
      </Desplegable>
      {nombre && (
        <button type="button" className={estilos.quitar} onClick={quitar} aria-label={`Quitar filtro de ${nombre}`}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}
