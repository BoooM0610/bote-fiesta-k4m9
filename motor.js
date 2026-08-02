// Lógica compartida por la página pública y la de control.
const eur = n => new Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'}).format(n || 0);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const hoy = () => { const d = new Date(); return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'); };

function calc(S){
  const totalPresu = S.presupuesto.reduce((a,b) => a + (+b.importe||0), 0);
  const n = S.personas.length || 1;
  const exacta = totalPresu / n;
  const step = +S.redondeo || 0;
  const cuota = step ? Math.ceil(exacta/step)*step : Math.round(exacta*100)/100;

  const aportadoBote = S.aportaciones.reduce((a,b) => a + (+b.importe||0), 0);
  const gastosBote = S.gastos.filter(g => g.pagador === 'bote').reduce((a,b) => a + (+b.importe||0), 0);
  const gastosPersonales = S.gastos.filter(g => g.pagador !== 'bote').reduce((a,b) => a + (+b.importe||0), 0);
  const enBote = aportadoBote - gastosBote;
  const gastado = gastosBote + gastosPersonales;

  const porPersona = S.personas.map(p => {
    const alBote = S.aportaciones.filter(a => a.personaId === p.id).reduce((a,b) => a + (+b.importe||0), 0);
    const adelantado = S.gastos.filter(g => g.pagador === p.id).reduce((a,b) => a + (+b.importe||0), 0);
    const total = alBote + adelantado;
    return {...p, alBote, adelantado, total, saldo: total - cuota};
  });

  const falta = porPersona.reduce((a,p) => a + (p.saldo < -0.005 ? -p.saldo : 0), 0);
  const aFavor = porPersona.reduce((a,p) => a + (p.saldo > 0.005 ? p.saldo : 0), 0);
  const objetivo = cuota * n;
  const pct = objetivo ? Math.max(0, Math.min(100, Math.round((objetivo - falta) / objetivo * 100))) : 0;

  return {totalPresu, n, exacta, cuota, aportadoBote, gastosBote, gastosPersonales,
          enBote, gastado, pendiente: totalPresu - gastado, porPersona, falta, aFavor, objetivo, pct};
}

function nombreDe(S, id){ const p = S.personas.find(x => x.id === id); return p ? p.nombre : '(borrado)'; }

function estadoConcepto(S, concepto, importe){
  const pagado = S.gastos
    .filter(g => (g.concepto||'').trim().toLowerCase() === (concepto||'').trim().toLowerCase())
    .reduce((a,b) => a + (+b.importe||0), 0);
  if (pagado >= (+importe||0) - 0.005 && pagado > 0) return '<span class="pill ok">pagado</span>';
  if (pagado > 0) return '<span class="pill sobra">parcial</span>';
  return '<span class="tag">pendiente</span>';
}

function tarjetas(c){
  return `
  <div class="stat"><div class="lbl">Presupuesto</div><div class="val">${eur(c.totalPresu)}</div><div class="s">entre ${c.n} personas</div></div>
  <div class="stat hi"><div class="lbl">Cuota por cabeza</div><div class="val">${eur(c.cuota)}</div><div class="s">exacto ${eur(c.exacta)}</div></div>
  <div class="stat"><div class="lbl">Recaudado</div><div class="val">${eur(c.aportadoBote + c.gastosPersonales)}</div><div class="s">de ${eur(c.objetivo)}</div></div>
  <div class="stat"><div class="lbl">Queda en el bote</div><div class="val">${eur(c.enBote)}</div><div class="s">efectivo disponible</div></div>
  <div class="stat"><div class="lbl">Gastado</div><div class="val">${eur(c.gastado)}</div><div class="s">quedan ${eur(c.pendiente)} por pagar</div></div>
  <div class="stat"><div class="lbl">Falta por poner</div><div class="val" style="color:${c.falta>0.005?'var(--bad)':'var(--good)'}">${eur(c.falta)}</div><div class="s">${c.aFavor>0.005 ? 'a devolver: '+eur(c.aFavor) : 'nadie de sobra'}</div></div>`;
}

function pill(saldo){
  if (saldo < -0.005) return `<span class="pill debe">falta ${eur(-saldo)}</span>`;
  if (saldo > 0.005) return `<span class="pill sobra">+${eur(saldo)}</span>`;
  return `<span class="pill ok">al día</span>`;
}

async function cargarDatos(){
  const r = await fetch('datos.json?t=' + Date.now(), {cache: 'no-store'});
  if (!r.ok) throw new Error('No se pudo cargar datos.json');
  const S = await r.json();
  S.presupuesto = S.presupuesto || []; S.personas = S.personas || [];
  S.aportaciones = S.aportaciones || []; S.gastos = S.gastos || [];
  return S;
}

function fechaLegible(iso){
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('es-ES', {day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'});
}
