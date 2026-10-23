import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLabOverview, loadLabOverview } from '../hooks/useLabOverview';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../services/api', () => ({
  apiService: { get: (...args) => mocks.get(...args) },
}));
beforeEach(() => {
  mocks.get.mockReset();
});
describe('dashboard patient-scoped data', () => {
  it('ignores a late response from the previous patient and scopes every request', async () => {
    let oldResolve;
    mocks.get.mockImplementation((path, options) => {
      if (path === '/lab-results/')
        return Promise.resolve([
          {
            id: options.params.patient_id * 10,
            patient_id: options.params.patient_id,
          },
        ]);
      if (path.includes('/patient/10/'))
        return new Promise(resolve => {
          oldResolve = resolve;
        });
      if (path.includes('/patient/20/'))
        return Promise.resolve([{ id: 2, test_name: 'New patient assay' }]);
      throw Error('Unexpected request');
    });
    const view = renderHook(({ id }) => useLabOverview(id), {
      initialProps: { id: 10 },
    });
    await waitFor(() => expect(oldResolve).toBeDefined());
    view.rerender({ id: 20 });
    expect(view.result.current.components).toEqual([]);
    await waitFor(() => expect(view.result.current.components[0]?.id).toBe(2));
    await act(async () =>
      oldResolve([{ id: 1, test_name: 'Old patient assay' }])
    );
    expect(view.result.current.components.map(row => row.id)).toEqual([2]);
    expect(mocks.get).toHaveBeenCalledWith(
      '/lab-results/',
      expect.objectContaining({
        params: expect.objectContaining({ patient_id: 20 }),
      })
    );
  });
  it('rejects unexpected patient report responses instead of displaying them', async () => {
    mocks.get.mockResolvedValue([{ id: 1, patient_id: 99 }]);
    await expect(
      loadLabOverview(10, new AbortController().signal)
    ).rejects.toThrow('Unexpected patient');
  });
  it('paginates report counts and explicitly reports a capped component history', async () => {
    mocks.get.mockImplementation((path, options) =>
      Promise.resolve(
        path === '/lab-results/'
          ? options.params.skip === 0
            ? Array.from({ length: 1000 }, (_, id) => ({ id, patient_id: 10 }))
            : [{ id: 1001, patient_id: 10 }]
          : Array.from({ length: 5000 }, (_, id) => ({ id }))
      )
    );
    const result = await loadLabOverview(10, new AbortController().signal);
    expect(result.reports).toHaveLength(1001);
    expect(result.truncated).toBe(true);
  });
});
