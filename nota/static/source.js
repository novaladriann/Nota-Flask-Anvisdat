import {shift,amount,today} from './ui.js';
const demo = document.documentElement.dataset.preview === 'true';
let cached, connection, figures;
function requestResult(request) {
  return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);});
}
async function database() {
  if (connection) return connection;
  const seed = await fetch('/seed.json').then(r=>{if(!r.ok) throw Error('Data contoh gagal dimuat.');return r.json();});
  cached=seed.products;
  figures=seed.figures;
  const open=indexedDB.open('nota-aksara-v1',1);
  open.onupgradeneeded=()=>{
    const table=open.result.createObjectStore('sales',{keyPath:'id',autoIncrement:true});
    for(const row of seed.sales) table.add(row);
  };
  connection=await requestResult(open);
  return connection;
}
// Same least-squares model as the Python backend, used by the offline demo.
export function localForecast(rows) {
  if(!rows.length) return null;
  const totals=new Map();
  for(const s of rows) totals.set(s.date,(totals.get(s.date)||0)+amount(s));
  const dates=[...totals.keys()].sort(), end=dates.at(-1), start=[dates[0],shift(end,-364)].sort().at(-1);
  const days=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
  if(days<35) return null;
  const values=Array.from({length:days},(_,i)=>totals.get(shift(start,i))||0);
  function fit(n) {
    const groups=Array.from({length:7},()=>({x:0,y:0,n:0}));
    for(let i=0;i<n;i++){const g=groups[i%7];g.x+=i;g.y+=values[i];g.n++;}
    for(const g of groups){g.x/=g.n;g.y/=g.n;}
    let a=0,b=0;
    for(let i=0;i<n;i++){const g=groups[i%7];a+=(i-g.x)*(values[i]-g.y);b+=(i-g.x)**2;}
    return i=>{const g=groups[i%7];return Math.max(0,Math.round(g.y+(a/b)*(i-g.x)));};
  }
  const cut=days-7,test=fit(cut),final=fit(days);
  let error=0,base=0;
  for(let i=cut;i<days;i++){error+=Math.abs(values[i]-test(i));base+=Math.abs(values[i]-values[i-7]);}
  return {days,end,testStart:shift(end,-6),mae:Math.round(error/7),baseline:Math.round(base/7),
    future:Array.from({length:30},(_,i)=>({date:shift(end,i+1),amount:final(days+i)}))};
}
export async function load() {
  if(!demo){
    const response=await fetch('/api/state',{cache:'no-store'});
    if(!response.ok) throw Error('Data gagal dimuat. Muat ulang halaman.');
    return response.json();
  }
  const db=await database(), sales=await requestResult(db.transaction('sales').objectStore('sales').getAll());
  const forecast=localForecast(sales);
  // Demo edits live in IndexedDB. Keep the original Express layout and update its data.
  const totals = new Map();
  for (const sale of sales) totals.set(sale.date,(totals.get(sale.date)||0)+amount(sale));
  const last = [...totals.keys()].sort().at(-1) || today();
  const dates = Array.from({length:90}, (_,i)=>shift(last,i-89));
  Object.assign(figures.history.data[0], {x:dates, y:dates.map(day=>totals.get(day)||0)});
  Object.assign(figures.forecast.data[0], {x:forecast?.future.map(p=>p.date)||[], y:forecast?.future.map(p=>p.amount)||[]});
  return {products:cached, sales, forecast, figures};
}
export async function persist(method,data,id) {
  if(!demo) {
    const r=await fetch('/api/sales'+(id?'/'+id:''),{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!r.ok) throw Error((await r.json()).error||'Transaksi gagal disimpan.');
    return (await r.json()).id;
  }
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('sales','readwrite'), table=tx.objectStore('sales');
    let result=id,reason;
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(reason||tx.error||Error('Penyimpanan browser gagal.'));
    const run=old=>{
      if(id && (!old||old.version!==data.version)){reason=Error('Transaksi berubah. Tutup formulir dan muat ulang halaman.');tx.abort();return;}
      if(method==='DELETE'){table.delete(id);return;}
      const items=data.items.map(i=>({...i,price:old?.items.find(o=>o.product===i.product)?.price??cached.find(p=>p.code===i.product).price}));
      const row={date:data.date,payment:data.payment,items,version:(old?.version||0)+1};
      if(id) row.id=id;
      const req=table.put(row);req.onsuccess=()=>{result=req.result;};
    };
    if(id){const get=table.get(id);get.onsuccess=()=>run(get.result);}else run(null);
  });
}
