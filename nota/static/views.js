import {icon,esc,money,num,dateFmt,shift,today,amount,receipt,categoryIcon,longDate} from './ui.js';

import {plotShell} from './plots.js';

export function period(data,days,range=null) {
  const last=range?.end || data.sales.reduce((d,s)=>s.date>d?s.date:d,'') || today();
  const start=range?.start || shift(last,1-days);
  days=1+Math.round((Date.parse(last)-Date.parse(start))/86400000);
  const prev=shift(start,-days);
  const now=data.sales.filter(s=>s.date>=start && s.date<=last), before=data.sales.filter(s=>s.date>=prev&&s.date<start);
  const totals=new Map();
  for(const s of now) totals.set(s.date,(totals.get(s.date)||0)+amount(s));
  const points=Array.from({length:days},(_,i)=>{const date=shift(start,i);return {date,amount:totals.get(date)||0};});
  return {start,last,now,before,points,hasHistory:data.sales.some(s=>s.date<=prev)};
}
function measures(sales) {
  return [sales.reduce((v,s)=>v+amount(s),0), sales.length,sales.reduce((v,s)=>v+s.items.reduce((a,i)=>a+i.qty,0),0)];
}
function spark(points) {
  const max=Math.max(1,...points.map(p=>p.amount));
  const line=points.map((p,i)=>(i*120/Math.max(1,points.length-1))+','+(36-p.amount*32/max)).join(' ');
  return '<svg aria-hidden="true" class="spark" viewBox="0 0 120 40"><polyline points="'+line+'" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function metrics(p,days) {
  const current=measures(p.now), before=measures(p.before);
  const names=['Total omzet','Jumlah transaksi','Produk terjual'],icons=['wallet','receipt','box'];
  return '<div class="metrics">'+names.map((n,i)=>{
    const diff=p.hasHistory&&before[i]?(current[i]-before[i])*100/before[i]:null;
    const badge=diff===null?'Pembanding belum cukup':'<b class="delta '+(diff<0?'down':'')+'">'+(diff>0?'+':'')+num(Math.round(diff*10)/10)+'%</b> vs '+days+' hari lalu';
    return '<article class="metric m'+i+'"><div class="metric-line"><span class="meticon">'+icon(icons[i])+'</span>'+n+'</div><strong>'+ (i===0?money(current[i]):num(current[i]))+'</strong><div class="metric-sub">'+badge+'</div>'+(i===0?spark(p.points):'')+'</article>';
  }).join('')+'</div>';
}
function table(sales,products) {
  if(!sales.length) return '<p class="empty">Tidak ada transaksi yang cocok.</p>';
  return '<div class="scroll"><table><thead><tr><th>No. nota</th><th>Tanggal</th><th>Produk</th><th>Pembayaran</th><th class="right">Total</th></tr></thead><tbody>'+
    sales.map(s=>{const item=s.items[0],more=s.items.length-1;
      return '<tr><td><button class="link" data-sale="'+s.id+'">'+receipt(s.id)+'</button></td><td>'+dateFmt(s.date,{day:'numeric',month:'short',year:'numeric'})+'</td><td>'+esc(products[item.product].name)+(more?' <small>+'+more+'</small>':'')+'</td><td>'+esc(s.payment)+'</td><td class="right"><b>'+money(amount(s))+'</b></td></tr>';
    }).join('')+'</tbody></table></div>';
}
const sorted = rows=>[...rows].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
export function dashboard(data,products,days,byCategory,selection) {
  const full=period(data,days), p=selection?period(data,days,selection):full, units=new Map();
  for(const s of p.now) for(const i of s.items) {
    const key=byCategory?products[i.product].category:i.product;
    units.set(key,(units.get(key)||0)+i.qty);
  }
  const ranked=[...units].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5);
  const ranking=ranked.map(([key,qty],i)=>{
    const cat=byCategory?key:products[key].category;
    return '<li><span class="product-icon c'+i+'">'+icon(categoryIcon[cat])+'</span><div><div class="rank-name"><b>'+esc(byCategory?key:products[key].name)+'</b><span>'+num(qty)+'</span></div><div class="track"><i style="width:'+Math.round(qty*100/ranked[0][1])+'%"></i></div></div></li>';
  }).join('');
  const daily=full.points.map(point=>`<tr><td><button class="link" data-day="${point.date}">${longDate(point.date)}</button></td><td class="right">${money(point.amount)}</td></tr>`).join('');
  const filters=`<details class="date-filter"><summary>Filter tanggal</summary><form id="range-form">
    <label>Dari<input name="start" type="date" required min="${full.start}" max="${full.last}" value="${p.start}"></label>
    <label>Sampai<input name="end" type="date" required min="${full.start}" max="${full.last}" value="${p.last}"></label>
    <button>Terapkan</button></form></details>`;
  return '<div class="period"><span>'+icon('calendar')+longDate(p.start)+' – '+longDate(p.last)+'</span><div class="segments" aria-label="Periode ringkasan">'+[7,30,90].map(v=>'<button data-days="'+v+'" aria-pressed="'+(days===v)+'">'+v+' hari</button>').join('')+'</div></div>'+
    (selection?'<div class="selection-info" role="status">Filter aktif · '+longDate(p.start)+' – '+longDate(p.last)+' <button id="clear-selection">Hapus filter</button></div>':'')+
    metrics(p,p.points.length)+'<div class="charts"><article class="panel trend"><header><div><h2>Tren omzet</h2><p>Omzet aktual per hari · rupiah</p></div><span class="legend"><i></i>Aktual</span></header>'+plotShell('history')+
    '<div class="plot-access">'+filters+'<details class="daily-data"><summary>Data harian</summary><div class="scroll"><table><thead><tr><th>Tanggal / lihat nota</th><th class="right">Omzet</th></tr></thead><tbody>'+daily+'</tbody></table></div></details></div></article>'+
    '<article class="panel"><header><div><h2>Penjualan terlaris</h2><p>Peringkat menurut jumlah unit</p></div><select aria-label="Kelompok peringkat" id="rankby"><option value="product">Produk</option><option value="category" '+(byCategory?'selected':'')+'>Kategori</option></select></header><ol class="ranking">'+ranking+'</ol>'+(!ranking?'<p class="empty">Belum ada penjualan.</p>':'')+'</article></div>'+
    '<article class="panel list"><header><div><h2>Transaksi terbaru</h2><p>Lima nota terakhir dalam periode terpilih</p></div><button id="range-ledger" class="textlink">Lihat semua</button></header>'+table(sorted(p.now).slice(0,5),products)+'</article>';
}

