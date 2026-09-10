/*
 Fin Dashboard V3.1 - motor de datos
 La V3 fallaba porque GitHub Pages (navegador) no puede leer directamente
 el endpoint público de Yahoo cuando la respuesta no permite CORS.
 Esta versión intenta varias rutas: directa + proxies CORS públicos.
 No es una API oficial de Yahoo y la cotización puede venir retrasada.
*/
const FinData = {
  async fetchJson(url){
    const urls = [
      url,
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
      'https://corsproxy.io/?url=' + encodeURIComponent(url),
      'https://cors.isomorphic-git.org/' + url
    ];
    let last;
    for(const u of urls){
      try{
        const ctl = new AbortController();
        const timer = setTimeout(()=>ctl.abort(), 12000);
        const r = await fetch(u,{cache:'no-store',signal:ctl.signal});
        clearTimeout(timer);
        if(!r.ok) throw Error('HTTP '+r.status);
        const j = await r.json();
        if(j && (j.chart || j.quoteResponse || j.finance)) return {j,via:u===url?'directo':'proxy'};
      }catch(e){ last=e; }
    }
    throw last || Error('No fue posible consultar la fuente');
  },

  async load(s){
    const u='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(s)+
      '?range=1y&interval=1d&events=history&includeAdjustedClose=true';
    const got=await this.fetchJson(u);
    const m=got.j.chart?.result?.[0];
    if(!m) throw Error('no data');
    const q=m.indicators.quote[0];
    const clean=x=>(x||[]).filter(Number.isFinite);
    const c=clean(q.close), h=clean(q.high), l=clean(q.low), v=clean(q.volume);
    if(!c.length) throw Error('sin precios');
    const p=c.at(-1), pr=c.at(-2);
    return {
      price:p,
      changePct:pr ? (p/pr-1)*100 : null,
      volume:v.at(-1),
      high:h.at(-1),
      low:l.at(-1),
      yearHigh:Math.max(...h),
      yearLow:Math.min(...l),
      closes:c,
      sourceLabel:'Yahoo Finance chart · '+got.via,
      freshness:'Disponible'
    };
  },

  technicals(c){
    if(!c?.length)return{};
    const sma=n=>c.length<n?null:c.slice(-n).reduce((a,b)=>a+b,0)/n;
    let g=0,lo=0;
    const start=Math.max(1,c.length-14);
    for(let i=start;i<c.length;i++){
      const d=c[i]-c[i-1];
      if(d>0)g+=d; else lo-=d;
    }
    const rsi=lo?100-100/(1+(g/14)/(lo/14)):100;
    const s20=sma(20),s50=sma(50),s200=sma(200);
    let x=[];
    for(let i=Math.max(1,c.length-20);i<c.length;i++) x.push(c[i]/c[i-1]-1);
    const av=x.reduce((a,b)=>a+b,0)/(x.length||1);
    const vol=Math.sqrt(x.reduce((a,b)=>a+(b-av)**2,0)/(x.length||1))*Math.sqrt(252)*100;
    return {
      rsi,sma20:s20,sma50:s50,sma200:s200,volatility:vol,
      trend:s50&&s200?(s50>s200?'Alcista':'Bajista'):
        (s20?(c.at(-1)>s20?'Alcista':'Bajista'):'Neutral')
    };
  },

  tradePlan(p){
    return {entry:p,tp1:p*1.05,tp2:p*1.10,tp3:p*1.15,stop:p*.95,rr:2};
  }
};
