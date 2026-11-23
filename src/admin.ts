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

<h2>Samenvatting</h2>
<div class="wrap"><table id="sum"><thead><tr><th>Categorie</th><th>Beste nu</th><th>Picnic nu</th><th>Benchmark (90 d)</th></tr></thead><tbody></tbody></table></div>
<p id="fail" class="bad"></p>

<h2>Categorie toevoegen</h2>
<form id="catform">
  <label>Naam<input name="naam" required></label>
  <label>Eenheid<select name="eenheid"><option>doekje</option><option>tablet</option><option value="ml">ml (per 100 ml)</option><option>liter</option></select></label>
  <label>Benchmark €/eenheid<input name="benchmark_prijs" type="number" step="0.00001"></label>
  <button>Toevoegen</button>
</form>

<h2>Listing toevoegen</h2>
<form id="lform">
  <label>Categorie<select name="category_id" id="catsel"></select></label>
  <label>Winkel<select name="winkel">${['picnic','ah','jumbo','plus','kruidvat','etos','action','hema','bol','amazon'].map(w=>`<option>${w}</option>`).join('')}</select></label>
  <label>Merk<input name="merk" required></label>
  <label>Productnaam<input name="productnaam" required size="30"></label>
  <label>URL<input name="url" type="url" required size="40"></label>
  <label>Hoeveelheid (stuks / ml / liter)<input name="stuks_per_verpakking" type="number" step="0.001" required></label>
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
const datumKort = (d) => d ? d.slice(8, 10) + '-' + d.slice(5, 7) : '';
const actieRegel = (a) => '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.winkel) + ': ' + esc(a.actie_label || 'actie') + '</a> <span class="muted">' + esc(a.titel) +
  (a.prijs ? ' · ' + (a.prijs_was ? eur(a.prijs_was, 2) + ' → ' : '') + eur(a.prijs, 2) : '') +
  (a.prijs_per_eenheid ? ' · <b>' + eur(a.prijs_per_eenheid, a.prijs_per_eenheid < 1 ? 4 : 2) + '</b>/eenheid' : '') +
  (a.geldig_van && a.geldig_van > new Date().toISOString().slice(0, 10) ? ' · vanaf ' + datumKort(a.geldig_van) : '') + (a.geldig_tot ? ' · t/m ' + datumKort(a.geldig_tot) : '') + '</span>';
