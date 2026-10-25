import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEia,parseAaa,parseRss,prior,pct,pairedCost,oilComparison} from '../lib/market.mjs';
const now=new Date('2026-10-25T00:00:00Z');
const daily='<tr><td>2025 Dec-29 to Jan- 2</td><td>60</td><td></td><td>62</td><td>NA</td><td>63</td></tr>';
const rows=Array.from({length:4},(_,i)=>`<tr><td>2026 Jan-${5+i*7} to Jan-${9+i*7}</td><td>64</td><td>65</td><td>66</td><td>67</td><td>68</td></tr>`).join('');
const parsed=parseEia(daily+rows,'D',now);assert(parsed.some(p=>p.date==='2026-01-02'&&p.value===63));assert(!parsed.some(p=>p.date==='2025-12-30'));assert(!parsed.some(p=>p.value===0));
assert.throws(()=>parseEia('<html>Service unavailable</html>','W',now));assert.throws(()=>parseAaa('<html>Service unavailable</html>'));
const series={points:[{date:'2026-10-08',value:10},{date:'2026-10-16',value:11},{date:'2026-10-20',value:12}]};assert.equal(prior(series).date,'2026-10-08');assert.equal(pct(12,10),20);assert.equal(pct(1,0),null);
const rss=parseRss('<item><title>Oil &amp; fuel</title><link>https://www.eia.gov/a</link><pubDate>Fri, 09 Oct 09:00:00 EST</pubDate></item>','EIA');assert.equal(rss[0].date,null);assert.equal(rss[0].title,'Oil & fuel');
const data=JSON.parse(await readFile('data/market.json','utf8'));assert.equal(Object.keys(data.series).length,10);assert.equal(data.sources.length,13);assert(data.aaa.gasoline.current>0);assert(data.aaa.diesel.current>0);
for(const s of Object.values(data.series)){assert(s.points.length>250);for(let i=1;i<s.points.length;i++)assert(s.points[i].date>s.points[i-1].date);assert(s.points.every(p=>Number.isFinite(p.value)&&p.date<=data.checkedAt.slice(0,10)));}
for(const f of ['gasoline','diesel'])for(const oil of ['wti','brent']){const c=pairedCost(data,f,oil);assert(c.spot.date<=c.retail.date);assert.equal(c.oil.date,c.spot.date);assert.equal(c.benchmark,oil);assert(Math.abs(c.spread-(c.spot.value-c.oil.value/42))<1e-9);assert(Date.parse(c.previous.date)<=Date.parse(c.date)-7*86400000);}
const points=values=>({points:values.map(([date,value])=>({date,value}))});
const mismatched={series:{
  gasoline:points([['2026-10-19',4]]),
  gasSpot:points([['2026-10-05',2.2],['2026-10-12',2.8],['2026-10-16',3],['2026-10-19',3.2],['2026-10-20',3.3]]),
  wti:points([['2026-10-05',84],['2026-10-12',95],['2026-10-16',126],['2026-10-20',168]]),
  brent:points([['2026-10-05',88.2],['2026-10-13',100],['2026-10-16',105],['2026-10-19',106]])
}};
const matched=oilComparison(mismatched);assert.equal(matched.date,'2026-10-16');assert.equal(matched.spread,-21);assert.equal(matched.previous.date,'2026-10-05');
const wtiCost=pairedCost(mismatched,'gasoline','wti');assert.equal(wtiCost.date,'2026-10-16');assert.equal(wtiCost.spread,0);assert.equal(wtiCost.previous.date,'2026-10-05');assert.equal(wtiCost.gap,1);
assert.equal(pairedCost(mismatched,'gasoline','brent').date,'2026-10-19');
assert.equal(pairedCost(mismatched,'gasoline','unknown'),null);
assert.equal(pairedCost({series:{gasoline:mismatched.series.gasoline}},'gasoline','brent'),null);
assert.equal(oilComparison({series:{wti:mismatched.series.wti}}),null);
console.log('PASS: date parsing, missing data, source histories, WTI/Brent selection, shared-date comparisons, negative spreads, and no future observations');
