import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import { cop, mesActual, nombreMes, esNegocio, racha, CATEGORIAS } from '@/lib/format';
import { frenteDeSlug } from '@/lib/domain/frentesMap';
import Pantalla from '@/components/ui/Pantalla';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Icon from '@/components/ui/Icon';
import Ring from '@/components/ui/Ring';
import ProgressBar from '@/components/ui/ProgressBar';
import estilos from '@/components/panel/Panel.module.css';

export const dynamic = 'force-dynamic';

const SIN_REGISTROS = <span className={estilos.sinDatos}>Sin registros</span>;

function Baldosa({ icono, valor, etiqueta, ruta, ver }) {
  return (
    <li className={estilos.baldosa}>
      <Link href={ruta} className={estilos.enlace}>
        <span className={estilos.icono}><Icon name={icono} size={18} /></span>
        <b className={estilos.cifra}>{valor ?? SIN_REGISTROS}</b>
        <span className={estilos.etiqueta}>{etiqueta}</span>
        <span className={estilos.ver}>{ver}</span>
      </Link>
    </li>
  );
}

function BarrasFrente({ filas, fmt }) {
  const max = Math.max(...filas.map(f => f.valor), 1);
  return (
    <ul className={estilos.lista}>
      {filas.map(f => (
        <li className={estilos.item} key={f.slug}>
          <div className={estilos.fila}>
            <span className={estilos.nombre}><i className={estilos.punto} data-frente={f.frente} />{f.nombre}</span>
            <span className={estilos.valor}>{fmt(f.valor)}</span>
          </div>
          <ProgressBar valor={f.valor / max} tono={f.frente} etiqueta={`${f.nombre}: ${fmt(f.valor)}`} tamano="sm" />
        </li>
      ))}
    </ul>
  );
}

