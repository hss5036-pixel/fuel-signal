import {useState} from 'react';
import {ArrowUpRight,Info,Fuel} from 'lucide-react';
import {PERIODS,priceAttribution,indicatorEvidence,relatedNews} from '../lib/daily-brief.mjs';
const day=(s?:string)=>s?.replaceAll('-','.')??'—';
const fmt=(n:any,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const signed=(n:any,d=2)=>Number.isFinite(n)?`${n>0?'+':''}${fmt(n,d)}`:'—';
const tone=(n:number)=>n>1e-8?'up':n< -1e-8?'down':'flat';

function Contribution({analysis,benchmarkLabel}:any){
  const scale=Math.max(Math.abs(analysis.oil),Math.abs(analysis.crack),Math.abs(analysis.total),.00001);
  return <div className="contribution" aria-label="현물가격 변화의 원유·크랙 분해">
    <div className="contribution-caption"><b>현물가격 변화 분해</b><span>센트 / 갤런</span></div>
    {[['원유 변화',analysis.oil,'oil'],['크랙 변화',analysis.crack,'crack'],['현물가격 변화',analysis.total,'total']].map(([name,value,id]:any)=><div className={`contribution-row ${id}`} key={id}>
      <span>{name}</span><div className="contribution-track" aria-hidden="true"><i style={{left:value<0?`${50-Math.abs(value)/scale*48}%`:'50%',width:`${Math.abs(value)/scale*48}%`}} className={tone(value)}/></div><b className={tone(value)}>{signed(value*100)}</b>
    </div>)}
    <p>{benchmarkLabel} 변화 ÷ 42 + 해당 제품 크랙 변화 = 현물가격 변화<br/>같은 시작일·종료일로 계산 · 반올림으로 합계가 0.01센트 다를 수 있습니다.</p>
  </div>;
}

export default function DailyBrief({data,benchmark,onBenchmarkChange}:any){
  const [period,setPeriod]=useState('week');
  const benchmarkLabel=benchmark==='brent'?'브렌트':'WTI';
  const now=new Date();
  const stale=now.getTime()-Date.parse(data.checkedAt)>36*3600000;
  const failure=data.refreshStatus?.state==='failed';
  const newsDelayed=failure||data.sources?.some((s:any)=>s.id.endsWith('News')&&!s.ok);
  return <section id="daily-brief" className="daily-brief" aria-labelledby="daily-brief-title">
    <div className="section-head outside"><div><div className="eyebrow">TODAY, EXPLAINED</div><h2 id="daily-brief-title">오늘의 가격 해설</h2><p>두 연료의 움직임을 원유·크랙·수급 자료로 매일 다시 읽습니다.</p></div><a className="brief-help" href="#crack-guide">3:2:1과 개별 크랙 읽는 법 <ArrowUpRight size={14}/></a></div>
    <div className="daily-controls"><div><span>변화 비교</span><div className="segmented" role="group" aria-label="가격 해설 비교 기간">{Object.entries(PERIODS).map(([id,p]:any)=><button key={id} aria-pressed={period===id} className={period===id?'active':''} onClick={()=>setPeriod(id)}>{p.label}</button>)}</div></div><label>원유 기준 <select aria-label="가격 해설 원유 기준" value={benchmark} onChange={e=>onBenchmarkChange(e.target.value)}><option value="brent">브렌트</option><option value="wti">WTI</option></select></label></div>
    <p className="daily-intro">소매는 AAA 전국 평균, 변화 분해는 EIA 뉴욕항 현물입니다. 현물의 ‘직전 관측’은 전 거래 관측일이며 소매의 전일과 다를 수 있습니다. 기준유에 따라 원유·크랙 분해액도 달라집니다.</p>
    {(failure||stale)&&<p className="brief-alert" role="status">{failure?'최근 수집에 실패했습니다.':'마지막 자료 확인 후 36시간이 지났습니다.'} 저장된 자료의 요약이며 최신 시장 움직임으로 해석하지 마세요.</p>}
    <div className="daily-cards">{['gasoline','diesel'].map(fuel=>{
      const label=fuel==='gasoline'?'가솔린':'경유',a=data.aaa?.[fuel];
      const retail=Number.isFinite(a?.current)&&Number.isFinite(a?.[period])?a.current-a[period]:null;
      const analysis=priceAttribution(data,fuel,benchmark,period,now);
      const evidence=indicatorEvidence(data,fuel,now),news=relatedNews(data,fuel,analysis,now);
      return <article className={`daily-card ${fuel}`} key={fuel} aria-labelledby={`daily-${fuel}`}>
        <div className="daily-card-head"><span><Fuel size={18}/><h3 id={`daily-${fuel}`}>{label}</h3></span><small>{fuel==='gasoline'?'REGULAR':'ULSD 현물'}</small></div>
        <div className="retail-summary"><span>전국 소매 <b>${fmt(a?.current,3)}</b> /gal</span><strong className={tone(retail??0)}>{signed(retail===null?null:retail*100)}¢ <small>{period==='day'?'전일':PERIODS[period].label} 대비</small></strong><p>AAA · {day(data.aaa?.date)}{now.getTime()-Date.parse(data.aaa?.date)>3*86400000?' · 소매 발표 지연':''}</p></div>
        {analysis.state==='ok'?<>
          <h4 className="daily-verdict">{analysis.summary}</h4>
          <p className="brief-period">현물 비교일 {day(analysis.previousDate)} → {day(analysis.date)} · {analysis.gapDays}일 간격</p>
          {(analysis.delayed||analysis.ageDays>7)&&<p className="brief-alert">{analysis.delayed?'해당 가격 출처의 수집이 지연돼 저장된 관측값을 사용합니다.':'현물 관측일이 7일 이상 지났습니다. 최신 발표를 확인하세요.'}</p>}
          <Contribution analysis={analysis} benchmarkLabel={benchmarkLabel}/>
          <p className="retail-link">{retail!==null&&Math.abs(retail)>1e-8&&Math.abs(analysis.total)>1e-8&&Math.sign(retail)!==Math.sign(analysis.total)?'소매와 현물의 방향이 다릅니다. 기준일 차이, 가격 반영 시차와 지역·유통 여건을 확인하세요.':'소매가격에는 유통·세금·지역 차이와 반영 시차가 있습니다. 위 분해액을 소매 변동의 기여액으로 보지 마세요.'}</p>
          <div className="brief-source-links">{analysis.sources.map((s:any)=><a key={s.id} href={s.url} target="_blank" rel="noreferrer">{s.name} 원자료 ↗</a>)}</div>
        </>:<div className="brief-empty">{analysis.reason}</div>}
        <details className="evidence-details" open><summary>함께 볼 수급 신호 <small>최신 주간 · 전주 대비</small></summary><div className="brief-evidence">{evidence.map((e:any)=><div key={e.id}>
          <div><a href={e.url} target="_blank" rel="noreferrer">{e.name} ↗</a><b>{e.state==='ok'?`${signed(e.change,e.id==='demand'?0:2)} ${e.displayUnit}`:'비교값 부족'}</b></div>
          {e.state==='ok'&&<><p>{e.explanation}</p><small>{day(e.previousDate)} → {day(e.date)}{e.delayed?' · 수집 지연':e.stale?' · 오래된 관측값':''}</small></>}
        </div>)}</div><p className="evidence-note">가격과 관측일이 다를 수 있는 보조 신호입니다. {fuel==='gasoline'?'제품공급량은 수요 대리지표입니다.':'중간유분 재고에는 경유와 난방유 등이 포함됩니다.'} 단독으로 원인을 확정하지 않습니다.</p></details>
        <div className="brief-news"><h4>관련 뉴스·발표 <small>최근 21일</small></h4>{newsDelayed&&<p className="brief-alert">뉴스 수집 지연 · 마지막으로 저장된 기사를 표시합니다.</p>}{news.length?news.map((n:any)=><a href={n.url} key={n.url} target="_blank" rel="noreferrer"><div><b>{n.kind}</b><small>{n.source} · {day(n.date)}</small></div><p>{n.title}</p><span>{n.context}</span><small className="news-timing">{n.relation} · 원문 ↗</small></a>):<p className="brief-empty">최근 21일 내 확인된 관련 기사가 없습니다. 새 기사가 수집되면 표시됩니다.</p>}<p className="news-caveat">기사 연결은 제목의 주제 기준이며 가격 변동의 확정 원인이나 기사 내용의 자동 요약은 아닙니다.</p></div>
      </article>;
    })}</div>
    <p className="daily-method"><Info size={14}/><span>매일 09:17 KST 수집 후 수치에 따라 요약을 다시 계산합니다. 휴일·미발표일에는 최근 관측을 유지합니다. 원유와 크랙 분해는 가격 차이의 산술적 설명이며 인과관계의 추정치는 아닙니다.</span></p>
  </section>;
}

export function CrackGuide(){return <section id="crack-guide" className="crack-guide" aria-labelledby="crack-guide-title">
  <h3 id="crack-guide-title">어떤 크랙을 보면 될까요?</h3>
  <p className="guide-lead">가솔린은 <b>가솔린 크랙 + 원유</b>, 경유는 <b>경유 크랙 + 원유</b>를 먼저 보세요. 3:2:1은 두 제품을 묶은 정제시장 참고치입니다.</p>
  <div className="guide-ratio"><span><b>3</b>배럴 원유</span><em>→</em><span><b>2</b>배럴 가솔린</span><em>+</em><span><b>1</b>배럴 중간유분</span></div>
  <p>3:2:1은 대표적인 생산 구성을 단순화한 가정입니다. 이 사이트는 중간유분에 초저유황 경유 가격을 사용합니다. 실제 정유공장의 생산 비율은 다릅니다.</p>
  <div className="guide-table-wrap"><table><caption>세 크랙스프레드의 차이 · 모두 배럴당 달러 기준</caption><thead><tr><th>지표</th><th>계산</th><th>보는 목적</th></tr></thead><tbody><tr><th>가솔린 1:1</th><td>가솔린 − 원유</td><td>가솔린의 상대적인 가격</td></tr><tr><th>경유 1:1</th><td>경유 − 원유</td><td>경유의 상대적인 가격</td></tr><tr><th>3:2:1 복합</th><td>(가솔린 크랙 × 2 + 경유 크랙) ÷ 3</td><td>두 제품을 묶은 정제마진 흐름</td></tr></tbody></table></div>
  <details><summary>숫자 예시와 가격 상승을 읽는 순서</summary><div className="guide-more"><p><b>가상의 예시:</b> 원유 80달러, 가솔린 90달러, 경유 120달러라면 개별 크랙은 10달러·40달러, 3:2:1은 20달러입니다. 모두 배럴당 가격입니다. 복합 지표만 보면 경유 쪽의 큰 가격차가 덜 드러납니다.</p><ol><li><b>원유 상승 + 개별 크랙 유지:</b> 현물 상승분이 원유 변화에 해당합니다.</li><li><b>원유 유지 + 개별 크랙 상승:</b> 제품 재고·정비·수요·수출 자료를 확인하세요.</li><li><b>원유와 개별 크랙 모두 상승:</b> 두 항목이 현물가격을 함께 끌어올립니다.</li></ol><p>크랙 확대는 원유 하락만으로도 생깁니다. 제품 가격 상승을 의미하지는 않습니다. 가솔린은 운전 수요·연료 규격, 경유는 운송·난방 수요도 함께 살펴보세요.</p><p>개별 1:1은 같은 부피의 가격 비교이며, 원유 전량이 해당 제품으로 바뀐다는 가정이 아닙니다. 갤런당 제품가격에 42를 곱하면 배럴당 가격입니다.</p></div></details>
  <p className="guide-bottom">크랙에는 정제 에너지·운영비 등이 차감되지 않아 순이익과 다릅니다. <a href="https://www.eia.gov/todayinenergy/includes/crackspread_explain.php" target="_blank" rel="noreferrer">EIA 계산 설명 ↗</a> · <a href="https://www.eia.gov/finance/markets/products/prices.php" target="_blank" rel="noreferrer">EIA 수급·계절성 설명 ↗</a></p>
</section>}
