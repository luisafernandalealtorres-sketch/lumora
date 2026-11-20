'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Pantalla from '@/components/ui/Pantalla';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Icon from '@/components/ui/Icon';
import { cuentasConEstado, mensajeGoogle } from '@/lib/domain/conexiones';
import { haceCuanto } from '@/lib/domain/agenda';
import estilos from './Conexiones.module.css';

const ESTADO = {
  conectada: { tono: 'exito', texto: 'Conectada' },
  sin_conectar: { tono: 'advertencia', texto: 'Sin conectar' },
  revocada: { tono: 'peligro', texto: 'Acceso retirado' },
  error: { tono: 'peligro', texto: 'Con error' },
};

export default function ConexionesPanel({ cuentas, fuentes, resultado, ahoraMs }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirmar, setConfirmar] = useState(null);
  const [error, setError] = useState('');
  const lista = cuentasConEstado({ cuentas, fuentes });
  const conectadas = lista.filter(c => c.estado === 'conectada').length;
  const mensaje = mensajeGoogle(resultado);

  async function desconectar(c) {
    setError('');
    const { error: e } = await supabase.rpc('google_desconectar', { p_cuenta_id: c.cuentaId });
    setConfirmar(null);
    if (e) return setError('No se pudo desconectar. Intenta de nuevo.');
    router.refresh();
  }

  return (
    <Pantalla fecha="Google" titulo="Conexiones"
      resumen={lista.length ? `${conectadas} de ${lista.length} ${lista.length === 1 ? 'cuenta conectada' : 'cuentas conectadas'}` : 'Aún no hay cuentas'}
      acciones={<a className={`${estilos.boton} ${estilos.primario}`} href="/api/google/conectar"><Icon name="plus" size={18} />Conectar cuenta</a>}>
      {mensaje && <p className={`${estilos.aviso} ${estilos[`t_${mensaje.tono}`]}`} role="status">{mensaje.texto}</p>}
      {error && <p className={estilos.error} role="alert">{error}</p>}

      {lista.length === 0 && (
        <Card className={estilos.bloque}>
          <p className={estilos.vacio}>Aún no hay cuentas de Google. Conecta una para que la agenda se sincronice sola, aunque tu computador esté apagado.</p>
        </Card>
      )}

      <ul className={estilos.lista}>
        {lista.map(c => {
          const e = ESTADO[c.estado] ?? ESTADO.error;
          return (
            <li key={c.email}>
              <Card as="article" className={estilos.bloque}>
                <div className={estilos.cabeza}>
                  <h2 className={estilos.correo}>{c.email}</h2>
                  <Chip tono={e.tono} tamano="sm">{e.texto}</Chip>
                </div>
                {c.error && <p className={estilos.sub}>Último error: {c.error}</p>}
                {c.conectadaEn && <p className={estilos.sub}>Conectada {haceCuanto(c.conectadaEn, ahoraMs)}</p>}

                {c.calendarios.length > 0 && (
                  <ul className={estilos.calendarios} aria-label={`Calendarios de ${c.email}`}>
                    {c.calendarios.map(k => (
                      <li key={k.id}>
                        <span className={estilos.nombre}>{k.nombre}</span>
                        {k.frente ? <Chip frente={k.frente} tamano="sm" /> : <Chip tono="neutro" tamano="sm">Sin asignar</Chip>}
                        <span className={estilos.sub}>
                          {k.estado === 'pendiente' ? 'pendiente de conectar'
                            : k.error ? `error: ${k.error}`
                            : k.ultimaSincronizacion ? `sincronizado ${haceCuanto(k.ultimaSincronizacion, ahoraMs)}` : 'sin sincronizar'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {confirmar === c.email ? (
                  <div className={estilos.confirmar} role="alertdialog" aria-label="Confirmar desconexión">
                    <p>¿Desconectar esta cuenta? Se borra el permiso guardado y los eventos que vinieron de ella. Para retirar también el acceso en Google, usa el enlace de abajo.</p>
                    <div className={estilos.acciones}>
                      <button type="button" className={`${estilos.boton} ${estilos.peligro}`} onClick={() => desconectar(c)}>Sí, desconectar</button>
                      <button type="button" className={estilos.boton} onClick={() => setConfirmar(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className={estilos.acciones}>
                    {c.estado !== 'conectada' && (
                      <a className={`${estilos.boton} ${estilos.primario}`} href={`/api/google/conectar?cuenta=${encodeURIComponent(c.email)}`}>
                        {c.estado === 'sin_conectar' ? 'Conectar' : 'Volver a conectar'}
                      </a>
                    )}
                    {c.cuentaId && (
                      <button type="button" className={`${estilos.boton} ${estilos.peligroSuave}`} onClick={() => setConfirmar(c.email)}>Desconectar</button>
                    )}
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <Card as="section" id="sobre-permisos" className={estilos.bloque} titulo="Qué permiso se pide" icono="info">
        <p className={estilos.sub}>
          Solo lectura de los eventos de tus calendarios, y el correo de la cuenta para identificarla. La app no crea, cambia ni borra eventos,
          no guarda invitados ni enlaces de reunión, y no toca tu correo. El permiso se guarda cifrado.
          Puedes retirarlo en cualquier momento en{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.
        </p>
        <p className={estilos.sub}>Google mostrará el aviso «no ha verificado esta app»: es esperado, la app es solo tuya. Elige «Configuración avanzada» y continúa.</p>
      </Card>
    </Pantalla>
  );
}