function pagination(current, total, label) {
  if (total < 2) return '';
  // Show both ends and a three-page window, including the next two at either edge.
  const start = Math.max(1, Math.min(current - 1, total - 2));
  const visible = new Set([1, total, start, start + 1, Math.min(start + 2, total)]);
  const buttons = [];
  let previous = 0;
  function number(page) {
    const active = page === current ? ' aria-current="page"' : '';
    return `<button type="button" data-target-page="${page}" aria-label="Halaman ${page}"${active}>${page}</button>`;
  }
  for (const page of [...visible].sort((a,b)=>a-b)) {
    if (page - previous === 2) buttons.push(number(page-1));
    if (page - previous > 2) buttons.push('<span class="gap" aria-hidden="true">…</span>');
    buttons.push(number(page));
    previous = page;
  }
  return `<div class="pager" role="navigation" aria-label="Halaman ${label}">
    <span>Halaman ${current} dari ${total}</span>
    <div class="page-buttons">
      <button type="button" data-step="prev" data-target-page="${current-1}" aria-label="Halaman sebelumnya" ${current===1?'disabled':''}>‹</button>
      ${buttons.join('')}
      <button type="button" data-step="next" data-target-page="${current+1}" aria-label="Halaman berikutnya" ${current===total?'disabled':''}>›</button>
    </div></div>`;
}

