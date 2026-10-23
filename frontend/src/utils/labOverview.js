// Groups are presentation labels, not organ-health assessments. Unknown tests remain visible.
export const OVERVIEW_GROUPS = [
  { id: 'blood', title: 'Blood count' },
  { id: 'glucose', title: 'Glucose' },
  { id: 'lipids', title: 'Lipids' },
  { id: 'kidney', title: 'Kidney markers' },
  { id: 'liver', title: 'Liver markers' },
  { id: 'thyroid', title: 'Thyroid' },
  { id: 'vitamins', title: 'Vitamins' },
  { id: 'other', title: 'Other tests' },
];
export const normalizeTestName = value =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const isFlagged = item =>
  ['high', 'low', 'critical', 'abnormal', 'borderline'].includes(item.status);
export const observationDate = item =>
  item.completed_date || item.ordered_date || null;
// Only reviewed spellings and scale-identical notation are matched. No values are converted.
export function comparisonUnit(unit) {
  const source = String(unit || '').trim();
  const equivalent = {
    'mg/dl': 'mg/dL',
    mgldl: 'mg/dL',
    'g/dl': 'g/dL',
    'ng/ml': 'ng/mL',
    'pg/ml': 'pg/mL',
    'uIU/ml': 'µIU/mL',
    'uIU/mL': 'µIU/mL',
    'μIU/mL': 'µIU/mL',
    'ug/dL': 'µg/dL',
    'x10^3/ul': 'x10^9/L',
    'x10^6/ul': 'x10^12/L',
  };
  return equivalent[source] || source;
}
export const VITAMIN_D25_OH = 'Vitamin D (25-OH)';
const vitaminD25OhNames = new Set([
  '25 oh vitamin d',
  'vitamin d t 25 oh',
  'vitamin d 25 oh',
]);
export const isVitaminD25Oh = item =>
  vitaminD25OhNames.has(
    normalizeTestName(item.canonical_test_name || item.test_name)
  );
// These two source labels are one marker by the owner's explicit mapping.
export const markerName = item =>
  isVitaminD25Oh(item) ? VITAMIN_D25_OH : item.test_name;
export const measurementKey = item =>
  [
    normalizeTestName(
      isVitaminD25Oh(item)
        ? VITAMIN_D25_OH
        : item.canonical_test_name || item.test_name
    ),
    comparisonUnit(item.unit),
    item.result_type || 'quantitative',
  ].join('|');

export function previousComparison(components, current) {
  const date = observationDate(current);
  const numeric = row =>
    (row.result_type || 'quantitative') === 'quantitative' &&
    typeof row.value === 'number' &&
    Number.isFinite(row.value);
  if (!date || !comparisonUnit(current.unit) || !numeric(current)) return null;
  const same = components.filter(
    row => measurementKey(row) === measurementKey(current)
  );
  // Same-day conflicting readings cannot be ordered from an import ID.
  if (
    same.some(
      row =>
        observationDate(row) === date &&
        numeric(row) &&
        row.value !== current.value
    )
  )
    return null;
  const earlier = same.filter(
    row => observationDate(row) && observationDate(row) < date && numeric(row)
  );
  const previousDate = earlier.map(observationDate).sort().at(-1);
  if (!previousDate) return null;
  const candidates = earlier.filter(
    row => observationDate(row) === previousDate
  );
  if (new Set(candidates.map(row => row.value)).size !== 1) return null;
  const previous = candidates[0];
  const change = current.value - previous.value;
  return {
    previous,
    change,
    percent:
      previous.value === 0 ? null : (100 * change) / Math.abs(previous.value),
  };
}

export const displayChange = value =>
  Number(value.toPrecision(3)).toLocaleString(undefined, {
    maximumSignificantDigits: 3,
    signDisplay: 'exceptZero',
  });
// Whole percentages read faster in a list; sub-1% moves keep their direction.
export const displayPercent = value => {
  const rounded = Math.round(value);
  if (rounded === 0 && value !== 0) return value > 0 ? '+<1%' : '-<1%';
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
};
export function groupForTest(item) {
  const name = normalizeTestName(item.canonical_test_name || item.test_name);
  if (/\b(vitamin|b12|folate|folic)\b/.test(name)) return 'vitamins';
  if (/\b(glucose|hba1c|a1c|glycosylated|glycosilated)\b/.test(name))
    return 'glucose';
  if (
    /\b(tsh|t3|t4|ft3|ft4|thyroid|thyroxine|triiodothyronine|thyroglobulin|thyroperoxidase)\b/.test(
      name
    )
  )
    return 'thyroid';
  if (
    /\b(cholesterol|triglycerides?|hdl|ldl|vldl|apolipoprotein|lipoprotein)\b/.test(
      name
    ) ||
    item.category === 'lipids'
  )
    return 'lipids';
  if (
    /\b(creatinine|creatnine|urea|bun|egfr|gfr|uric|calcium|sodium|potassium|chloride|bicarbonate)\b/.test(
      name
    )
  )
    return 'kidney';
  if (
    /\b(alt|ast|sgot|sgpt|ggt|gamma gt|bilirubin|albumin|globulin|phosphatase|total protein|a g ratio)\b/.test(
      name
    ) ||
    item.category === 'hepatology'
  )
    return 'liver';
  if (
    item.category === 'hematology' ||
    /\b(haemoglobin|hemoglobin|hematocrit|haematocrit|wbc|rbc|platelets?|neutrophils?|lymphocytes?|eosinophils?|monocytes?|basophils?|leucocytes?|leukocytes?|mcv|mch|mchc|rdw|pdw|p lcr)\b/.test(
      name
    )
  )
    return 'blood';
  return 'other';
}
// One marker per test name and result type. Readings in other units stay in its history but are
// never compared or plotted against it.
export const markerKey = item =>
  [
    normalizeTestName(
      isVitaminD25Oh(item)
        ? VITAMIN_D25_OH
        : item.canonical_test_name || item.test_name
    ),
    item.result_type || 'quantitative',
  ].join('|');

