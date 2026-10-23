// Vitals store weight in lbs and height in inches; display conversion happens in the UI.
export const bmiFrom = (lbs, inches) =>
  lbs > 0 && inches > 0 ? (703 * lbs) / (inches * inches) : null;

// WHO adult categories. Lower action points (23, 27.5) are suggested for Asian populations.
export function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy range';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

const newestFirst = (a, b) =>
  String(b.recorded_date || '').localeCompare(String(a.recorded_date || ''));

export function summarizeBody(readings) {
  const sorted = [...readings].sort(newestFirst);
  const weights = sorted.filter(row => row.weight != null);
  const height = sorted.find(row => row.height != null)?.height ?? null;
  const weight = weights[0] || null;
  const bmi = weight ? (weight.bmi ?? bmiFrom(weight.weight, height)) : null;
  const pressure =
    sorted.find(row => row.systolic_bp != null && row.diastolic_bp != null) ||
    null;
  return {
    weight,
    previousWeight: weights[1] || null,
    height,
    bmi: bmi == null ? null : Math.round(bmi * 10) / 10,
    bmiCategory: bmiCategory(bmi),
    pressure,
  };
}
