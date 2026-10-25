export const SERIES = [
  {id:'gasoline',name:'가솔린 소매가격',code:'EMM_EPMR_PTE_NUS_DPG',frequency:'W',unit:'$/gal',scope:'전국 · Regular'},
  {id:'diesel',name:'경유 소매가격',code:'EMD_EPD2DXL0_PTE_NUS_DPG',frequency:'W',unit:'$/gal',scope:'전국 · 초저유황 경유'},
  {id:'wti',name:'WTI 원유',code:'RWTC',frequency:'D',unit:'$/bbl',scope:'Cushing 현물'},
  {id:'brent',name:'Brent 원유',code:'RBRTE',frequency:'D',unit:'$/bbl',scope:'유럽 현물'},
  {id:'gasSpot',name:'가솔린 현물',code:'EER_EPMRU_PF4_Y35NY_DPG',frequency:'D',unit:'$/gal',scope:'뉴욕항 · 일반 가솔린'},
  {id:'dieselSpot',name:'경유 현물',code:'EER_EPD2DXL0_PF4_Y35NY_DPG',frequency:'D',unit:'$/gal',scope:'뉴욕항 · 초저유황 경유'},
  {id:'gasStocks',name:'가솔린 재고',code:'WGTSTUS1',frequency:'W',unit:'천 bbl',scope:'미국 총 모터 가솔린'},
  {id:'dieselStocks',name:'중간유분 재고',code:'WDISTUS1',frequency:'W',unit:'천 bbl',scope:'미국 · 경유·난방유 등'},
  {id:'utilization',name:'정유시설 가동률',code:'WPULEUS3',frequency:'W',unit:'%',scope:'미국 가동가능 설비'},
  {id:'demand',name:'가솔린 제품공급량',code:'WGFUPUS2',frequency:'W',unit:'천 bbl/d',scope:'미국 · 수요 대리지표'}
].map(s=>({...s,url:`https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${s.code}&f=${s.frequency}`}));
export const clean = s => String(s??'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0*39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
const iso = d => d.toISOString().slice(0,10);
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function parseEia(html, frequency, now = new Date()) {
  const points=[];
  for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>clean(m[1]));
    if(frequency==='W') {
      const match=cells[0]?.match(/^(\d{4})-([A-Z][a-z]{2})$/); if(!match)continue;
      for(let i=1;i+1<cells.length;i+=2){const dm=cells[i].match(/^(\d{2})\/(\d{2})$/);const value=Number(cells[i+1].replaceAll(',',''));if(dm && cells[i+1] && Number.isFinite(value))points.push({date:`${match[1]}-${dm[1]}-${dm[2]}`,value});}
    } else {
      const match=cells[0]?.match(/^(\d{4})\s+([A-Z][a-z]{2})-\s*(\d{1,2})\s+to/);if(!match)continue;
      const start=new Date(Date.UTC(+match[1],months.indexOf(match[2]),+match[3]));
      cells.slice(1,6).forEach((c,i)=>{const value=Number(c.replaceAll(',',''));if(c && Number.isFinite(value))points.push({date:iso(new Date(+start+i*86400000)),value});});
    }
  }
  const cutoff=new Date(now);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-6);
  const out=[...new Map(points.filter(p=>p.date>=iso(cutoff)&&p.date<=iso(now)).map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(out.length<10)throw new Error('EIA 표의 관측값을 확인할 수 없습니다');
  return out;
}
export function parseAaa(html) {
  const dateText=clean(html).match(/Price as of\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!dateText)throw new Error('AAA 기준일을 확인할 수 없습니다');
  const year=dateText[3].length===2?'20'+dateText[3]:dateText[3];
  const date=`${year}-${dateText[1].padStart(2,'0')}-${dateText[2].padStart(2,'0')}`;
  const data={date,source:'AAA',url:'https://gasprices.aaa.com/',gasoline:{},diesel:{}};
  const labels={'Current Avg.':'current','Yesterday Avg.':'day','Week Ago Avg.':'week','Month Ago Avg.':'month','Year Ago Avg.':'year'};
  for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>clean(m[1]));
    if(!labels[cells[0]])continue;
    const gas=Number(cells[1]?.replace(/[$,]/g,'')),diesel=Number(cells[4]?.replace(/[$,]/g,''));
    if(!(gas>0&&gas<30&&diesel>0&&diesel<30))throw new Error('AAA 가격 검증 실패');
    data.gasoline[labels[cells[0]]]=gas;data.diesel[labels[cells[0]]]=diesel;
  }
  if(Object.keys(data.gasoline).length!==5)throw new Error('AAA 비교가격 누락');return data;
}
export function parseRss(xml,source,url){
  const tag=(s,n)=>s.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)<\\/${n}>`,'i'))?.[1]??'';
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>{
    const title=clean(tag(m[1],'title')),description=clean(tag(m[1],'description'));
    const d=clean(tag(m[1],'pubDate'));const date=/\b20\d{2}\b/.test(d)&&!Number.isNaN(Date.parse(d))?iso(new Date(d)):null;
    const link=clean(tag(m[1],'link')); const text=title+' '+description;
    const topic=/refiner|refining|margin/i.test(text)?'정제·공급':/crude|OPEC|oil price/i.test(text)?'원유':/hurricane|storm|weather/i.test(text)?'기상·공급':/demand|consumption/i.test(text)?'수요':'연료시장';
    return {title,url:link,date,source,topic};
  }).filter(n=>/^https:\/\//.test(n.url)&&/gas|diesel|fuel|oil|refiner|petroleum|hurricane/i.test(n.title)).slice(0,8);
}
async function getText(url){const response=await fetch(url,{signal:AbortSignal.timeout(22000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.text();}
export async function collect(previous=null){
  const now=new Date().toISOString();const result={schema:1,checkedAt:now,aaa:previous?.aaa??null,series:{...previous?.series},news:previous?.news??[],dailyHistory:previous?.dailyHistory??[],sources:[]};
  const jobs=[{id:'aaa',url:'https://gasprices.aaa.com/',run:async()=>parseAaa(await getText('https://gasprices.aaa.com/'))},...SERIES.map(s=>({id:s.id,url:s.url,run:async()=>({...s,points:parseEia(await getText(s.url),s.frequency),fetchedAt:now})})),{id:'aaaNews',url:'https://gasprices.aaa.com/feed/',run:async()=>parseRss(await getText('https://gasprices.aaa.com/feed/'),'AAA','https://gasprices.aaa.com/feed/')},{id:'eiaNews',url:'https://www.eia.gov/rss/todayinenergy.xml',run:async()=>parseRss(await getText('https://www.eia.gov/rss/todayinenergy.xml'),'EIA','https://www.eia.gov/rss/todayinenergy.xml')}];
  const outcomes=await Promise.allSettled(jobs.map(j=>j.run()));const news=[];let newsSuccess=false;
  outcomes.forEach((out,i)=>{const job=jobs[i];result.sources.push({id:job.id,url:job.url,ok:out.status==='fulfilled',checkedAt:now,error:out.status==='rejected'?String(out.reason?.message??'수집 실패'):null});if(out.status!=='fulfilled')return;
    if(job.id==='aaa'){result.aaa={...out.value,fetchedAt:now};}else if(job.id.endsWith('News')){newsSuccess=true;news.push(...out.value);}else result.series[job.id]=out.value;
  });
  if(newsSuccess)result.news=[...new Map([...news,...result.news].map(n=>[n.url,n])).values()].sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,16);
  if(result.aaa){const a=result.aaa;result.dailyHistory=[...new Map([...result.dailyHistory,{date:a.date,gasoline:a.gasoline.current,diesel:a.diesel.current}].map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-2000);}
  result.successCount=result.sources.filter(s=>s.ok).length;
  if(!result.successCount)throw new Error('모든 출처에 연결하지 못했습니다. 마지막 저장값을 유지합니다.');
  return result;
}
export const latest = s=>s?.points?.at(-1)??null;
export function prior(s,days=7){const last=latest(s);if(!last)return null;const target=iso(new Date(Date.parse(last.date)-days*86400000));return s.points.filter(p=>p.date<=target).at(-1)??null;}
export const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?(a-b)/b*100:null;
export function oilComparison(data){
  const wtiByDate=new Map((data.series.wti?.points??[]).map(p=>[p.date,p]));
  const pairs=(data.series.brent?.points??[]).filter(p=>wtiByDate.has(p.date)).map(brent=>({date:brent.date,wti:wtiByDate.get(brent.date),brent,spread:brent.value-wtiByDate.get(brent.date).value}));
  const current=pairs.at(-1);if(!current)return null;
  const target=iso(new Date(Date.parse(current.date)-7*86400000));
  return {...current,previous:pairs.filter(p=>p.date<=target).at(-1)??null};
}
export function pairedCost(data,fuel,benchmark='wti'){
  if(!['wti','brent'].includes(benchmark))return null;
  const anchor=latest(data.series[fuel]);if(!anchor)return null;
  const oils=new Map((data.series[benchmark]?.points??[]).map(p=>[p.date,p]));
  const pairs=(data.series[fuel==='diesel'?'dieselSpot':'gasSpot']?.points??[]).filter(p=>p.date<=anchor.date&&oils.has(p.date)).map(spot=>({date:spot.date,spot,oil:oils.get(spot.date),spread:spot.value-oils.get(spot.date).value/42}));
  const current=pairs.at(-1);if(!current)return null;
  const target=iso(new Date(Date.parse(current.date)-7*86400000));
  return {...current,benchmark,retail:anchor,gap:anchor.value-current.spot.value,previous:pairs.filter(p=>p.date<=target).at(-1)??null};
}
