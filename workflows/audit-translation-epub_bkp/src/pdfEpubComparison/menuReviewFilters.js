export function pendingCategoryOptions(queue) {
  const pendingItems = (queue?.items || []).filter((item) => item.status === 'pending');
  const byCategory = new Map();

  for (const item of pendingItems) {
    const id = item.categoryId || item.group || 'unknown';
    const current = byCategory.get(id) || {
      id,
      label: item.categoryLabel || id,
      count: 0,
    };
    current.count += 1;
    byCategory.set(id, current);
  }

  return [...byCategory.values()]
    .sort((a, b) => categoryOrder(a.id) - categoryOrder(b.id) || a.label.localeCompare(b.label, 'pt-BR'));
}

function categoryOrder(id) {
  return {
    coverage: 1,
    meaning: 2,
    residual_language: 3,
    characters: 4,
    terminology: 5,
    titles: 6,
    editorial: 7,
  }[id] || 99;
}

export function filterPendingItems(queue, categoryId = null) {
  return (queue?.items || []).filter((item) => {
    if (item.status !== 'pending') return false;
    if (!categoryId) return true;
    return (item.categoryId || item.group) === categoryId;
  });
}
