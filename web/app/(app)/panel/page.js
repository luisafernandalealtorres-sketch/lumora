import { createClient } from '@/lib/supabase/server';
import { verificar } from '@/lib/consulta';
import { cop, hoyBogota, mesActual, nombreMes, esNegocio, racha, CATEGORIAS } from '@/lib/format';

export const dynamic = 'force-dynamic';

function Barras({ filas, fmt = v => v }) {
  const max = Math.max(...filas.map(f => f.valor), 1);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {filas.map(f => (
        <div className="avance" key={f.nombre}>
          <div className="row"><span>{f.nombre}</span><span className="sub money">{fmt(f.valor)}</span></div>
          <div className="bar"><i style={{ width: `${(f.valor / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
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
    supabase.from('jornadas').select('fecha').order('fecha', { ascending: false }).limit(60),
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
  const porCat = CATEGORIAS.map(c => ({
    nombre: c,
    valor: gastos.filter(g => g.categoria === c).reduce((s, g) => s + Number(g.valor_cop), 0),
  })).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor);

  const porFrente = frentes.map(f => {
    const l = pend.filter(p => p.frente === f.slug);
    return { nombre: f.nombre, total: l.length, hechos: l.filter(p => p.hecho).length };
  }).filter(f => f.total > 0);

  const rachaDias = racha((jo.data ?? []).map(j => j.fecha));
  const notasPorFrente = frentes.map(f => ({
    nombre: f.nombre,
    valor: (no.data ?? []).filter(n => n.frente === f.slug).length,
  })).filter(f => f.valor > 0);

  return (
    <>
      <header>
        <div>
          <div className="date">{nombreMes(mes)}</div>
          <h1>Panel</h1>
        </div>
      </header>

      <div className="grid">
        <div className="stat"><b>{abiertos}</b><span>pendientes abiertos</span></div>
        <div className="stat"><b>{cerrados7}</b><span>cerrados en 7 días</span></div>
        <div className="stat"><b>{pct}%</b><span>avance general</span></div>
        <div className="stat"><b className="money">{cop(gastoMes)}</b><span>gasto del mes</span></div>
        <div className="stat"><b>{rachaDias}</b><span>días seguidos de jornada</span></div>
        <div className="stat"><b>{bi.count ?? 0}</b><span>en la biblioteca</span></div>
      </div>

      <div className="cols">
        <div className="stack">
          <section>
            <h2>Avance por frente</h2>
            {porFrente.length ? (
              <div style={{ display: 'grid', gap: 14 }}>
                {porFrente.map(f => (
                  <div className="avance" key={f.nombre}>
                    <div className="row"><span>{f.nombre}</span><span className="sub">{f.hechos} de {f.total}</span></div>
                    <div className="bar"><i style={{ width: `${(f.hechos / f.total) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            ) : <p className="empty">Agrega pendientes en Home para ver el avance de cada frente.</p>}
          </section>
          <section>
            <h2>Notas por frente</h2>
            {notasPorFrente.length ? <Barras filas={notasPorFrente} /> : <p className="empty">Aún no hay notas. Créalas en Cerebro.</p>}
          </section>
        </div>
        <div className="stack">
          <section>
            <h2>Gasto por categoría <small>{nombreMes(mes)}</small></h2>
            {porCat.length ? <Barras filas={porCat} fmt={cop} /> : <p className="empty">Sin gastos este mes. Regístralos en Gastos.</p>}
          </section>
          <section>
            <h2>Negocio y personal</h2>
            {gastoMes ? (
              <Barras filas={[{ nombre: 'Negocio', valor: negocio }, { nombre: 'Personal', valor: gastoMes - negocio }]} fmt={cop} />
            ) : <p className="empty">Se calcula con tus gastos del mes.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
