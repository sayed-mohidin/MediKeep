// Groups are presentation labels, not organ-health assessments. Unknown tests remain visible.
export const OVERVIEW_GROUPS = [
  {
    id: 'blood',
    title: 'Blood count',
    short: 'CBC',
    category: 'hematology',
    highlights: ['total rbc count', 'hematocrit', 'haemoglobin', 'hemoglobin'],
  },
  {
    id: 'glucose',
    title: 'Glucose',
    short: 'GLU',
    highlights: [
      'blood glucose fasting',
      'fasting glucose',
      'hba1c',
      'glycosilated haemoglobin hba1c',
    ],
  },
  {
    id: 'lipids',
    title: 'Lipids',
    short: 'LIP',
    category: 'lipids',
    highlights: ['hdl cholesterol', 'ldl cholesterol', 'triglycerides'],
  },
  {
    id: 'kidney',
    title: 'Kidney markers',
    short: 'REN',
    highlights: ['creatinine', 'urea', 'blood urea nitrogen', 'egfr'],
  },
  {
    id: 'liver',
    title: 'Liver markers',
    short: 'LFT',
    category: 'hepatology',
    highlights: ['alt sgpt', 'ast sgot', 'gamma gt'],
  },
  {
    id: 'thyroid',
    title: 'Thyroid',
    short: 'TFT',
    highlights: ['tsh', 't3', 't4'],
  },
  {
    id: 'vitamins',
    title: 'Vitamins',
    short: 'VIT',
    highlights: ['25 oh vitamin d', 'vitamin d', 'vitamin b12'],
  },
  { id: 'other', title: 'Other tests', short: 'LAB', highlights: [] },
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
    /\b(haemoglobin|hemoglobin|hematocrit|haematocrit|wbc|rbc|platelet|neutrophil|lymphocyte|eosinophil|monocyte|basophil|mcv|mch|mchc|rdw|pdw|p lcr)\b/.test(
      name
    )
  )
    return 'blood';
  return 'other';
}
export function buildOverview(components) {
  const latest = new Map();
  // Date-only strings sort without timezone conversion. Undated values do not borrow import dates.
  for (const item of components) {
    const key = measurementKey(item);
    const previous = latest.get(key);
    const date = observationDate(item) || '';
    const previousDate = previous ? observationDate(previous) || '' : '';
    if (
      !previous ||
      date > previousDate ||
      (date === previousDate && Number(item.id) > Number(previous.id))
    )
      latest.set(key, item);
  }
  return OVERVIEW_GROUPS.map(group => {
    const items = [...latest.values()].filter(
      item => groupForTest(item) === group.id
    );
    const rank = item => {
      const name = normalizeTestName(
        isVitaminD25Oh(item) ? '25 OH Vitamin D' : item.test_name
      );
      const i = group.highlights.indexOf(name);
      return i < 0 ? 100 : i;
    };
    const highlights = [...items]
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          Number(isFlagged(b)) - Number(isFlagged(a)) ||
          a.test_name.localeCompare(b.test_name)
      )
      .slice(0, 3);
    const dates = items.map(observationDate).filter(Boolean).sort();
    return {
      ...group,
      items,
      highlights,
      flagged: items.filter(isFlagged).length,
      latestDate: dates.at(-1) || null,
    };
  }).filter(group => group.items.length);
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

// Short labels belong only to summary cards; detail views retain the source test names.
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
