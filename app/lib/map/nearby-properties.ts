type NearbyProperty = { dong: string; count: number; lastAmount: number; name?: string; jibun?: string; key?: string; id?: string };

export function selectNearbyPropertyCandidates<T extends NearbyProperty>(
  properties: T[],
  selectedDong: string,
  totalLimit = 30,
  selectedLimit = 12,
) {
  const uniqueBuildings = [...new Map(properties.map((property, index) => [
    `${property.dong}|${property.jibun || property.name || property.key || property.id || index}`,
    property,
  ])).values()];
  const ranked = (rows: T[]) => [...rows].sort((a, b) => b.count - a.count || b.lastAmount - a.lastAmount);
  const selected = ranked(uniqueBuildings.filter((property) => property.dong === selectedDong)).slice(0, selectedLimit);
  const groups = new Map<string, T[]>();
  ranked(uniqueBuildings.filter((property) => property.dong !== selectedDong)).forEach((property) => {
    groups.set(property.dong, [...(groups.get(property.dong) || []), property]);
  });

  const nearby: T[] = [];
  const queues = [...groups.entries()].sort((a, b) => (b[1][0]?.count || 0) - (a[1][0]?.count || 0)).map(([, rows]) => rows);
  while (nearby.length < Math.max(0, totalLimit - selected.length) && queues.some((queue) => queue.length)) {
    queues.forEach((queue) => {
      if (nearby.length < totalLimit - selected.length) {
        const property = queue.shift();
        if (property) nearby.push(property);
      }
    });
  }
  return [...selected, ...nearby].slice(0, totalLimit);
}
