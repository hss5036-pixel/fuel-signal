import {commonObservations} from './market-trends.mjs';
import {SERIES} from './market.mjs';

const DAY = 86400000;
export const PERIODS = {day:{label:'직전 관측',days:1},week:{label:'1주 전',days:7},month:{label:'1개월 전',days:30},year:{label:'1년 전',days:365}};
const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
const sign = value => Math.abs(value) < 1e-8 ? 0 : Math.sign(value);
export function describeMovement(oil, crack) {
  const total=oil+crack, o=sign(oil), c=sign(crack), t=sign(total);
  if(!o&&!c)return '원유와 크랙 모두 변동이 없습니다.';
  if(!t)return '원유와 크랙 변화가 서로 상쇄돼 현물가격은 같습니다.';
  const direction=t>0?'상승':'하락';
  if(!c)return `현물가격 ${direction}분은 원유가격 변화와 같습니다.`;
  if(!o)return `현물가격 ${direction}분은 크랙 변화와 같습니다.`;
  if(o===c)return `원유와 크랙이 함께 ${direction}했습니다. ${Math.abs(oil)>Math.abs(crack)?'원유':Math.abs(crack)>Math.abs(oil)?'크랙':'두 항목'}의 변화폭이 ${Math.abs(oil)===Math.abs(crack)?'같습니다':'더 큽니다'}.`;
  return `${Math.abs(oil)>Math.abs(crack)?'원유': '크랙'} 변화가 ${direction}을 이끌고, ${Math.abs(oil)>Math.abs(crack)?'크랙':'원유'} 변화는 일부 상쇄했습니다.`;
}

// An exact price identity on matched observations, not a causal estimate of retail prices.
export function priceAttribution(data, fuel, benchmark='brent', period='week', now=new Date()) {
  if(!['gasoline','diesel'].includes(fuel)||!['wti','brent'].includes(benchmark)||!PERIODS[period])return {state:'missing',reason:'비교 기준을 확인해 주세요.'};
  const spot=fuel==='gasoline'?'gasSpot':'dieselSpot';
  const today=new Date(now).toISOString().slice(0,10);
  const rows=commonObservations(data,[benchmark,spot]).filter(r=>dateOnly(r.date)&&r.date<=today);
  const current=rows.at(-1);
  if(!current)return {state:'missing',reason:'원유와 제품의 같은 날짜 관측값이 없습니다.'};
  const cutoff=new Date(Date.parse(current.date)-PERIODS[period].days*DAY).toISOString().slice(0,10);
  const previous=period==='day'?rows.at(-2):rows.filter(r=>r.date<=cutoff).at(-1);
  if(!previous)return {state:'missing',date:current.date,reason:'선택한 기간의 공통 비교값이 부족합니다.'};
  const gapDays=(Date.parse(current.date)-Date.parse(previous.date))/DAY;
  if((period==='day'&&gapDays>7)||(period!=='day'&&(Date.parse(cutoff)-Date.parse(previous.date))/DAY>(period==='year'?7:4)))
    return {state:'missing',date:current.date,reason:'비교일의 자료 공백이 길어 변화 요약을 보류합니다.'};
  const oil=(current[benchmark]-previous[benchmark])/42;
  const total=current[spot]-previous[spot];
  const crack=total-oil;
  const required=[benchmark,spot];
  const delayed=data.refreshStatus?.state==='failed'||data.sources?.some(s=>required.includes(s.id)&&!s.ok);
  return {state:'ok',fuel,benchmark,period,date:current.date,previousDate:previous.date,gapDays,
    oil,crack,total,currentSpot:current[spot],previousSpot:previous[spot],
    currentCrack:current[spot]-current[benchmark]/42,
    ageDays:Math.floor((Date.parse(today)-Date.parse(current.date))/DAY),delayed:Boolean(delayed),
    summary:describeMovement(oil,crack),sources:required.map(id=>SERIES.find(s=>s.id===id))};
}

