import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {refreshSnapshot, validateSnapshot} from '../lib/refresh.mjs';
const previous = JSON.parse(await readFile('data/market.json', 'utf8'));
const at = '2026-10-25T12:00:00Z';
test('complete source failure preserves last good prices and observation time', async () => {
  const next = await refreshSnapshot(previous, async () => {throw new Error('offline');}, at);
  assert.equal(next.refreshStatus.state, 'failed');
  assert.equal(next.refreshStatus.attemptedAt, at);
  assert.equal(next.checkedAt, previous.checkedAt);
  assert.deepEqual(next.series, previous.series);
  assert.deepEqual(next.aaa, previous.aaa);
  assert.deepEqual(next.dailyHistory, previous.dailyHistory);
});
test('partial refresh reports affected sources and retains usable data', async () => {
  const partial = {...previous, successCount: 12, sources: previous.sources.map(s => ({...s, ok: s.id !== 'aaa'}))};
  const next = await refreshSnapshot(previous, async () => partial, at);
  assert.equal(next.refreshStatus.state, 'partial');
  assert.deepEqual(next.refreshStatus.failedSources, ['aaa']);
  assert.deepEqual(next.aaa, previous.aaa);
});
test('invalid new data cannot replace the last good snapshot', async () => {
  const next = await refreshSnapshot(previous, async () => ({...previous, aaa: null}), at);
  assert.equal(next.refreshStatus.state, 'failed');
  assert.deepEqual(next.aaa, previous.aaa);
  assert.throws(() => validateSnapshot({...previous, series: {}}));
});
test('successful refresh clears earlier failure status', async () => {
  const next = await refreshSnapshot({...previous, refreshStatus: {state: 'failed'}},
    async () => ({...previous, successCount: 13, sources: previous.sources.map(s => ({...s, ok: true}))}), at);
  assert.equal(next.refreshStatus.state, 'ok');
  assert.equal(next.refreshStatus.successCount, 13);
});
