import { describe, it, expect } from 'vitest';
import {
  buildOverview,
  groupForTest,
  displayValue,
  observationDate,
  measurementKey,
  previousComparison,
  displayChange,
} from './labOverview';
import {
  getNavigationSections,
  NAVIGATION_SECTIONS,
  ADMIN_SECTION,
} from '../config/navigation.config';
const row = (test_name, extra = {}) => ({
  id: 1,
  test_name,
  value: 12,
  unit: 'mg/dL',
  completed_date: '2024-01-02',
  ...extra,
});
describe('historical comparisons', () => {
  it('treats the two owner-approved vitamin D labels as one marker without crossing units or unrelated assays', () => {
    const current = row('25 OH Vitamin D', {
      value: 20,
      unit: 'ng/ml',
      completed_date: '2024-03-01',
    });
    const previous = row('VITAMIN D-T (25-OH)', {
      id: 2,
      value: 10,
      unit: 'ng/ml',
      completed_date: '2024-02-01',
    });
    expect(measurementKey(current)).toBe(measurementKey(previous));
    expect(
      measurementKey({ ...current, canonical_test_name: 'Vitamin D (25-OH)' })
    ).toBe(measurementKey(previous));
    expect(buildOverview([previous, current])[0].items).toHaveLength(1);
    expect(previousComparison([previous, current], current)).toMatchObject({
      previous,
      change: 10,
      percent: 100,
    });
    expect(measurementKey({ ...previous, unit: 'nmol/L' })).not.toBe(
      measurementKey(current)
    );
    expect(
      measurementKey(row('1,25 Dihydroxy Vitamin D', { unit: 'ng/ml' }))
    ).not.toBe(measurementKey(current));
    expect(current.test_name).toBe('25 OH Vitamin D');
    expect(previous.test_name).toBe('VITAMIN D-T (25-OH)');
  });
  it('matches reviewed names and scale-identical unit notation while preserving distinct assays', () => {
    expect(
      measurementKey(
        row('WBC', { canonical_test_name: 'Total WBC Count', unit: 'x10^9/L' })
      )
    ).toBe(measurementKey(row('Total WBC Count', { unit: 'x10^3/ul' })));
    expect(measurementKey(row('TSH', { unit: 'µIU/mL' }))).toBe(
      measurementKey(row('TSH', { unit: 'uIU/ml' }))
    );
    expect(measurementKey(row('T3', { unit: 'pmol/L' }))).not.toBe(
      measurementKey(row('FT3', { unit: 'pmol/L' }))
    );
    expect(measurementKey(row('T3', { unit: 'mIU/L' }))).not.toBe(
      measurementKey(row('T3', { unit: 'MIU/L' }))
    );
    expect(groupForTest(row('FT4'))).toBe('thyroid');
    expect(groupForTest(row('Anti-Thyroglobulin'))).toBe('thyroid');
  });
  it('compares with the nearest earlier dated, compatible reading, rather than import order', () => {
    const current = row('Creatinine', {
      value: 15,
      completed_date: '2024-04-01',
    });
    const previous = row('Creatinine', {
      id: 3,
      value: 10,
      unit: 'mg/dl',
      completed_date: '2024-03-01',
    });
    const data = [
      current,
      previous,
      row('Creatinine', { id: 4, value: 3, completed_date: '2024-02-01' }),
      row('Creatinine', { id: 5, value: 999, completed_date: null }),
      row('Creatinine', {
        id: 6,
        value: 900,
        unit: 'umol/L',
        completed_date: '2024-03-20',
      }),
    ];
    expect(previousComparison(data, current)).toEqual({
      previous,
      change: 5,
      percent: 50,
    });
    expect(displayChange(0.1 + 0.2)).toBe('+0.3');
    expect(displayChange(-0.00001)).not.toBe('0');
  });
  it('handles zero baselines without infinite percentages and requires known units and dates', () => {
    const current = row('X', { value: 1, completed_date: '2024-03-01' });
    const previous = row('X', { id: 2, value: 0 });
    expect(previousComparison([previous, current], current)).toMatchObject({
      change: 1,
      percent: null,
    });
    expect(
      previousComparison([previous, current], { ...current, unit: null })
    ).toBeNull();
    expect(
      previousComparison([previous, current], {
        ...current,
        completed_date: null,
      })
    ).toBeNull();
    expect(
      previousComparison([previous, current], {
        ...current,
        result_type: 'textual',
      })
    ).toBeNull();
  });
  it('does not infer ordering for conflicting results on the same date', () => {
    const current = row('X', { value: 15, completed_date: '2024-03-01' });
    const previous = row('X', { id: 2, value: 10 });
    expect(
      previousComparison(
        [current, previous, { ...previous, id: 3, value: 11 }],
        current
      )
    ).toBeNull();
    expect(
      previousComparison(
        [current, previous, { ...current, id: 4, value: 16 }],
        current
      )
    ).toBeNull();
    expect(previousComparison([current], current)).toBeNull();
  });
});
describe('lab overview grouping', () => {
  it('groups named markers ahead of broad categories and retains unknown tests', () => {
    expect(groupForTest(row('HbA1c', { category: 'hematology' }))).toBe(
      'glucose'
    );
    expect(groupForTest(row('T4'))).toBe('thyroid');
    expect(groupForTest(row('Vitamin B12'))).toBe('vitamins');
    expect(groupForTest(row('Absolute Neutrophil Count'))).toBe('blood');
    expect(groupForTest(row('Creatinine'))).toBe('kidney');
    expect(groupForTest(row('ALT (SGPT)'))).toBe('liver');
    expect(groupForTest(row('LDL/HDL Ratio'))).toBe('lipids');
    expect(buildOverview([row('Unfamiliar enzyme')])[0].title).toBe(
      'Other tests'
    );
  });
  it('selects the latest clinical date without replacing it with an import timestamp', () => {
    const groups = buildOverview([
      row('Creatinine', { value: 8, created_at: '2030-01-01' }),
      row('Creatinine', { id: 2, value: 9, completed_date: '2024-02-01' }),
      row('Creatinine', {
        id: 3,
        value: 10,
        completed_date: null,
        created_at: '2031-01-01',
      }),
    ]);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].value).toBe(9);
    expect(
      observationDate(
        row('X', { completed_date: null, created_at: '2024-03-01' })
      )
    ).toBeNull();
  });
  it('does not merge values in different units or erase zero values', () => {
    const groups = buildOverview([
      row('Creatinine', { value: 0 }),
      row('Creatinine', { id: 2, unit: 'umol/L' }),
      row('T3', { id: 3, unit: 'mIU/L' }),
      row('T3', { id: 4, unit: 'MIU/L' }),
    ]);
    expect(groups.flatMap(group => group.items)).toHaveLength(4);
    expect(displayValue(row('X', { value: 0 }))).toBe('0');
  });
  it('uses explicit flags and leaves missing reference guidance unclassified', () => {
    const group = buildOverview([
      row('Vitamin D', {
        status: null,
        ref_range_min: null,
        ref_range_max: null,
      }),
      row('Vitamin B12', { id: 2, status: 'low' }),
    ])[0];
    expect(group.flagged).toBe(1);
    expect(group.items[0].status).toBeNull();
  });
});
describe('focused navigation', () => {
  it('retains all ordinary destinations under primary links or More records', () => {
    const sections = getNavigationSections('desktop', false);
    expect(sections.more.collapsible).toBe(true);
    expect(sections.overview.items.map(item => item.id)).toEqual([
      'dashboard',
      'lab-results',
      'patient-info',
    ]);
    const ids = Object.values(sections).flatMap(section =>
      section.items.map(item => item.id)
    );
    Object.values(NAVIGATION_SECTIONS)
      .flatMap(section => section.items)
      .filter(item => item.id !== 'settings')
      .forEach(item => expect(ids).toContain(item.id));
    ADMIN_SECTION.items.forEach(item => expect(ids).not.toContain(item.id));
    const adminIds = getNavigationSections('mobile', true).more.items.map(
      item => item.id
    );
    ADMIN_SECTION.items.forEach(item => expect(adminIds).toContain(item.id));
  });
});
