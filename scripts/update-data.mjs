import {readFile, writeFile, rename, appendFile} from 'node:fs/promises';
import {refreshSnapshot} from '../lib/refresh.mjs';
const path = 'data/market.json';
const previous = JSON.parse(await readFile(path, 'utf8'));
const next = await refreshSnapshot(previous);
await writeFile(`${path}.tmp`, JSON.stringify(next));
await rename(`${path}.tmp`, path);
const {state, successCount, attemptedAt} = next.refreshStatus;
console.log(JSON.stringify({state, successCount, attemptedAt, retailDate: next.aaa.date}));
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `health=${state}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Fuel Signal 데이터 수집\n\n- 상태: ${state}\n- 확인 시각: ${attemptedAt}\n- 정상 출처: ${successCount}/13\n- AAA 기준일: ${next.aaa.date}\n\n실패한 출처는 마지막 정상값을 유지합니다.\n`);
}
