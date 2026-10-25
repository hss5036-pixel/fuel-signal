import {test} from 'node:test';
import assert from 'node:assert/strict';
import {priceAttribution,describeMovement,indicatorEvidence,relatedNews} from '../lib/daily-brief.mjs';
const NOW=new Date('2026-10-25T12:00:00Z');
const series=entries=>({points:entries.map(([date,value])=>({date,value}))});
const data={series:{brent:series([['2026-10-09',84],['2026-10-16',105],['2026-10-19',126],['2026-10-20',120]]),wti:series([['2026-10-09',80],['2026-10-16',90],['2026-10-19',100]]),gasSpot:series([['2026-10-09',3],['2026-10-16',3.25],['2026-10-19',3.50]]),dieselSpot:series([['2026-10-09',4],['2026-10-16',4.1],['2026-10-20',4.2]])},sources:[]};
const close=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('matched gasoline and diesel dates decompose exactly in $/gal with offsetting components',()=>{
  const gas=priceAttribution(data,'gasoline','brent','week',NOW);
  assert.equal(gas.date,'2026-10-19');assert.equal(gas.previousDate,'2026-10-09');
  close(gas.oil,1);close(gas.crack,-.5);close(gas.total,.5);
  assert(gas.summary.includes('일부 상쇄'));
  const diesel=priceAttribution(data,'diesel','brent','day',NOW);
  assert.equal(diesel.date,'2026-10-20');assert.equal(diesel.previousDate,'2026-10-16');
  close(diesel.oil+diesel.crack,diesel.total);close(diesel.total,.1);
});
test('changing benchmark changes the split but never the product-price total on the same dates',()=>{
  const brent=priceAttribution(data,'gasoline','brent','week',NOW),wti=priceAttribution(data,'gasoline','wti','week',NOW);
  close(brent.total,wti.total);close(brent.oil+brent.crack,wti.oil+wti.crack);
  assert.notEqual(brent.oil,wti.oil);
});
test('zero, opposite signs and all-decline summaries do not invent an increase',()=>{
  assert.match(describeMovement(.5,-.5),/현물가격은 같습니다/);
  assert.match(describeMovement(0,0),/변동이 없습니다/);
  assert.match(describeMovement(-.5,-.1),/함께 하락/);
  assert.match(describeMovement(0,-.5),/하락분은 크랙/);
  assert.match(describeMovement(-.1,.3),/크랙 변화가 상승/);
  assert.match(describeMovement(.1,-.3),/크랙 변화가 하락/);
});
test('future, missing and widely separated observations never produce a misleading period summary',()=>{
  assert.equal(priceAttribution(data,'gasoline','brent','year',NOW).state,'missing');
  assert.equal(priceAttribution({series:{}},'diesel','brent','week',NOW).state,'missing');
  const sparse={series:{brent:series([['2026-01-01',80],['2026-10-19',90],['2027-01-01',100]]),gasSpot:series([['2026-01-01',2],['2026-10-19',3],['2027-01-01',4]])}};
  for(const period of ['day','week'])assert.equal(priceAttribution(sparse,'gasoline','brent',period,NOW).state,'missing');
  assert.equal(priceAttribution(data,'gasoline','brent','day',new Date('2026-10-18')).date,'2026-10-16');
});
test('last good data remain labeled as delayed and observation age is explicit',()=>{
  const result=priceAttribution({...data,sources:[{id:'gasSpot',ok:false}]},'gasoline','brent','week',NOW);
  assert.equal(result.delayed,true);assert.equal(result.ageDays,6);
  assert.equal(priceAttribution({...data,refreshStatus:{state:'failed'}},'diesel','brent','day',NOW).delayed,true);
});
test('stocks use million barrels, utilization uses percentage points, missing demand is not zero',()=>{
  const sample={series:{gasStocks:series([['2026-10-09',210000],['2026-10-16',208000]]),utilization:series([['2026-10-09',90],['2026-10-16',91.5]])}};
  const [stock,util,demand]=indicatorEvidence(sample,'gasoline',NOW);
  close(stock.change,-2);assert.equal(stock.pressure,1);assert.equal(stock.displayUnit,'백만 bbl');
  close(util.change,1.5);assert.equal(util.displayUnit,'%p');assert.equal(util.pressure,-1);
  assert.equal(demand.state,'missing');
});
test('news matches petroleum topics and dates, excludes old/undated/future/natural-gas-only stories',()=>{
  const news=(title,date,url='https://www.eia.gov/todayinenergy/'+title)=>({title,date,url,source:'EIA'});
  const sample={news:[news('Diesel inventories fall','2026-10-18'),news('Refineries run at high rates','2026-10-22'),news('Natural gas production reaches a record','2026-10-24'),news('Crude oil rises','2027-10-25'),news('Crude oil old article','2026-08-01'),news('Crude oil date unknown',null),news('Crude oil suspicious','2026-10-24','javascript:alert(1)')]};
  const result=relatedNews(sample,'diesel',{date:'2026-10-20',previousDate:'2026-10-13'},NOW);
  assert.equal(result.length,2);assert.equal(result[0].relation,'현물 기준일 이후 기사');assert.equal(result[1].relation,'비교기간 내 기사');
  assert(!relatedNews(sample,'gasoline',{date:'2026-10-20',previousDate:'2026-10-13'},NOW).some(n=>n.title.includes('Diesel')));
  assert.deepEqual(relatedNews({news:[]},'gasoline',{},NOW),[]);
});