export function indicatorEvidence(data, fuel, now=new Date()) {
  const today=new Date(now).toISOString().slice(0,10);
  const ids=[fuel==='gasoline'?'gasStocks':'dieselStocks','utilization',...(fuel==='gasoline'?['demand']:[])];
  return ids.map(id=>{
    const meta=SERIES.find(s=>s.id===id);
    const rows=(data.series?.[id]?.points??[]).filter(r=>dateOnly(r.date)&&r.date<=today&&Number.isFinite(r.value)).sort((a,b)=>a.date.localeCompare(b.date));
    const latest=rows.at(-1);
    if(!latest)return {...meta,state:'missing'};
    const target=Date.parse(latest.date)-7*DAY;
    const previous=rows.filter(r=>Date.parse(r.date)<=target).at(-1);
    if(!previous||target-Date.parse(previous.date)>4*DAY)return {...meta,state:'missing',date:latest.date};
    const change=latest.value-previous.value;
    const direction=sign(change);
    const stock=id.endsWith('Stocks');
    const pressure=stock||id==='utilization'?-direction:direction;
    const explanation=!direction?'직전 주와 같습니다.':stock?(direction<0?'재고 감소 · 공급 여유 축소 가능성':'재고 증가 · 공급 여유 확대 가능성'):id==='utilization'?(direction<0?'가동률 하락 · 공급 제약 가능성':'가동률 상승 · 공급 확대 가능성'):(direction>0?'제품공급량 증가 · 수요 확대 가능성':'제품공급량 감소 · 수요 둔화 가능성');
    return {...meta,state:'ok',date:latest.date,previousDate:previous.date,
      value:stock?latest.value/1000:latest.value,change:stock?change/1000:change,
      displayUnit:stock?'백만 bbl':id==='utilization'?'%p':'천 bbl/일',explanation,pressure,
      delayed:data.refreshStatus?.state==='failed'||data.sources?.some(s=>s.id===id&&!s.ok),
      stale:Date.parse(today)-Date.parse(latest.date)>14*DAY};
  });
}

export function relatedNews(data, fuel, analysis, now=new Date()) {
  const today=new Date(now).toISOString().slice(0,10), oldest=Date.parse(today)-21*DAY;
  const seen=new Set();
  return (data.news??[]).filter(n=>{
    if(!dateOnly(n.date)||n.date>today||Date.parse(n.date)<oldest||!/^https:\/\//.test(n.url)||seen.has(n.url))return false;
    let host;try{host=new URL(n.url).hostname}catch{return false}
    if(!['www.eia.gov','eia.gov','gasprices.aaa.com'].includes(host))return false;
    seen.add(n.url);return true;
  }).map(n=>{
    const title=String(n.title??'');
    const direct=fuel==='gasoline'?/gasoline|\bgas prices?\b|pump prices?|national average/i.test(title):/diesel|distillate|heating oil/i.test(title);
    const shared=/crude|\bopec\b|refiner|refining|petroleum|hurricane|storm|pipeline/i.test(title);
    if(!direct&&!shared)return null;
    const kind=/refiner|refining|margin/i.test(title)?'정제·공급':/hurricane|storm|pipeline/i.test(title)?'기상·물류':/crude|\bopec\b/i.test(title)?'원유 동향':'제품가격·수요';
    const context=kind==='정제·공급'?'크랙 변화와 정유시설 가동률을 함께 확인하세요.':kind==='원유 동향'?'원유 기여액과 기준유 가격을 함께 확인하세요.':kind==='기상·물류'?'공급 차질 여부를 재고·가동률 자료와 확인하세요.':`${fuel==='gasoline'?'가솔린':'경유'} 소매·현물가격과 수요 배경을 확인하세요.`;
    const relation=analysis?.date?(n.date>analysis.date?'현물 기준일 이후 기사':n.date<analysis.previousDate?'비교기간 이전 배경 기사':'비교기간 내 기사'):'관련 배경 기사';
    return {...n,kind,context,relation,score:direct?1:0};
  }).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date)||b.score-a.score).slice(0,2);
}