export function ledgerResults(data, products, query, page, range) {
  const search = query.trim().toLocaleLowerCase('id');
  const inRange = range ? data.sales.filter(s=>s.date>=range.start && s.date<=range.end) : data.sales;
  const rows = sorted(inRange.filter(s=>[receipt(s.id),s.date,s.payment,...s.items.map(i=>products[i.product].name)].join(' ').toLocaleLowerCase('id').includes(search)));
  const pages = Math.max(1,Math.ceil(rows.length/12));
  const current = Math.min(page,pages);
  const start = (current-1)*12;
  return {count:num(rows.length)+' nota ditemukan', html:table(rows.slice(start,start+12),products)+pagination(current,pages,'transaksi')};
}

export function ledger(data,products,query,page,range=null) {
  const results = ledgerResults(data,products,query,page,range);
  const filter = range ? `<div class="selection-info">Nota · ${longDate(range.start)}${range.end===range.start?'':' – '+longDate(range.end)} <button id="clear-range">Semua tanggal</button></div>` : '';
  return `${filter}<article class="panel list"><header><div><h2>Daftar transaksi</h2><p id="ledger-count">${results.count}</p></div>
    <label class="search">${icon('search')}<input id="search" aria-label="Cari nota, produk, tanggal, atau pembayaran" placeholder="Cari nota atau produk…" value="${esc(query)}"></label></header>
    <div id="ledger-results">${results.html}</div></article>`;
}
export function prediction(f,horizon,page) {
  if(!f) return '<article class="panel"><h2>Riwayat belum cukup</h2><p>Prediksi memerlukan minimal 35 hari kalender sejak transaksi pertama hingga terakhir.</p></article>';
  const selected=f.future.slice(0,horizon), total=selected.reduce((v,p)=>v+p.amount,0);
  return '<div class="period"><span>'+icon('calendar')+longDate(selected[0].date)+' – '+longDate(selected.at(-1).date)+'</span><div class="segments" aria-label="Periode prediksi">'+[7,14,30].map(v=>`<button data-horizon="${v}" aria-pressed="${v===horizon}">${v} hari</button>`).join('')+'</div></div><div class="metrics">'+
    [['Estimasi omzet '+horizon+' hari',total,'Hasil prediksi model','wallet'],['MAE model',f.mae,'Rata-rata galat per hari uji','chart'],['MAE pembanding',f.baseline,'Acuan omzet hari yang sama pekan lalu','calendar']].map(([title,value,hint,symbol],i)=>'<article class="metric m'+i+'"><div class="metric-line"><span class="meticon">'+icon(symbol)+'</span>'+title+'</div><strong>'+money(value)+'</strong><div class="metric-sub">'+hint+'</div></article>').join('')+'</div>'+
    '<div class="charts"><article class="panel"><header><div><h2>Prediksi omzet harian</h2><p>Estimasi '+horizon+' hari setelah transaksi terakhir</p></div></header>'+plotShell('forecast')+'</article><article class="panel method"><h2>Evaluasi model</h2><p>Regresi linear mempelajari tren waktu dan pola hari dalam minggu.</p><p>Pelatihan memakai '+(f.days-7)+' hari awal. Tujuh hari terakhir ('+dateFmt(f.testStart)+'–'+dateFmt(f.end)+') disisihkan untuk pengujian.</p><p><b>'+ (f.mae<f.baseline?'Galat model lebih kecil dari acuan.':f.mae>f.baseline?'Acuan mingguan lebih akurat pada periode uji.':'Galat model dan acuan sama pada periode uji.')+'</b> MAE menyatakan rata-rata selisih absolut dalam rupiah.</p></article></div>'+
    forecastDetail(f,horizon,page);
}
export function forecastDetail(f,horizon,page) {
  const selected=f.future.slice(0,horizon);
  const pages=Math.ceil(selected.length/7), current=Math.min(page,pages), start=(current-1)*7;
  const rows=selected.slice(start,start+7).map(p=>`<tr><td>${longDate(p.date)}</td><td class="right">${money(p.amount)}</td></tr>`).join('');
  const pager=pagination(current,pages,'prediksi');
  return '<article class="panel list" id="forecast-detail"><header><div><h2>Rincian prediksi</h2><p>Model dilatih ulang dengan '+f.days+' hari untuk menghasilkan estimasi ini.</p></div></header><table><thead><tr><th>Tanggal</th><th class="right">Estimasi omzet</th></tr></thead><tbody>'+rows+'</tbody></table>'+pager+'</article>';
}
