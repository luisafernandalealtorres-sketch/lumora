import { notFound } from 'next/navigation';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Icon from '@/components/ui/Icon';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import ProgressBar from '@/components/ui/ProgressBar';
import Ring from '@/components/ui/Ring';
import Sparkline from '@/components/ui/Sparkline';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { estadoDeConsulta } from '@/lib/ui/estados';
import { crearIndicador, aFraccion } from '@/lib/domain/indicadores';
import { fechaBogota, horaBogota, saludo, etiquetaFecha } from '@/lib/domain/fechas';
import { NOMBRES_ICONOS } from '@/components/ui/icons';
import { ESTADOS_ASISTENTE, IDS_ESTADOS } from '@/lib/domain/asistente';
import TemaActivo from './TemaActivo';
import DemoEstados from './DemoEstados';
import {
  AVISO_DEMO, BARRAS_DEMO, BARRAS_FRENTES_DEMO, SLUGS_FRENTES, SLUG_DESCONOCIDO_DEMO,
  ANILLOS_DEMO, ANILLOS_FRENTES_DEMO, SERIES_DEMO, CASOS_ESTADO_DEMO, INDICADORES_DEMO,
} from './demo';

const TONO_ASISTENTE = { neutral: 'neutro', success: 'exito', info: 'primario', warning: 'advertencia', danger: 'peligro' };
const TONO_ESTADO_INDICADOR = { ok: 'exito', parcial: 'advertencia', 'sin-datos': 'neutro', error: 'peligro' };
import estilos from './laboratorio.module.css';

// LABORATORIO DE DISEÑO. Solo desarrollo.
// - En la compilación de producción responde 404.
// - No consulta ni escribe en Supabase y no muestra datos reales. Todo lo que ves son muestras estáticas.
// - Exige sesión, igual que el resto de la app (lo hace el middleware).
export const dynamic = 'force-dynamic';

const NEUTROS = [
  ['--ds-bg', 'Fondo'], ['--ds-bg-2', 'Fondo secundario'], ['--ds-surface', 'Superficie'], ['--ds-surface-raised', 'Superficie elevada'],
  ['--ds-text', 'Texto'], ['--ds-text-2', 'Texto secundario'], ['--ds-border-strong', 'Borde de control'], ['--ds-focus', 'Foco'],
];
const ACENTOS = [
  ['--ds-primary', 'Primario'], ['--ds-on-primary', 'Sobre primario'], ['--ds-secondary', 'Secundario'],
  ['--ds-success', 'Éxito'], ['--ds-warning', 'Advertencia'], ['--ds-danger', 'Error'],
];
const TONOS_ESTADO = [
  ['neutro', 'Neutro'], ['primario', 'Primario'], ['exito', 'Éxito'], ['advertencia', 'Advertencia'], ['peligro', 'Error'],
];

function Muestras({ lista }) {
  return (
    <div className={estilos.muestras}>
      {lista.map(([token, nombre]) => (
        <div className={estilos.muestra} key={token}>
          <div className={estilos.color} style={{ background: `var(${token})` }} />
          <div className={estilos.nombre}>{nombre}</div>
          <code className={estilos.token}>{token}</code>
        </div>
      ))}
    </div>
  );
}

function Seccion({ id, titulo, children }) {
  return (
    <section className={estilos.seccion} aria-labelledby={id}>
      <h2 className={estilos.h2} id={id}>{titulo}</h2>
      {children}
    </section>
  );
}

