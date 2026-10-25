import {useMemo, useState} from 'react';
import {Download, Info} from 'lucide-react';
import {crackHistory, oilHistory, lastYear, pastObservation, historyCsv} from '../lib/market-trends.mjs';
import {pct} from '../lib/market.mjs';
import {CrackGuide} from './daily-brief';

type Row = {date: string; [key: string]: any};
type Line = {id: string; name: string; color: string};
const OILS: Line[] = [{id:'wti',name:'WTI',color:'#b58243'},{id:'brent',name:'브렌트',color:'#7b70ba'}];
const CRACKS: Line[] = [{id:'composite',name:'3:2:1 복합',color:'#a47a32'},
  {id:'gasoline',name:'가솔린',color:'#279d75'},{id:'diesel',name:'경유',color:'#4985e7'}];
const fmt = (n: any, digits = 2) => Number.isFinite(n) ? n.toLocaleString('en-US', {minimumFractionDigits:digits, maximumFractionDigits:digits}) : '—';
const signed = (n: any, digits = 2) => Number.isFinite(n) ? `${n > 0 ? '+' : ''}${fmt(n,digits)}` : '—';
const day = (s?: string) => s?.replaceAll('-', '.') ?? '—';
function download(rows: Row[], lines: Line[], unit: string, filename: string, benchmark = '') {
  const href = URL.createObjectURL(new Blob(['\uFEFF' + historyCsv(rows,lines,unit,benchmark)], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href = href; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function HistoryChart({rows, lines, label, unit, zero = false}: {rows:Row[]; lines:Line[]; label:string; unit:string; zero?:boolean}) {
  const [selected, setSelected] = useState<number|null>(null);
  if (!rows.length) return <div className="empty">같은 날짜의 관측값이 없어 추이를 표시할 수 없습니다.</div>;
  const values = rows.flatMap(r => lines.map(l => r[l.id]));
  let lo = Math.min(...values), hi = Math.max(...values);
  if (zero) {lo = Math.min(0, lo); hi = Math.max(0, hi);}
  const padding = Math.max((hi-lo)*.12, unit==='$/gal'?.05:1);
  lo -= padding; hi += padding;
  const width = 1000, height = 285, left = 64, right = 20, top = 16, bottom = 38;
  const start = Date.parse(rows[0].date), end = Date.parse(rows.at(-1)!.date);
  const x = (date:string) => left + (Date.parse(date)-start)/(end-start||1)*(width-left-right);
  const y = (value:number) => top + (hi-value)/(hi-lo)*(height-top-bottom);
  const index = Math.max(0,Math.min(selected ?? rows.length-1, rows.length-1)), point = rows[index];
  const digits = unit==='$/gal'?3:2;
  return <div className="history-chart">
    <div className="history-legend">{lines.map(l => <span key={l.id}><i style={{background:l.color}}/>{l.name}</span>)}<small>{unit} · EIA 영업일 현물</small></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}
      onPointerMove={e => {const rect=e.currentTarget.getBoundingClientRect();const px=(e.clientX-rect.left)/rect.width*width;
        let closest=0;rows.forEach((r,i)=>{if(Math.abs(x(r.date)-px)<Math.abs(x(rows[closest].date)-px))closest=i});setSelected(closest)}}>
      {[0,1,2,3,4].map(i=>{const v=lo+(hi-lo)*i/4;return <g key={i}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="#e5e8eb" strokeDasharray="3 5"/><text x={left-12} y={y(v)+4} textAnchor="end" fill="#7f8a96" fontSize="12">{fmt(v,unit==='$/gal'?2:0)}</text></g>})}
      {zero&&<line x1={left} x2={width-right} y1={y(0)} y2={y(0)} stroke="#95a1ab" strokeDasharray="6 4"/>}
      {[0,.25,.5,.75,1].map(t=>{const d=new Date(start+(end-start)*t).toISOString().slice(0,10);return <text key={t} x={x(d)} y={height-8} textAnchor="middle" fill="#7f8a96" fontSize="12">{d.slice(0,7).replace('-','.')}</text>})}
      {lines.map(l=><path key={l.id} d={rows.map((r,i)=>`${i?'L':'M'} ${x(r.date)} ${y(r[l.id])}`).join(' ')} fill="none" stroke={l.color} strokeWidth={l.id==='composite'?3.2:2.6} strokeLinejoin="round"/>)}
      <line x1={x(point.date)} x2={x(point.date)} y1={top} y2={height-bottom} stroke="#8a93a2" strokeDasharray="4 4"/>
      {lines.map(l=><circle key={l.id} cx={x(point.date)} cy={y(point[l.id])} r="4" fill={l.color} stroke="white" strokeWidth="1.5"/>)}
    </svg>
    <div className="history-readout" aria-live="polite"><time>{day(point.date)}</time>{lines.map(l=><span key={l.id}><i style={{background:l.color}}/>{l.name} <b>{fmt(point[l.id],digits)}</b><small>{unit}</small></span>)}</div>
    <label className="history-slider"><span>날짜 탐색</span><input type="range" min="0" max={Math.max(0,rows.length-1)} value={index} disabled={rows.length<2} aria-label={`${label} 날짜 선택`} aria-valuetext={day(point.date)} onChange={e=>setSelected(Number(e.target.value))}/></label>
    <p className="history-range">{day(rows[0].date)} — {day(rows.at(-1)!.date)} · 최근 365일 내 공통 관측값 {rows.length}개 · 마우스 또는 날짜 막대로 확인</p>
  </div>;
}

export default function MarketTrends({data, benchmark, onBenchmarkChange}: {data:any; benchmark:string; onBenchmarkChange:(value:string)=>void}) {
  const [unit,setUnit]=useState('bbl');
  const oils=useMemo(()=>oilHistory(data),[data]);
  const cracks=useMemo(()=>crackHistory(data,benchmark),[data,benchmark]);
  const oilRows=lastYear(oils), oilLast=oils.at(-1), oilYear=pastObservation(oils,365);
  const crackLast=cracks.at(-1), crackWeek=pastObservation(cracks,7), crackYear=pastObservation(cracks,365);
  const factor=unit==='gal'?42:1, digits=unit==='gal'?3:2, displayUnit=`$/${unit}`;
  const crackRows=lastYear(cracks).map((r:Row)=>({...r,gasoline:r.gasoline/factor,diesel:r.diesel/factor,composite:r.composite/factor}));
  const benchmarkLabel=benchmark==='brent'?'브렌트':'WTI';
  return <section id="market-trends" className="market-trends" aria-label="원유와 크랙 스프레드 추이">
    <div className="section-head outside"><div><div className="eyebrow">CRUDE & REFINING</div><h2>원유와 정제마진, 1년의 흐름</h2><p>원유 자체의 변화와 제품·원유 가격차를 나란히 살펴보세요.</p></div><span className="small-badge">최근 1년 · 매일 자료 확인</span></div>
    <section className="panel history-panel" aria-labelledby="oil-history-title">
      <div className="section-head"><div><h2 id="oil-history-title">WTI·브렌트 1년 추이</h2><p>두 기준유를 같은 날짜, 같은 단위로 비교합니다.</p></div><button className="text-button" aria-label="원유 1년 추이 CSV 다운로드" disabled={!oilRows.length} onClick={()=>download(oilRows,OILS,'USD/bbl','fuel-signal-oil-1y.csv')}><Download size={14}/> CSV</button></div>
      <div className="history-stats oil-stats">{OILS.map(l=>{const change=oilLast&&oilYear?oilLast[l.id]-oilYear[l.id]:null;return <div key={l.id}><span><i style={{background:l.color}}/>{l.name}</span><b>${fmt(oilLast?.[l.id])}<small>/ bbl</small></b><p className={change>0?'up':change<0?'down':''}>1년 전 대비 {signed(change)} $/bbl <span>({signed(pct(oilLast?.[l.id],oilYear?.[l.id]),1)}%)</span></p></div>})}<div><span>브렌트 − WTI</span><b>{signed(oilLast?oilLast.brent-oilLast.wti:null)}<small>$/bbl</small></b><p>동일 관측일 · {day(oilLast?.date)}</p></div></div>
      <HistoryChart rows={oilRows} lines={OILS} label="WTI·브렌트 최근 1년 가격 차트" unit="$/bbl"/>
      <p className="history-note">1년 전 비교일: {day(oilYear?.date)}. 최신 공통 관측일의 365일 전 또는 그 이전의 가장 가까운 공통값을 사용합니다. 현물가격이며 선물가격과 다를 수 있습니다.</p>
    </section>
    <section className="panel history-panel" id="crack-spread" aria-labelledby="crack-history-title">
      <div className="section-head"><div><h2 id="crack-history-title">크랙 스프레드 · 최근 1년</h2><p>가솔린·경유 단일 제품과 3:2:1 복합 스프레드의 추이.</p></div><button className="text-button" aria-label="크랙 스프레드 1년 추이 CSV 다운로드" disabled={!crackRows.length} onClick={()=>download(crackRows,CRACKS,`USD/${unit}`,`fuel-signal-crack-${benchmark}-1y.csv`,benchmark)}><Download size={14}/> CSV</button></div>
      <div className="crack-controls"><div className="benchmark-controls"><span>원유 비교 기준</span><div className="segmented" role="group" aria-label="크랙 스프레드 원유 기준">{[['brent','브렌트'],['wti','WTI']].map(([id,name])=><button key={id} aria-pressed={benchmark===id} className={benchmark===id?'active':''} onClick={()=>onBenchmarkChange(id)}>{name}</button>)}</div></div><label>표시 단위 <select aria-label="크랙 스프레드 표시 단위" value={unit} onChange={e=>setUnit(e.target.value)}><option value="bbl">달러 / 배럴</option><option value="gal">달러 / 갤런</option></select></label></div>
      <div className="history-stats">{CRACKS.map(l=>{const week=crackLast&&crackWeek?(crackLast[l.id]-crackWeek[l.id])/factor:null;const year=crackLast&&crackYear?(crackLast[l.id]-crackYear[l.id])/factor:null;return <div key={l.id}><span><i style={{background:l.color}}/>{l.name}{l.id!=='composite'&&' 1:1'}</span><b>{fmt(crackLast?crackLast[l.id]/factor:null,digits)}<small>{displayUnit}</small></b><p>1주 전 대비 <strong className={week>0?'up':week<0?'down':''}>{signed(week,digits)}</strong> · 1년 전 <strong className={year>0?'up':year<0?'down':''}>{signed(year,digits)}</strong> {displayUnit}</p></div>})}</div>
      <HistoryChart key={benchmark+unit} rows={crackRows} lines={CRACKS} label="크랙 스프레드 최근 1년 차트" unit={displayUnit} zero/>
      <p className="history-note">{benchmarkLabel} + 뉴욕항 가솔린·초저유황 경유 현물. 세 자료가 모두 있는 날짜만 계산합니다. 기준일 {day(crackLast?.date)} · 1주 전 비교 {day(crackWeek?.date)} · 1년 전 비교 {day(crackYear?.date)}. 소매가격 발표를 기다리지 않아 아래 원가 흐름과 기준일이 다를 수 있습니다.</p>
      <CrackGuide/>
      <details className="spread-method"><summary>계산식과 원자료 기준</summary><div><p><b>단일 제품 1:1:</b> 제품가격($/gal) × 42 − {benchmarkLabel}($/bbl).</p><p><b>복합 3:2:1:</b> [가솔린($/gal) × 42 × 2 + 경유($/gal) × 42 − {benchmarkLabel}($/bbl) × 3] ÷ 3. 원유 1배럴당 참고치이며 갤런 표시는 이 값을 42로 나눕니다.</p><p>이 화면은 EIA 개별 현물가격으로 계산한 뉴욕항 기준 참고치입니다. 거래소의 선물 스프레드나 EIA의 걸프만·LLS 예시와는 기준이 다릅니다. <a href="https://www.eia.gov/todayinenergy/includes/crackspread_explain.php" target="_blank" rel="noreferrer">EIA 계산 설명 ↗</a></p></div></details>
      <div className="method-note"><Info size={14}/><span>스프레드 확대는 제품가격이 원유보다 상대적으로 강해졌다는 뜻입니다. 정제 에너지·운영비 등은 차감하지 않아 정유사의 순이익과는 다릅니다. 음수도 그대로 표시하며, 0을 넘나드는 값의 비교는 등락률 대신 달러 차이로 표시합니다.</span></div>
    </section>
  </section>;
}