export default async function Panel() {
  const supabase = createClient();
  const mes = mesActual();
  const hace7 = new Date(Date.now() - 7 * 864e5).toISOString();

  const [fr, pe, ga, jo, bi, no] = await Promise.all([
    supabase.from('frentes').select('*').order('orden'),
    supabase.from('pendientes').select('frente,hecho,hecho_en'),
    supabase.from('gastos').select('categoria,valor_cop,frente').gte('fecha', `${mes}-01`),
    supabase.from('jornadas').select('fecha,relato').order('fecha', { ascending: false }).limit(60),
    supabase.from('biblioteca').select('id', { count: 'exact', head: true }),
    supabase.from('notas').select('frente'),
  ]);

  verificar({ frentes: fr, pendientes: pe, gastos: ga, jornadas: jo, biblioteca: bi, notas: no });
  const frentes = fr.data ?? [];
  const pend = pe.data ?? [];
  const gastos = ga.data ?? [];
  const abiertos = pend.filter(p => !p.hecho).length;
  const cerrados7 = pend.filter(p => p.hecho && p.hecho_en && p.hecho_en >= hace7).length;
  const total = pend.length;
  const pct = total ? Math.round(((total - abiertos) / total) * 100) : 0;

  const gastoMes = gastos.reduce((s, g) => s + Number(g.valor_cop), 0);
  const negocio = gastos.filter(g => esNegocio(g.frente)).reduce((s, g) => s + Number(g.valor_cop), 0);
  const personal = gastoMes - negocio;
  const porCat = CATEGORIAS.map(c => ({
    nombre: c,
    valor: gastos.filter(g => g.categoria === c).reduce((s, g) => s + Number(g.valor_cop), 0),
  })).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor);

  const porFrente = frentes.map(f => {
    const l = pend.filter(p => p.frente === f.slug);
    return { slug: f.slug, frente: frenteDeSlug(f.slug).id, nombre: f.nombre, total: l.length, hechos: l.filter(p => p.hecho).length };
  }).filter(f => f.total > 0);

  const jornadas = jo.data ?? [];
  const conRelato = jornadas.filter(j => j.relato);
  const rachaDias = racha(conRelato.map(j => j.fecha));
  const notas = no.data ?? [];
  const notasPorFrente = frentes.map(f => ({
    slug: f.slug,
    frente: frenteDeSlug(f.slug).id,
    nombre: f.nombre,
    valor: notas.filter(n => n.frente === f.slug).length,
  })).filter(f => f.valor > 0);

  const enBiblioteca = bi.count ?? 0;
  const resumen = [
    total ? `${abiertos} ${abiertos === 1 ? 'pendiente abierto' : 'pendientes abiertos'}` : null,
    gastoMes ? `${cop(gastoMes)} de gasto` : null,
  ].filter(Boolean).join(' · ') || 'Sin registros este mes';

  return (
    <Pantalla fecha={nombreMes(mes)} titulo="Panel" resumen={resumen}>
      <div className={estilos.cifras}>
        <Card className={estilos.bloque} titulo="Avance general" icono="target">
          <div className={estilos.general}>
            <Ring valor={total ? pct / 100 : undefined} etiqueta="Avance general" tamano={128} grosor={12} />
            <div className={estilos.generalTexto}>
              {total ? (
                <>
                  <b>{total - abiertos} de {total}</b>
                  <span>pendientes cerrados</span>
                </>
              ) : <span>Sin datos: aún no hay pendientes.</span>}
            </div>
          </div>
        </Card>
        <ul className={estilos.baldosas}>
          <Baldosa icono="check" valor={total ? abiertos : null} etiqueta="pendientes abiertos" ruta="/" ver="Ver en Home" />
          <Baldosa icono="clock" valor={total ? cerrados7 : null} etiqueta="cerrados en 7 días" ruta="/" ver="Ver en Home" />
          <Baldosa icono="wallet" valor={gastoMes ? cop(gastoMes) : null} etiqueta="gasto del mes" ruta="/finanzas" ver="Ver Finanzas" />
          <Baldosa icono="flame" valor={conRelato.length ? rachaDias : null} etiqueta="días seguidos de jornada" ruta="/jornada" ver="Ver Jornada" />
          <Baldosa icono="library" valor={enBiblioteca || null} etiqueta="en la biblioteca" ruta="/biblioteca" ver="Ver Biblioteca" />
        </ul>
      </div>

      <div className={estilos.rejilla}>
        <div className={estilos.col}>
          <Card as="section" id="avance-frente" className={estilos.bloque} titulo="Avance por frente" icono="layers">
            {porFrente.length ? (
              <ul className={estilos.lista}>
                {porFrente.map(f => (
                  <li className={estilos.item} key={f.slug}>
                    <div className={estilos.fila}>
                      <span className={estilos.nombre}><i className={estilos.punto} data-frente={f.frente} />{f.nombre}</span>
                      <span className={estilos.valor}>{f.hechos} de {f.total}</span>
                    </div>
                    <ProgressBar valor={f.hechos / f.total} tono={f.frente} etiqueta={`Avance de ${f.nombre}`} tamano="sm" />
                  </li>
                ))}
              </ul>
            ) : <p className={estilos.vacio}>Sin registros. Agrega pendientes en Home para ver el avance de cada frente.</p>}
          </Card>
          <Card as="section" id="notas-frente" className={estilos.bloque} titulo="Notas por frente" icono="book">
            {notasPorFrente.length
              ? <BarrasFrente filas={notasPorFrente} fmt={v => `${v} ${v === 1 ? 'nota' : 'notas'}`} />
              : <p className={estilos.vacio}>Sin registros. Crea notas en Cerebro.</p>}
          </Card>
        </div>
        <div className={estilos.col}>
          <Card as="section" id="gasto-categoria" className={estilos.bloque} titulo="Gasto por categoría" icono="chart" accion={<span className={estilos.sub}>{nombreMes(mes)}</span>}>
            {porCat.length ? (
              <>
                <ul className={estilos.top}>
                  {porCat.slice(0, 3).map(c => <li key={c.nombre}><Chip tono="primario">{c.nombre} · {cop(c.valor)}</Chip></li>)}
                </ul>
                <ul className={estilos.lista}>
                  {porCat.map(c => (
                    <li className={estilos.item} key={c.nombre}>
                      <div className={estilos.fila}>
                        <span className={estilos.nombre}>{c.nombre}</span>
                        <span className={estilos.valor}>{cop(c.valor)}</span>
                      </div>
                      <ProgressBar valor={c.valor / porCat[0].valor} etiqueta={`${c.nombre}: ${cop(c.valor)}`} tamano="sm" />
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className={estilos.vacio}>Sin registros. Anota tus gastos en Finanzas.</p>}
          </Card>
          <Card as="section" id="negocio-personal" className={estilos.bloque} titulo="Negocio y personal" icono="briefcase">
            {gastoMes ? (
              <>
                <div className={estilos.apilada} role="img" aria-label={`Negocio ${cop(negocio)}, personal ${cop(personal)}`}>
                  <span className={estilos.tramoNegocio} style={{ width: `${(negocio / gastoMes) * 100}%` }} />
                  <span className={estilos.tramoPersonal} style={{ width: `${(personal / gastoMes) * 100}%` }} />
                </div>
                <ul className={estilos.leyenda}>
                  <li><span className={`${estilos.marca} ${estilos.marcaNegocio}`}><i />Negocio</span><span className={estilos.valor}>{cop(negocio)}</span></li>
                  <li><span className={`${estilos.marca} ${estilos.marcaPersonal}`}><i />Personal</span><span className={estilos.valor}>{cop(personal)}</span></li>
                </ul>
              </>
            ) : <p className={estilos.vacio}>Sin datos. Se calcula con tus gastos del mes.</p>}
          </Card>
        </div>
      </div>
    </Pantalla>
  );
}