export default function Laboratorio() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div className={estilos.pagina}>
      <div className={estilos.aviso} role="note">
        Laboratorio de diseño: solo desarrollo. Son muestras estáticas, no datos reales, y esta página no consulta Supabase.
      </div>

      <h1 className={estilos.h1}>Laboratorio</h1>

      <Seccion id="lab-tema" titulo="Tema">
        <p className={estilos.texto2}>Elige claro, oscuro o sistema. La preferencia se recuerda en este navegador.</p>
        <div className={estilos.fila}>
          <ThemeToggle />
          <TemaActivo />
        </div>
      </Seccion>

      <Seccion id="lab-neutros" titulo="Neutros">
        <Muestras lista={NEUTROS} />
      </Seccion>

      <Seccion id="lab-acentos" titulo="Acentos y estados">
        <Muestras lista={ACENTOS} />
      </Seccion>

      <Seccion id="lab-iconos" titulo={`Iconos (${NOMBRES_ICONOS.length})`}>
        <p className={estilos.texto2}>Conjunto propio en SVG, sin librería. Heredan el color del texto que los rodea.</p>
        <div className={estilos.iconos}>
          {NOMBRES_ICONOS.map(n => (
            <div className={estilos.celdaIcono} key={n}>
              <Icon name={n} size={24} />
              <code className={estilos.token}>{n}</code>
            </div>
          ))}
        </div>
        <p className={estilos.texto2}>Tamaños (16, 20, 24 y 32 px), con colores de texto, de acento y de estado:</p>
        <div className={estilos.fila}>
          <Icon name="sparkles" size={16} /><Icon name="sparkles" size={20} /><Icon name="sparkles" size={24} /><Icon name="sparkles" size={32} />
          <span className={estilos.icoPrimario}><Icon name="heart" size={24} /></span>
          <span className={estilos.icoExito}><Icon name="check" size={24} /></span>
          <span className={estilos.icoAdvertencia}><Icon name="alert" size={24} /></span>
          <span className={estilos.icoPeligro}><Icon name="x" size={24} /></span>
        </div>
        <p className={estilos.texto2}>
          Sin título es decorativo y se oculta a los lectores de pantalla. Con título se anuncia:{' '}
          <Icon name="bell" size={20} title="Notificaciones" />
        </p>
      </Seccion>

      <Seccion id="lab-tarjetas" titulo="Tarjetas">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <div className={estilos.tarjetas}>
          <Card as="section" id="demo-card-1" titulo="Ejemplo con icono y acción" icono="target" nivel={3} accion={<Chip tono="primario" tamano="sm">Acción</Chip>}>
            <p className={estilos.parrafo}>Tarjeta elevada: borde, sombra suave y encabezado. El título nombra la región.</p>
          </Card>
          <Card as="article" id="demo-card-2" titulo="Ejemplo plana" variante="plana" nivel={3}>
            <p className={estilos.parrafo}>Variante plana, sin sombra. Sirve para agrupar dentro de otra tarjeta.</p>
          </Card>
          <Card titulo="Ejemplo con relleno pequeño" relleno="sm" nivel={3}>
            <p className={estilos.parrafo}>Relleno compacto para listas densas.</p>
          </Card>
          <Card relleno="ninguno">
            <p className={estilos.parrafo}>Sin encabezado y sin relleno: el contenido manda.</p>
          </Card>
          <Card as="section" id="demo-card-5" titulo="Ejemplo con un título muy largo que debe partirse en varias líneas sin desbordar la tarjeta" icono="layers" nivel={3} accion={<Chip tono="neutro" tamano="sm">Ejemplo</Chip>}>
            <p className={estilos.parrafo}>Prueba de texto largo: nada se corta ni empuja el ancho de la página.</p>
          </Card>
        </div>
      </Seccion>

      <Seccion id="lab-chips" titulo="Chips">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <p className={estilos.texto2}>Estados:</p>
        <div className={estilos.fila}>
          {TONOS_ESTADO.map(([t, n]) => <Chip key={t} tono={t}>{n}</Chip>)}
        </div>
        <p className={estilos.texto2}>Tamaños y con icono:</p>
        <div className={estilos.fila}>
          <Chip tono="primario" tamano="md">Mediano</Chip>
          <Chip tono="primario" tamano="sm">Pequeño</Chip>
          <Chip tono="exito" icono="check">Con icono</Chip>
          <Chip tono="advertencia" icono="alert" tamano="sm">Con icono pequeño</Chip>
          <Chip tono="peligro" icono="x">Error</Chip>
        </div>
        <p className={estilos.texto2}>
          Frentes, traducidos desde el slug original de la base. Los colores de los seis frentes son una{' '}
          <strong>propuesta, no definitiva</strong>:
        </p>
        <div className={estilos.listaFrentes}>
          {SLUGS_FRENTES.map(s => (
            <div className={estilos.filaFrente} key={s}>
              <Chip frente={s} />
              <code className={estilos.token}>{s}</code>
            </div>
          ))}
          <div className={estilos.filaFrente}>
            <Chip frente={SLUG_DESCONOCIDO_DEMO} />
            <code className={estilos.token}>{SLUG_DESCONOCIDO_DEMO} (no está en el mapa: queda neutro)</code>
          </div>
        </div>
      </Seccion>

      <Seccion id="lab-barras" titulo="Barras de progreso">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <p className={estilos.texto2}>
          Un valor ausente o inválido se muestra como <strong>Sin datos</strong> (pista rayada), nunca como 0 %. Un cero real sí es 0 %.
        </p>
        <div className={estilos.barras}>
          {BARRAS_DEMO.map(b => (
            <div className={estilos.barraFila} key={b.etiqueta}>
              <span className={estilos.barraEtiqueta}>{b.etiqueta}</span>
              <ProgressBar valor={b.valor} etiqueta={b.etiqueta} tono={b.tono} mostrarValor />
            </div>
          ))}
        </div>
        <p className={estilos.texto2}>Una barra por frente de diseño (colores propuestos), tamaño pequeño:</p>
        <div className={estilos.barras}>
          {BARRAS_FRENTES_DEMO.map(b => (
            <div className={estilos.barraFila} key={b.etiqueta}>
              <span className={estilos.barraEtiqueta}>{b.etiqueta}</span>
              <ProgressBar valor={b.valor} etiqueta={b.etiqueta} tono={b.tono} tamano="sm" mostrarValor />
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion id="lab-anillos" titulo="Anillos de progreso">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <p className={estilos.texto2}>
          Base de Life Pulse. Un valor ausente o inválido muestra un anillo discontinuo y "—", nunca un porcentaje inventado.
        </p>
        <div className={estilos.anillos}>
          {ANILLOS_DEMO.map(a => (
            <div className={estilos.celdaAnillo} key={a.etiqueta}>
              <Ring valor={a.valor} etiqueta={a.etiqueta} tono={a.tono} />
              <span className={estilos.etiquetaCelda}>{a.etiqueta}</span>
            </div>
          ))}
        </div>
        <p className={estilos.texto2}>Tamaños (56, 80 y 128 px) y contenido propio en el centro:</p>
        <div className={estilos.fila}>
          <Ring valor={0.62} etiqueta="Ejemplo pequeño" tamano={56} grosor={6} />
          <Ring valor={0.62} etiqueta="Ejemplo mediano" tamano={80} grosor={8} />
          <Ring valor={0.62} etiqueta="Ejemplo grande" tamano={128} grosor={12}>
            <span>5/7</span>
          </Ring>
        </div>
        <p className={estilos.texto2}>Un anillo por frente de diseño (colores propuestos, no definitivos):</p>
        <div className={estilos.anillos}>
          {ANILLOS_FRENTES_DEMO.map(a => (
            <div className={estilos.celdaAnillo} key={a.etiqueta}>
              <Ring valor={a.valor} etiqueta={a.etiqueta} tono={a.tono} tamano={72} grosor={8} />
              <span className={estilos.etiquetaCelda}>{a.etiqueta}</span>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion id="lab-series" titulo="Minigráficas de tendencia">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <p className={estilos.texto2}>
          Solo cuentan los números finitos y nada se interpola. Con menos de dos valores válidos aparece "Datos insuficientes".
        </p>
        <div className={estilos.series}>
          {SERIES_DEMO.map(s => (
            <div className={estilos.celdaSerie} key={s.etiqueta}>
              <Sparkline puntos={s.puntos} etiqueta={s.etiqueta} tono={s.tono} meta={s.meta} ancho={180} alto={48} />
              <span className={estilos.etiquetaCelda}>{s.etiqueta}</span>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion id="lab-esqueletos" titulo="Esqueletos de carga">
        <p className={estilos.texto2}>
          Se anuncian una sola vez como "Cargando". El brillo se apaga con el movimiento reducido del sistema.
        </p>
        <div className={estilos.dosColumnas}>
          <Card titulo="Texto" nivel={3} relleno="sm"><Skeleton variante="texto" lineas={4} /></Card>
          <Card titulo="Bloque" nivel={3} relleno="sm"><Skeleton variante="bloque" alto={88} /></Card>
          <Card titulo="Círculo y línea" nivel={3} relleno="sm">
            <div className={estilos.fila}>
              <Skeleton variante="circulo" ancho={48} anunciar={false} />
              <Skeleton variante="linea" ancho={140} anunciar={false} />
            </div>
          </Card>
        </div>
      </Seccion>

      <Seccion id="lab-vacio" titulo="Estado vacío">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <p className={estilos.texto2}>
          Aún no hay nada que mostrar y todo funciona. Explica qué aparecerá y cómo agregar el primer dato. No es un error.
        </p>
        <div className={estilos.dosColumnas}>
          <Card relleno="sm">
            <EmptyState icono="target" titulo="Ejemplo: todavía no hay metas" descripcion="Cuando crees una, verás su avance aquí.">
              <Chip tono="primario">Acción de ejemplo</Chip>
            </EmptyState>
          </Card>
          <Card relleno="sm">
            <EmptyState compacto icono="calendar" titulo="Ejemplo compacto: sin eventos hoy" descripcion="Tu agenda aparecerá aquí." />
          </Card>
        </div>
      </Seccion>

      <Seccion id="lab-error" titulo="Estado de error">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <p className={estilos.texto2}>
          Algo falló al leer. Se anuncia a los lectores de pantalla y es distinto del vacío: nunca debe verse como "sin datos".
          El botón de reintento aparece en la demostración interactiva de abajo.
        </p>
        <div className={estilos.dosColumnas}>
          <ErrorState detalle="Ejemplo de detalle técnico: permission denied for table notas" />
          <ErrorState compacto titulo="Ejemplo compacto" mensaje="No se pudo actualizar este bloque." />
        </div>
      </Seccion>

      <Seccion id="lab-asistente" titulo="Estados del asistente">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <p className={estilos.texto2}>
          En el shell solo se alcanza "No conectado": la IA no está conectada y no hay respuestas simuladas. Los demás estados existen como lógica
          (<code>lib/domain/asistente.js</code>) y se muestran aquí para validarlos antes de conectar el asistente.
        </p>
        <div className={estilos.dosColumnas}>
          {IDS_ESTADOS.map(id => {
            const e = ESTADOS_ASISTENTE[id];
            return (
              <div key={id}>
                <Chip tono={TONO_ASISTENTE[e.tono]}>{e.etiqueta}</Chip>
                <p className={estilos.texto2}>{e.descripcion} {e.permiteEnviar ? 'Permite enviar.' : 'No permite enviar.'}</p>
              </div>
            );
          })}
        </div>
      </Seccion>

      <Seccion id="lab-estados" titulo="Los cinco estados de un widget">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <DemoEstados />
        <p className={estilos.texto2}>
          Cómo se deriva el estado de una consulta (función <code>estadoDeConsulta</code>). Un error nunca se convierte en vacío:
        </p>
        <div className={estilos.tablaEnvoltorio}>
          <table className={estilos.tabla}>
            <thead>
              <tr><th scope="col">Situación</th><th scope="col">Entrada</th><th scope="col">Estado</th></tr>
            </thead>
            <tbody>
              {CASOS_ESTADO_DEMO.map(c => (
                <tr key={c.descripcion}>
                  <td>{c.descripcion}</td>
                  <td><code className={estilos.codigo}>{JSON.stringify(c.entrada)}</code></td>
                  <td><Chip tono={{ cargando: 'primario', vacio: 'neutro', error: 'peligro', parcial: 'advertencia', ok: 'exito' }[estadoDeConsulta(c.entrada)]} tamano="sm">{estadoDeConsulta(c.entrada)}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion id="lab-indicadores" titulo="Contrato de indicador (Life Pulse)">
        <p className={estilos.aviso} role="note">{AVISO_DEMO}</p>
        <p className={estilos.texto2}>
          Cada indicador de área explica su fórmula y sus fuentes. Si la muestra no alcanza el mínimo, el valor es <strong>null</strong> y
          el anillo se dibuja como "sin datos". Un error nunca se presenta como "sin datos". Estas son las reglas del contrato, no las
          fórmulas reales (esas se aprueban en la Fase 3). No existe un indicador global de equilibrio personal.
        </p>
        <div className={estilos.indicadores}>
          {INDICADORES_DEMO.map(({ nota, ...entrada }) => {
            const ind = crearIndicador(entrada);
            return (
              <Card key={ind.id} relleno="sm" variante="plana">
                <div className={estilos.indicadorCuerpo}>
                  <Ring valor={aFraccion(ind)} etiqueta={`Ejemplo de ${ind.nombre}`} tamano={72} grosor={8} />
                  <div className={estilos.indicadorTexto}>
                    <div className={estilos.fila}>
                      <strong>{ind.nombre}</strong>
                      <Chip tono={TONO_ESTADO_INDICADOR[ind.estado]} tamano="sm">{ind.estado}</Chip>
                    </div>
                    <p className={estilos.indicadorMeta}>Muestra {ind.muestra} de {ind.minimo} necesarias · valor {ind.valor === null ? 'null' : ind.valor}</p>
                    <p className={estilos.indicadorMeta}>{nota}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Seccion>

      <Seccion id="lab-fechas" titulo="Fechas (hora de Bogotá)">
        <p className={estilos.texto2}>
          Calculadas con la zona de Colombia, sin depender de la zona del equipo. Esto es el reloj real, no un dato de demostración.
        </p>
        <p className={estilos.parrafo}>
          <strong>{saludo(horaBogota())}</strong> · {etiquetaFecha(fechaBogota())} · {fechaBogota()}
        </p>
      </Seccion>

      <Seccion id="lab-texto" titulo="Texto sobre superficies">
        <div className={estilos.superficies}>
          {[['--ds-bg', 'Fondo'], ['--ds-surface', 'Superficie'], ['--ds-surface-raised', 'Elevada']].map(([t, n]) => (
            <div key={t} className={estilos.caja} style={{ background: `var(${t})` }}>
              <p className={estilos.cajaTitulo}>{n}</p>
              <p className={estilos.cajaTexto}>Texto principal de ejemplo.</p>
              <p className={estilos.cajaTexto2}>Texto secundario de ejemplo.</p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion id="lab-grad" titulo="Degradado del encabezado">
        <p className={estilos.texto2}>Abstracto azul-violeta, sin imagen ni paisaje. Se usará en el encabezado de Home.</p>
        <div className={estilos.degradado}>
          <p className={estilos.degradadoTitulo}>Buenas tardes</p>
          <p className={estilos.degradadoTexto}>Texto principal sobre el degradado.</p>
        </div>
      </Seccion>
    </div>
  );
}
