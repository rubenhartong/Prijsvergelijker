// Simpele invoerpagina. Bevat zelf geen data: alles gaat via /api met de API-sleutel
// (opgeslagen in localStorage van de browser).
export const ADMIN_HTML = /* html */ `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prijsvergelijker</title>
<style>
  :root { --bg:#fafaf8; --fg:#1d1d1b; --muted:#6b6b66; --line:#deddd6; --acc:#1f6f5c; --bad:#b3261e; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161615; --fg:#ecebe6; --muted:#9b9a93; --line:#33322f; --acc:#5fc2a6; --bad:#f2948c; } }
  * { box-sizing: border-box; }
  body { margin:0; padding:16px; font:15px/1.45 system-ui, sans-serif; background:var(--bg); color:var(--fg); max-width:1100px; margin-inline:auto; }
  h1 { font-size:1.4rem; margin:.2rem 0 1rem; } h2 { font-size:1.1rem; margin:1.6rem 0 .6rem; }
  input, select, button { font:inherit; padding:.35rem .5rem; border:1px solid var(--line); border-radius:6px; background:transparent; color:inherit; }
  button { background:var(--acc); color:var(--bg); border:0; cursor:pointer; }
  button.link { background:none; color:var(--acc); padding:0; }
  form { display:flex; flex-wrap:wrap; gap:.5rem; align-items:end; }
  label { display:flex; flex-direction:column; font-size:.8rem; color:var(--muted); gap:2px; }
  .wrap { overflow-x:auto; }
  table { border-collapse:collapse; width:100%; font-size:.9rem; }
  th, td { text-align:left; padding:.35rem .5rem; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; }
  td.url { max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .muted { color:var(--muted); } .bad { color:var(--bad); }
  #msg { min-height:1.4em; }
  td.fa { font-size:.85rem; border-bottom-style:dashed; }
  input { max-width:100%; } label.vol { flex:1 1 100%; } label.vol input { width:100%; }
  #zoek h3 { font-size:.85rem; color:var(--muted); font-weight:600; margin:1rem 0 .3rem; }
  .res { display:grid; grid-template-columns:1fr auto; gap:2px 12px; padding:.55rem 0; border-bottom:1px solid var(--line); }
  .res .pe { font-weight:700; text-align:right; white-space:nowrap; }
  .res .w { text-transform:uppercase; font-size:.75rem; letter-spacing:.04em; color:var(--muted); }
  .res .sub { grid-column:1 / -1; font-size:.85rem; color:var(--muted); }
  .res a { overflow-wrap:anywhere; }
</style>
</head>
<body>
<h1>Prijsvergelijker</h1>
<form id="keyform"><label>API-sleutel<input id="key" type="password" size="30" autocomplete="off"></label><button>Opslaan</button><span id="msg" class="muted"></span></form>

<h2>Zoeken</h2>
<form id="zoekform"><label class="vol">Artikel, merk of winkel<input id="q" type="search" placeholder="bv. sensodyne rapid, dreft, slimpie" autocomplete="off"></label></form>
<div id="zoek"></div>
<p id="zoekleeg" class="muted"></p>

<h2>Huishouden: Picnic of Action?</h2>
<p id="ronde" class="muted"></p>
<div class="wrap"><table id="huis"><thead><tr><th>Artikel</th><th>Picnic</th><th>Beste</th><th>Besparing / verpakking</th></tr></thead><tbody></tbody></table></div>

<h2>Samenvatting</h2>
<div class="wrap"><table id="sum"><thead><tr><th>Categorie</th><th>Beste nu</th><th>Picnic nu</th><th>Laagste 90 d</th><th>Gemiddeld 90 d</th></tr></thead><tbody></tbody></table></div>
<p id="fail" class="bad"></p>

<h2>Categorie toevoegen</h2>
<form id="catform">
  <label>Naam<input name="naam" required></label>
  <label>Eenheid<select name="eenheid">${['doekje','tablet','ml','liter','rol','wasbeurt','zak','meter','stuk'].map(e=>`<option value="${e}">${e === 'ml' ? 'ml (per 100 ml)' : e}</option>`).join('')}</select></label>
  <label>Groep<select name="groep"><option>drogisterij</option><option>huishouden</option></select></label>
  <label>Gelijkwaardig<input name="omschrijving" placeholder="bv. elk merk"></label>
  <label>Trefwoorden (folders)<input name="trefwoorden" placeholder="komma-gescheiden"></label>
  <label>Zoektermen (Picnic/AH)<input name="zoektermen" placeholder="komma-gescheiden"></label>
  <label>Benchmark €/eenheid<input name="benchmark_prijs" type="number" step="0.00001"></label>
  <button>Toevoegen</button>
</form>

<h2>Listing toevoegen</h2>
<form id="lform">
  <label>Categorie<select name="category_id" id="catsel"></select></label>
  <label>Winkel<select name="winkel">${['picnic','ah','plus','kruidvat','etos','action','hema','bol','amazon'].map(w=>`<option>${w}</option>`).join('')}</select></label>
  <label>Merk<input name="merk" required></label>
  <label>Productnaam<input name="productnaam" required size="30"></label>
  <label>URL<input name="url" type="url" required size="40"></label>
  <label>Eenheden per verpakking (stuks/ml/liter/rollen/wasbeurten/zakken/meter)<input name="stuks_per_verpakking" type="number" step="0.001" required></label>
  <label>Methode<select name="scrape_methode"><option>cloud</option><option>thuis</option></select></label>
  <button>Toevoegen</button>
</form>

<h2>Listings</h2>
<div class="wrap"><table id="lst"><thead><tr><th>#</th><th>Cat.</th><th>Winkel</th><th>Merk / product</th><th>Hoev.</th><th>Methode</th><th>Laatste</th><th>Actief</th></tr></thead><tbody></tbody></table></div>

<script>
const $ = (s) => document.querySelector(s);
let KEY = ''; try { KEY = localStorage.getItem('pv_key') || ''; } catch {}
$('#key').value = KEY;
const msg = (t, bad) => { $('#msg').textContent = t; $('#msg').className = bad ? 'bad' : 'muted'; };
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.fout || r.status);
  return j;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const eur = (n, d=3) => n == null ? '–' : '€' + Number(n).toFixed(d).replace('.', ',');
const cell = (o, d) => o ? '<a href="' + esc(o.url) + '" target="_blank" rel="noopener">' + eur(o.prijs_per_eenheid, d) + '</a> <span class="muted">' + esc(o.winkel) + ' · ' + esc(o.merk) + (o.actie_label ? ' · ' + esc(o.actie_label) : '') + '</span>' : '<span class="muted">–</span>';
let CATS = [];
const dec = (e) => e === 'ml' || e === 'liter' ? 2 : e === 'doekje' || e === 'tablet' ? 4 : 3;
const datumKort = (d) => d ? d.slice(8, 10) + '-' + d.slice(5, 7) : '';
const actieRegel = (a) => '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.winkel) + ': ' + esc(a.actie_label || 'actie') + '</a> <span class="muted">' + esc(a.titel) +
  (a.prijs ? ' · ' + (a.prijs_was ? eur(a.prijs_was, 2) + ' → ' : '') + eur(a.prijs, 2) : '') +
  (a.prijs_per_eenheid ? ' · <b>' + eur(a.prijs_per_eenheid, a.prijs_per_eenheid < 1 ? 3 : 2) + '</b>/eenheid' : '') +
  (a.geldig_van && a.geldig_van > new Date().toISOString().slice(0, 10) ? ' · vanaf ' + datumKort(a.geldig_van) : '') + (a.geldig_tot ? ' · t/m ' + datumKort(a.geldig_tot) : '') + '</span>';
async function load() {
  if (!KEY) { msg('Vul de API-sleutel in.'); return; }
  try {
    const [cats, lst, sum, huis] = await Promise.all([api('/api/categories'), api('/api/listings'), api('/api/summary'), api('/api/huishouden')]);
    const ar = huis.action_ronde;
    $('#ronde').innerHTML = (ar.loont ? '<b>Action-ronde loont:</b> ' : 'Action-ronde loont (nog) niet: ') + eur(ar.besparing_totaal, 2) + ' besparing (drempel ' + eur(huis.drempel, 2) + ')' + (ar.artikelen.length ? ' · ' + ar.artikelen.map(esc).join(', ') : '');
    const pp = (o, e) => o ? '<a href="' + esc(o.url) + '" target="_blank" rel="noopener">' + eur(o.prijs_per_eenheid, dec(e)) + '</a> <span class="muted">' + esc(o.winkel || '') + (o.prijs ? ' · ' + eur(o.prijs, 2) : '') + (o.actie_label ? ' · ' + esc(o.actie_label) : '') + (o.bron === 'folder' ? ' · folder' : '') + '</span>' : '<span class="muted">–</span>';
    $('#huis tbody').innerHTML = huis.artikelen.map((a) => '<tr><td>' + esc(a.naam) + '<br><span class="muted">' + esc(a.eenheid_label) + (a.gelijkwaardig ? ' · ' + esc(a.gelijkwaardig) : '') + '</span></td><td>' + pp(a.picnic && { ...a.picnic, winkel: 'picnic' }, a.eenheid) + '</td><td>' + pp(a.beste, a.eenheid) + '</td><td>' + (a.besparing_per_verpakking ? eur(a.besparing_per_verpakking, 2) : '<span class="muted">–</span>') + '</td></tr>').join('');
    CATS = cats;
    $('#catsel').innerHTML = cats.map((c) => '<option value="' + c.id + '">' + esc(c.naam) + '</option>').join('');
    const cn = Object.fromEntries(cats.map((c) => [c.id, c.naam]));
    let groepNu = null;
    $('#sum tbody').innerHTML = sum.categorieen.map((c) => {
      const kop = c.groep !== groepNu ? (groepNu = c.groep, '<tr><th colspan="5" style="padding-top:1rem">' + (c.groep === 'huishouden' ? 'Huishouden' : 'Drogisterij') + '</th></tr>') : '';
      const d = dec(c.eenheid);
      return kop + '<tr><td>' + esc(c.naam) + '<br><span class="muted">' + c.eenheid_label + '</span></td><td>' + cell(c.beste_nu, d) + '</td><td>' + cell(c.picnic_nu, d) +
        (c.picnic_vs_benchmark ? ' <span class="muted">(' + Math.round((c.picnic_vs_benchmark - 1) * 100) + '% t.o.v. benchmark)</span>' : '') +
        '</td><td>' + eur(c.benchmark.prijs_per_eenheid, d) + ' <span class="muted">' + esc(c.benchmark.winkel || c.benchmark.bron || '') + '</span></td><td>' +
        eur(c.gemiddelde_90d, d) + ' <span class="muted">(' + c.aantal_metingen_90d + ' metingen)</span>' +
        (c.picnic_vs_gemiddelde ? '<br><span class="muted">Picnic ' + (c.picnic_vs_gemiddelde < 1 ? '' : '+') + Math.round((c.picnic_vs_gemiddelde - 1) * 100) + '% t.o.v. gem.</span>' : '') + '</td></tr>' +
        ((c.folderacties || []).length ? '<tr><td></td><td colspan="4" class="fa">Folder: ' + c.folderacties.map(actieRegel).join('<br>') + '</td></tr>' : '');
    }).join('');
    $('#fail').textContent = sum.listings_3_dagen_fout.length ? '3 dagen op rij mislukt: ' + sum.listings_3_dagen_fout.map((l) => '#' + l.listing_id + ' ' + l.winkel + ' ' + l.productnaam).join('; ') : '';
    $('#lst tbody').innerHTML = lst.map((l) => '<tr><td>' + l.id + '</td><td>' + esc(cn[l.category_id]) + '</td><td>' + esc(l.winkel) + '</td><td>' + esc(l.merk) + ' – <a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.productnaam) + '</a></td><td>' + l.stuks_per_verpakking + '</td><td>' + l.scrape_methode + '</td><td>' +
      (l.laatste_datum ? (l.laatste_ok ? eur(l.laatste_prijs, 2) : '<span class="bad">fout</span>') + ' <span class="muted">' + l.laatste_datum + '</span>' : '<span class="muted">–</span>') +
      ' <button class="link" data-prijs="' + l.id + '" title="Prijs invoeren">✎</button>' +
      '</td><td><button class="link" data-id="' + l.id + '" data-a="' + (l.actief ? 0 : 1) + '">' + (l.actief ? 'ja' : 'nee') + '</button></td></tr>').join('');
    msg('Geladen.');
  } catch (e) { msg('Fout: ' + e.message, true); }
}
const EENH = { doekje: 'doekje', tablet: 'tablet', ml: '100 ml', liter: 'liter', rol: 'rol', wasbeurt: 'wasbeurt', zak: 'zak', meter: 'meter', stuk: 'stuk' };
let zoekTimer;
let VOORSTEL = {};
$('#zoek').onclick = async (e) => {
  const b = e.target.closest('button[data-volg]');
  if (!b) return;
  const v = VOORSTEL[b.dataset.volg];
  let n = v.eenheden_geschat;
  if (!n) {
    const a = prompt('Hoeveel ' + EENH[v.eenheid] + ' zitten er in "' + v.naam + '" (' + (v.hoeveelheid || '?') + ')?');
    n = a ? Number(a.replace(',', '.')) : 0;
    if (!(n > 0)) return;
  }
  try {
    await api('/api/listings', { method: 'POST', body: JSON.stringify({ category_id: v.category_id, winkel: v.winkel, merk: v.merk || v.naam.split(' ')[0], productnaam: v.naam + (v.hoeveelheid ? ' ' + v.hoeveelheid : ''), url: v.url, stuks_per_verpakking: n, scrape_methode: 'thuis' }) });
    msg('Gevolgd: ' + v.naam + ' (prijs volgt bij de volgende ronde)');
    zoekNu(); load();
  } catch (x) { msg('Fout: ' + x.message, true); }
};
async function zoekNu() {
  const q = $('#q').value.trim();
  if (q.length < 2) { $('#zoek').innerHTML = ''; $('#zoekleeg').textContent = ''; return; }
  try {
    const r = await api('/api/zoek?q=' + encodeURIComponent(q));
    const rows = r.resultaten;
    const fa = r.folderacties || [];
    const vs = r.voorstellen || [];
    $('#zoekleeg').textContent = rows.length || fa.length || vs.length ? '' : 'Niets gevonden. Nieuwe producten verschijnen hier zodra de thuis-scraper ze bij Picnic/AH heeft gevonden.';
    let cat = null, html = '';
    for (const x of rows) {
      if (x.category_id !== cat) { cat = x.category_id; html += '<h3>' + esc(x.categorie) + '</h3>'; }
      const d = dec(x.eenheid);
      const naam = x.productnaam.toLowerCase().startsWith(x.merk.toLowerCase()) ? x.productnaam : x.merk + ' ' + x.productnaam;
      const delen = [];
      if (x.prijs != null) delen.push(eur(x.prijs, 2));
      if (x.actie_label) delen.push(esc(x.actie_label) + (x.min_aantal > 1 ? ' (bij ' + x.min_aantal + ': ' + eur(x.effectieve_prijs_totaal, 2) + ')' : ''));
      delen.push(x.datum ? esc(x.datum) : 'nog geen prijs' + (x.scrape_methode === 'thuis' ? ' (thuis)' : ''));
      if (x.n_90d > 1) delen.push('90 d: gem. ' + eur(x.gem_90d, d) + ', laagste ' + eur(x.min_90d, d));
      html += '<div class="res"><div><div class="w">' + esc(x.winkel) + '</div><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(naam) + '</a></div>' +
        '<div class="pe">' + (x.prijs_per_eenheid != null ? eur(x.prijs_per_eenheid, d) + '<div class="w">/' + EENH[x.eenheid] + '</div>' : '–') + '</div>' +
        '<div class="sub">' + delen.join(' · ') + '</div></div>';
    }
    if (fa.length) html += '<h3>Folderacties (Kruidvat, Action)</h3>' + fa.map((a) => '<div class="res"><div class="sub" style="color:inherit">' + actieRegel(a) + '</div></div>').join('');
    if (vs.length) {
      html += '<h3>Voorstellen: bestaande producten bij Picnic/AH (nog niet gevolgd)</h3>';
      let vc = null;
      for (const v of vs) {
        if (v.category_id !== vc) { vc = v.category_id; html += '<div class="muted" style="margin-top:.4rem">' + esc(v.categorie) + '</div>'; }
        html += '<div class="res"><div><div class="w">' + esc(v.winkel) + '</div><a href="' + esc(v.url || '#') + '" target="_blank" rel="noopener">' + esc((v.merk ? v.merk + ' ' : '') + v.naam) + '</a></div>' +
          '<div class="pe">' + (v.prijs_per_eenheid_geschat != null ? '≈ ' + eur(v.prijs_per_eenheid_geschat, dec(v.eenheid)) + '<div class="w">/' + EENH[v.eenheid] + '</div>' : '–') + '</div>' +
          '<div class="sub">' + (v.prijs ? eur(v.prijs, 2) : '') + (v.hoeveelheid ? ' · ' + esc(v.hoeveelheid) : '') +
          ' · <button class="link" data-volg="' + v.id + '">Volgen</button></div></div>';
      }
    }
    $('#zoek').innerHTML = html;
    VOORSTEL = Object.fromEntries(vs.map((v) => [v.id, v]));
  } catch (e) { msg('Fout: ' + e.message, true); }
}
$('#q').oninput = () => { clearTimeout(zoekTimer); zoekTimer = setTimeout(zoekNu, 250); };
$('#zoekform').onsubmit = (e) => { e.preventDefault(); zoekNu(); };
$('#keyform').onsubmit =(e) => { e.preventDefault(); KEY = $('#key').value.trim(); try { localStorage.setItem('pv_key', KEY); } catch {} load(); };
const formJson = (f) => Object.fromEntries([...new FormData(f)].filter(([, v]) => v !== '').map(([k, v]) => [k, /^(category_id|stuks_per_verpakking|benchmark_prijs)$/.test(k) ? Number(v) : v]));
$('#catform').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/categories', { method: 'POST', body: JSON.stringify(formJson(e.target)) }); e.target.reset(); load(); } catch (x) { msg('Fout: ' + x.message, true); } };
$('#lform').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/listings', { method: 'POST', body: JSON.stringify(formJson(e.target)) }); e.target.reset(); load(); } catch (x) { msg('Fout: ' + x.message, true); } };
$('#lst').onclick = async (e) => {
  const pb = e.target.closest('button[data-prijs]');
  if (pb) {
    const v = prompt('Prijs per verpakking (bv. 1,29), eventueel gevolgd door een actie (bv. "2,58 2 voor 2,00"):');
    if (!v) return;
    const m = v.trim().match(/^(\\d+(?:[.,]\\d{1,2})?)\\s*(.*)$/);
    if (!m) { msg('Ongeldige prijs', true); return; }
    try { await api('/api/listings/' + pb.dataset.prijs + '/prijs', { method: 'POST', body: JSON.stringify({ prijs: Number(m[1].replace(',', '.')), actie_label: m[2] || null }) }); load(); } catch (x) { msg('Fout: ' + x.message, true); }
    return;
  }
  const b = e.target.closest('button[data-id]'); if (!b) return; try { await api('/api/listings/' + b.dataset.id, { method: 'PATCH', body: JSON.stringify({ actief: Number(b.dataset.a) }) }); load(); } catch (x) { msg('Fout: ' + x.message, true); } };
load();
</script>
</body>
</html>`;