async function load() {
  if (!KEY) { msg('Vul de API-sleutel in.'); return; }
  try {
    const [cats, lst, sum] = await Promise.all([api('/api/categories'), api('/api/listings'), api('/api/summary')]);
    CATS = cats;
    $('#catsel').innerHTML = cats.map((c) => '<option value="' + c.id + '">' + esc(c.naam) + '</option>').join('');
    const cn = Object.fromEntries(cats.map((c) => [c.id, c.naam]));
    $('#sum tbody').innerHTML = sum.categorieen.map((c) => {
      const d = c.eenheid === 'doekje' || c.eenheid === 'tablet' ? 4 : 2;
      return '<tr><td>' + esc(c.naam) + '<br><span class="muted">' + c.eenheid_label + '</span></td><td>' + cell(c.beste_nu, d) + '</td><td>' + cell(c.picnic_nu, d) +
        (c.picnic_vs_benchmark ? ' <span class="muted">(' + Math.round((c.picnic_vs_benchmark - 1) * 100) + '% t.o.v. benchmark)</span>' : '') +
        '</td><td>' + eur(c.benchmark.prijs_per_eenheid, d) + ' <span class="muted">' + esc(c.benchmark.winkel || c.benchmark.bron || '') + '</span></td></tr>' +
        ((c.folderacties || []).length ? '<tr><td></td><td colspan="3" class="fa">Folder: ' + c.folderacties.map(actieRegel).join('<br>') + '</td></tr>' : '');
    }).join('');
    $('#fail').textContent = sum.listings_3_dagen_fout.length ? '3 dagen op rij mislukt: ' + sum.listings_3_dagen_fout.map((l) => '#' + l.listing_id + ' ' + l.winkel + ' ' + l.productnaam).join('; ') : '';
    $('#lst tbody').innerHTML = lst.map((l) => '<tr><td>' + l.id + '</td><td>' + esc(cn[l.category_id]) + '</td><td>' + esc(l.winkel) + '</td><td>' + esc(l.merk) + ' – <a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.productnaam) + '</a></td><td>' + l.stuks_per_verpakking + '</td><td>' + l.scrape_methode + '</td><td>' +
      (l.laatste_datum ? (l.laatste_ok ? eur(l.laatste_prijs, 2) : '<span class="bad">fout</span>') + ' <span class="muted">' + l.laatste_datum + '</span>' : '<span class="muted">–</span>') +
      '</td><td><button class="link" data-id="' + l.id + '" data-a="' + (l.actief ? 0 : 1) + '">' + (l.actief ? 'ja' : 'nee') + '</button></td></tr>').join('');
    msg('Geladen.');
  } catch (e) { msg('Fout: ' + e.message, true); }
}
const EENH = { doekje: 'doekje', tablet: 'tablet', ml: '100 ml', liter: 'liter' };
let zoekTimer;
async function zoekNu() {
  const q = $('#q').value.trim();
  if (q.length < 2) { $('#zoek').innerHTML = ''; $('#zoekleeg').textContent = ''; return; }
  try {
    const r = await api('/api/zoek?q=' + encodeURIComponent(q));
    const rows = r.resultaten;
    const fa = r.folderacties || [];
    $('#zoekleeg').textContent = rows.length || fa.length ? '' : 'Niets gevonden in de gevolgde artikelen.';
    let cat = null, html = '';
    for (const x of rows) {
      if (x.category_id !== cat) { cat = x.category_id; html += '<h3>' + esc(x.categorie) + '</h3>'; }
      const d = x.eenheid === 'doekje' || x.eenheid === 'tablet' ? 4 : 2;
      const naam = x.productnaam.toLowerCase().startsWith(x.merk.toLowerCase()) ? x.productnaam : x.merk + ' ' + x.productnaam;
      const delen = [];
      if (x.prijs != null) delen.push(eur(x.prijs, 2));
      if (x.actie_label) delen.push(esc(x.actie_label) + (x.min_aantal > 1 ? ' (bij ' + x.min_aantal + ': ' + eur(x.effectieve_prijs_totaal, 2) + ')' : ''));
      delen.push(x.datum ? esc(x.datum) : 'nog geen prijs' + (x.scrape_methode === 'thuis' ? ' (thuis)' : ''));
      html += '<div class="res"><div><div class="w">' + esc(x.winkel) + '</div><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(naam) + '</a></div>' +
        '<div class="pe">' + (x.prijs_per_eenheid != null ? eur(x.prijs_per_eenheid, d) + '<div class="w">/' + EENH[x.eenheid] + '</div>' : '–') + '</div>' +
        '<div class="sub">' + delen.join(' · ') + '</div></div>';
    }
    if (fa.length) html += '<h3>Folderacties (Kruidvat, Action)</h3>' + fa.map((a) => '<div class="res"><div class="sub" style="color:inherit">' + actieRegel(a) + '</div></div>').join('');
    $('#zoek').innerHTML = html;
  } catch (e) { msg('Fout: ' + e.message, true); }
}
$('#q').oninput = () => { clearTimeout(zoekTimer); zoekTimer = setTimeout(zoekNu, 250); };
$('#zoekform').onsubmit = (e) => { e.preventDefault(); zoekNu(); };
$('#keyform').onsubmit =(e) => { e.preventDefault(); KEY = $('#key').value.trim(); try { localStorage.setItem('pv_key', KEY); } catch {} load(); };
const formJson = (f) => Object.fromEntries([...new FormData(f)].filter(([, v]) => v !== '').map(([k, v]) => [k, /^(category_id|stuks_per_verpakking|benchmark_prijs)$/.test(k) ? Number(v) : v]));
$('#catform').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/categories', { method: 'POST', body: JSON.stringify(formJson(e.target)) }); e.target.reset(); load(); } catch (x) { msg('Fout: ' + x.message, true); } };
$('#lform').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/listings', { method: 'POST', body: JSON.stringify(formJson(e.target)) }); e.target.reset(); load(); } catch (x) { msg('Fout: ' + x.message, true); } };
$('#lst').onclick = async (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; try { await api('/api/listings/' + b.dataset.id, { method: 'PATCH', body: JSON.stringify({ actief: Number(b.dataset.a) }) }); load(); } catch (x) { msg('Fout: ' + x.message, true); } };
load();
</script>
</body>
</html>`;
