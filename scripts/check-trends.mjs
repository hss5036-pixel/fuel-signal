import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crackHistory, oilHistory, lastYear, pastObservation, historyCsv} from '../lib/market-trends.mjs';
const series = entries => ({points: entries.map(([date,value])=>({date,value}))});
const data={series:{
  wti:series([['2025-10-17',80],['2026-10-12',100],['2026-10-19',84],['2026-10-20',126]]),
  brent:series([['2025-10-17',90],['2026-10-12',105],['2026-10-19',90],['2026-10-21',130]]),
  gasSpot:series([['2025-10-17',2],['2026-10-12',2],['2026-10-19',3],['2026-10-20',2]]),
  dieselSpot:series([['2025-10-17',3],['2026-10-12',3],['2026-10-19',4]])
}};
test('1:1 and 3:2:1 convert gallons to barrels before subtracting crude',()=>{
  const row=crackHistory(data,'wti').at(-1);
  assert.equal(row.date,'2026-10-19');assert.equal(row.gasoline,42);assert.equal(row.diesel,84);assert.equal(row.composite,56);
  assert.equal(row.composite,(2*row.gasoline+row.diesel)/3);
  assert.equal(crackHistory(data,'brent').at(-1).composite,50);
  assert(crackHistory(data,'wti').some(p=>p.gasoline<0));
});
test('missing observations are not filled from different dates',()=>{
  assert.equal(oilHistory(data).at(-1).date,'2026-10-19');
  assert.equal(crackHistory(data,'wti').length,3);
  assert.deepEqual(crackHistory(data,'unknown'),[]);
  assert.deepEqual(crackHistory({series:{wti:data.series.wti}},'wti'),[]);
});
test('last-year window and comparison baseline use latest common observation',()=>{
  const all=oilHistory(data),shown=lastYear(all);
  assert.equal(shown.length,2);assert.equal(pastObservation(all,365).date,'2025-10-17');
  assert.equal(pastObservation(all,7).date,'2026-10-12');
  assert.equal(pastObservation(shown,365),null);assert.deepEqual(lastYear([]),[]);
});
test('CSV keeps observation dates, units and benchmark',()=>{
  const rows=crackHistory(data,'brent');const csv=historyCsv(rows,[{id:'composite'}],'USD/bbl','brent');
  assert(csv.includes('2026-10-19,composite,50,USD/bbl,brent,EIA'));
  assert.equal(csv.split('\n').length,rows.length+1);
});