// Newest first. Undated readings sort last and do not borrow import dates.
const newestFirst = (a, b) =>
  (observationDate(b) || '').localeCompare(observationDate(a) || '') ||
  Number(b.id) - Number(a.id);

const isPlottable = row =>
  !!observationDate(row) &&
  !!comparisonUnit(row.unit) &&
  typeof row.value === 'number' &&
  Number.isFinite(row.value);

export function buildMetrics(components) {
  const byMarker = new Map();
  for (const item of components) {
    const key = markerKey(item);
    if (!byMarker.has(key)) byMarker.set(key, []);
    byMarker.get(key).push(item);
  }
  return [...byMarker].map(([key, rows]) => {
    const readings = [...rows].sort(newestFirst);
    const latest = readings[0];
    const sameUnit = readings.filter(
      row => measurementKey(row) === measurementKey(latest)
    );
    const latestUnit = comparisonUnit(latest.unit);
    return {
      key,
      latest,
      readings,
      group: groupForTest(latest),
      flagged: isFlagged(latest),
      comparison: previousComparison(sameUnit, latest),
      chartRows: sameUnit.filter(isPlottable).reverse(),
      otherUnits: [
        ...new Set(
          readings
            .map(row => comparisonUnit(row.unit))
            .filter(unit => unit && unit !== latestUnit)
        ),
      ],
    };
  });
}

// "Changed" means at least 5% since the previous comparable reading.
export const CHANGE_THRESHOLD = 5;
export const hasChanged = metric =>
  !!metric.comparison &&
  (metric.comparison.percent === null
    ? metric.comparison.change !== 0
    : Math.abs(metric.comparison.percent) >= CHANGE_THRESHOLD);

export function matchesQuery(metric, query) {
  const q = normalizeTestName(query);
  if (!q) return true;
  const group = OVERVIEW_GROUPS.find(g => g.id === metric.group);
  return [
    summaryTestName(metric.latest),
    group?.title,
    ...metric.readings.flatMap(row => [row.test_name, row.canonical_test_name]),
  ].some(text => normalizeTestName(text).includes(q));
}

export function filterMetrics(metrics, { query = '', filter = 'all' } = {}) {
  return metrics.filter(
    metric =>
      matchesQuery(metric, query) &&
      (filter === 'all' ||
        (filter === 'flagged'
          ? metric.flagged
          : filter === 'changed'
            ? hasChanged(metric)
            : metric.group === filter))
  );
}

const byName = (a, b) =>
  summaryTestName(a.latest).localeCompare(summaryTestName(b.latest));
// Within a category card: flagged results first, then notable changes, then A–Z.
export const orderForCard = metrics =>
  [...metrics].sort(
    (a, b) =>
      Number(b.flagged) - Number(a.flagged) ||
      Number(hasChanged(b)) - Number(hasChanged(a)) ||
      byName(a, b)
  );

// Imported readings record where they were read from, e.g. "Source: Paperless document 81, page 2."
export function sourcePage(item) {
  const match = /\bpage (\d+)\b/i.exec(item.notes || '');
  return match ? Number(match[1]) : null;
}
export function displayValue(item) {
  if (item.value !== null && item.value !== undefined)
    return String(item.value);
  return item.qualitative_value || item.textual_value || 'Not recorded';
}
export function displayReference(item) {
  if (item.ref_range_text) return item.ref_range_text;
  if (item.ref_range_min != null && item.ref_range_max != null)
    return `${item.ref_range_min} – ${item.ref_range_max}`;
  if (item.ref_range_min != null) return `≥ ${item.ref_range_min}`;
  if (item.ref_range_max != null) return `≤ ${item.ref_range_max}`;
  return 'Not provided';
}

// Short labels belong only to list rows; detail views retain the source test names.
export function summaryTestName(item) {
  if (isVitaminD25Oh(item)) return VITAMIN_D25_OH;
  const labels = {
    'total rbc count': 'Red blood cells',
    'blood glucose fasting': 'Fasting glucose',
    'glycosilated haemoglobin hba1c': 'HbA1c',
    'glycosylated haemoglobin hba1c': 'HbA1c',
    'blood urea nitrogen': 'BUN',
    'alt sgpt': 'ALT',
    'ast sgot': 'AST',
    'gamma gt': 'GGT',
    '25 oh vitamin d': 'Vitamin D',
  };
  return labels[normalizeTestName(item.test_name)] || item.test_name;
}
