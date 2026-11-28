import {longDate, money} from './ui.js';

export function plotShell(kind) {
  const historical = kind === 'history';
  const modes = historical ? [['zoom','Zoom'],['pan','Geser'],['select','Seleksi']] : [['zoom','Zoom'],['pan','Geser']];
  return '<div class="plot-tools" role="group" aria-label="Mode interaksi grafik">' +
    modes.map(([mode,label])=>'<button type="button" data-mode="'+mode+'" aria-pressed="'+(mode==='zoom')+'">'+label+'</button>').join('')+
    '<button type="button" data-reset-plot>Reset tampilan</button></div>'+
    '<div id="sales-plot" class="interactive-plot" role="group" aria-label="'+(historical?'Grafik omzet historis':'Grafik estimasi omzet')+'"></div>'+
    '<p class="plot-hint">'+(historical?'Klik titik untuk melihat nota. Gunakan Seleksi untuk memfilter beberapa hari.':'Arahkan penunjuk ke titik untuk membaca estimasi. Gunakan tabel untuk melihat nilai per hari.')+'</p>';
}

let observer;
export function clearPlot() {
  observer?.disconnect();
  const old=document.querySelector('#sales-plot');
  if(old?.data && window.Plotly) Plotly.purge(old);
}
export async function mountPlot(fig, start, end, selection, onSelect, onDay) {
  const graph=document.querySelector('#sales-plot');
  if(!graph) return;
  if(!fig?.data.length){graph.textContent='Belum ada data untuk grafik ini.';return;}
  if(!window.Plotly) {graph.textContent='Grafik gagal dimuat. Nilai harian tersedia di tabel.';return;}
  const trace=fig.data[0], dates=[], values=[];
  trace.x.forEach((day,i)=>{if(day>=start && day<=end){dates.push(day);values.push(trace.y[i]);}});
  const chosen=dates.flatMap((day,i)=>selection && day>=selection.start && day<=selection.end?[i]:[]);
  const layout={...fig.layout, separators:',.',
    xaxis:{...fig.layout.xaxis,tickformat:'%d %b',nticks:5,automargin:true},
    yaxis:{...fig.layout.yaxis,ticksuffix:' jt',tickformat:'.2~f',automargin:true}};
  const points={...trace,x:dates,y:values.map(value=>value/1e6),customdata:dates.map((day,i)=>[longDate(day),money(values[i])]),
    hovertemplate:'%{customdata[0]}<br><b>%{customdata[1]}</b><extra></extra>',
    selectedpoints:selection?chosen:null, selected:{marker:{color:'#211e22',size:10}},
    unselected:{marker:{opacity:0.40}}};
  if(selection) layout.shapes=[{type:'rect',xref:'x',yref:'paper',x0:selection.start,x1:selection.end,y0:0,y1:1,
    line:{width:0},fillcolor:'rgba(255,184,54,.24)',layer:'below'}];
  await Plotly.newPlot(graph,[points],layout,{displayModeBar:false,displaylogo:false,responsive:true,locale:'id',locales:{id:{format:{shortMonths:['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],decimal:',',thousands:'.',grouping:[3]}}},scrollZoom:false,doubleClick:'reset'});
  if(!graph.isConnected)return;
  observer=new ResizeObserver(()=>{if(graph.isConnected && graph.clientWidth)Plotly.Plots.resize(graph);});
  observer.observe(graph.parentElement);
  if(onDay)graph.on('plotly_click',e=>{const p=e.points?.[0];if(p)onDay(dates[p.pointNumber]);});
  if(onSelect)graph.on('plotly_selected',e=>{
    if(!e?.points.length)return;
    const selected=e.points.map(p=>dates[p.pointNumber]).sort();
    onSelect({start:selected[0],end:selected.at(-1)});
  });
}
export function plotControl(button) {
  const graph=document.querySelector('#sales-plot');
  if(!graph?.data)return;
  if(button.dataset.mode){
    Plotly.relayout(graph,{dragmode:button.dataset.mode});
    button.parentElement.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  } else if(button.hasAttribute('data-reset-plot')){
    Plotly.relayout(graph,{'xaxis.autorange':true,'yaxis.autorange':true});
  }
}
