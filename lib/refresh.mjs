import {collect, SERIES} from './market.mjs';

export function validateSnapshot(data) {
  if (!data || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error('수집 시각이 없습니다.');
  for (const fuel of ['gasoline', 'diesel']) {
    if (!(data.aaa?.[fuel]?.current > 0)) throw new Error('소매가격이 없습니다.');
  }
  for (const {id} of SERIES) {
    const points = data.series?.[id]?.points;
    if (!points?.length || points.some(p => !Number.isFinite(p.value) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date))) {
      throw new Error(`유효하지 않은 지표: ${id}`);
    }
    if (points.some((p, i) => i && p.date <= points[i - 1].date)) throw new Error(`날짜 순서 오류: ${id}`);
  }
  if (!Array.isArray(data.news) || !Array.isArray(data.sources) || !Array.isArray(data.dailyHistory)) {
    throw new Error('자료 구조를 확인할 수 없습니다.');
  }
  return data;
}

export async function refreshSnapshot(previous, collector = collect, attemptedAt = new Date().toISOString()) {
  validateSnapshot(previous);
  try {
    const next = validateSnapshot(await collector(previous));
    const failedSources = next.sources.filter(s => !s.ok).map(s => s.id);
    return {...next, refreshStatus: {
      state: failedSources.length ? 'partial' : 'ok', attemptedAt,
      successCount: next.successCount, failedSources
    }};
  } catch (error) {
    return {...previous, refreshStatus: {
      state: 'failed', attemptedAt, successCount: 0,
      error: String(error.message ?? '수집 실패')
    }};
  }
}
