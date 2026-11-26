const paths = {
  layout:'<rect x="3" y="3" width="7" height="8" rx="1.3"/><rect x="14" y="3" width="7" height="5" rx="1.3"/><rect x="14" y="12" width="7" height="9" rx="1.3"/><rect x="3" y="15" width="7" height="6" rx="1.3"/>',
  receipt:'<path d="M5 3l3 2 4-2 4 2 3-2v18l-3-2-4 2-4-2-3 2zM9 9h6m-6 4h6"/>',
  trend:'<path d="M3 17l6-6 4 4 8-10m-6 0h6v6"/>',
  store:'<path d="M3 9l2-5h14l2 5m-18 0v2a3 3 0 005 2 3 3 0 004 0 3 3 0 004 0 3 3 0 005-2V9zM5 14v6h14v-6m-9 6v-5h4v5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  box:'<path d="M12 2l9 5v10l-9 5-9-5V7zm-9 5l9 5 9-5m-9 5v10M7 4.8l10 5.4"/>',
  wallet:'<path d="M20 7H5a2 2 0 010-4h12v4m-14-2v13a2 2 0 002 2h15V7m0 4h-6v5h6"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v13c0 4 16 4 16 0V5M4 11c0 4 16 4 16 0"/>',
  book:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18m3-13h4"/>',
  pen:'<path d="M5 19l1-5L17 3l4 4L10 18zm10-14l4 4"/>',
  paper:'<path d="M6 3h8l5 5v13H6zm8 0v6h5m-10 4h7m-7 4h5"/>',
  folder:'<path d="M3 7V5h7l2 3h9v12H3zm0 4h18"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/>',
  close:'<path d="M6 6l12 12M6 18L18 6"/>',trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  caret:'<path d="M7 10l5 5 5-5"/>',chart:'<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>'
};
export const icon = (key) => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths[key]+'</svg>';
export const esc = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = n=>'Rp'+Math.round(n).toLocaleString('id-ID');
export const num = n=>n.toLocaleString('id-ID');
export const dateFmt = (iso, options={day:'numeric',month:'short'})=>new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',...options}).format(new Date(iso+'T12:00:00Z'));
export const shift = (iso, days)=> new Date(Date.parse(iso+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export const today = ()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
export const amount = sale=>sale.items.reduce((a,i)=>a+i.qty*i.price,0);
export const receipt = id=>'NT-'+String(id).padStart(5,'0');
export const categoryIcon = {'Buku':'book','Alat tulis':'pen','Kertas':'paper','Arsip':'folder'};
export const longDate = d=>dateFmt(d,{day:'numeric',month:'long',year:'numeric'});
export function chart(points, desc) {
  if (!points.length) return '<p class="empty">Belum ada data pada periode ini.</p>';
  const peak=Math.max(1,...points.map(p=>p.amount)), unit=10**Math.floor(Math.log10(peak));
  const top=Math.ceil(peak/(unit/2))*(unit/2);
  const x=i=>5+(i/Math.max(1,points.length-1))*690, y=v=>12+138*(1-v/top);
  const line=points.map((p,i)=>[x(i),y(p.amount)].join(',')).join(' ');
  const ticks=[0,1,2,3].map(j=>Math.round(top*(1-j/3)));
  const compact=v=>v>=1e6?num(Math.round(v/1e4)/100)+' jt':v>=1e3?num(Math.round(v/100)/10)+' rb':num(v);
  const labels=[...new Set([0,Math.round((points.length-1)/3),Math.round((points.length-1)*2/3),points.length-1])];
  return '<div class="plot"><div class="yticks">'+ticks.map(v=>'<span>'+compact(v)+'</span>').join('')+'</div><svg role="img" aria-label="'+esc(desc)+'" viewBox="0 0 700 163" preserveAspectRatio="none"><defs><linearGradient id="wash" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#43a481" stop-opacity=".22"/><stop offset="1" stop-color="#43a481" stop-opacity=".015"/></linearGradient></defs>'+
    ticks.map((_,i)=>'<path d="M0 '+(12+i*46)+'H700" stroke="#d8e1dc" stroke-dasharray="4 5"/>').join('')+
    '<polygon points="5,150 '+line+' 695,150" fill="url(#wash)"/><polyline points="'+line+'" stroke="#25785d" fill="none" stroke-width="2.7" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>'+
    '</svg><div class="xticks">'+labels.map(i=>'<span>'+dateFmt(points[i].date)+'</span>').join('')+'</div></div>'+
    '<details class="chart-data"><summary>Data grafik</summary><div class="scroll"><table><thead><tr><th>Tanggal</th><th>Omzet</th></tr></thead><tbody>'+points.map(p=>'<tr><td>'+longDate(p.date)+'</td><td>'+money(p.amount)+'</td></tr>').join('')+'</tbody></table></div></details>';
}
