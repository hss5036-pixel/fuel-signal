// Join actual observations only; never carry a missing price into another date.
export function commonObservations(data, ids) {
  if (!ids.length) return [];
  const maps = ids.map(id => new Map((data.series?.[id]?.points ?? [])
    .filter(p => Number.isFinite(p.value)).map(p => [p.date, p.value])));
  return [...maps[0].keys()].filter(date => maps.every(m => m.has(date))).sort()
    .map(date => Object.fromEntries([['date', date], ...ids.map((id, i) => [id, maps[i].get(date)])]));
}

export function oilHistory(data) {
  return commonObservations(data, ['wti', 'brent']);
}

export function crackHistory(data, benchmark = 'brent') {
  if (!['wti', 'brent'].includes(benchmark)) return [];
  return commonObservations(data, [benchmark, 'gasSpot', 'dieselSpot']).map(row => ({
    date: row.date,
    gasoline: row.gasSpot * 42 - row[benchmark],
    diesel: row.dieselSpot * 42 - row[benchmark],
    composite: (2 * row.gasSpot * 42 + row.dieselSpot * 42 - 3 * row[benchmark]) / 3
  }));
}

export function pastObservation(rows, days) {
  if (!rows.length) return null;
  const cutoff = new Date(Date.parse(rows.at(-1).date) - days * 86400000).toISOString().slice(0, 10);
  return rows.filter(row => row.date <= cutoff).at(-1) ?? null;
}

export function lastYear(rows) {
  if (!rows.length) return [];
  const cutoff = new Date(Date.parse(rows.at(-1).date) - 365 * 86400000).toISOString().slice(0, 10);
  return rows.filter(row => row.date >= cutoff);
}

export function historyCsv(rows, lines, unit, benchmark = '') {
  return ['date,series,value,unit,benchmark,source',
    ...rows.flatMap(row => lines.map(line => `${row.date},${line.id},${row[line.id]},${unit},${benchmark},EIA`))].join('\n');
}
