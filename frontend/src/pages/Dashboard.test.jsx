import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from './Dashboard';
const mocks = vi.hoisted(() => ({
  patient: { id: 10 },
  data: null,
  setPatient: vi.fn(),
  invalidate: vi.fn(),
  getFiles: vi.fn(),
}));
vi.mock('../hooks/useGlobalData', () => ({
  useCurrentPatient: () => ({ patient: mocks.patient, loading: false }),
  useCacheManager: () => ({
    setCurrentPatient: mocks.setPatient,
    invalidateAll: mocks.invalidate,
  }),
}));
vi.mock('../hooks/useLabOverview', () => ({
  useLabOverview: () => mocks.data,
}));
vi.mock('../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: value => value }),
}));
vi.mock('../components/layout/PageHeader', () => ({
  default: () => <header>MediKeep</header>,
}));
vi.mock('../components/medical/PatientSelector', () => ({
  default: ({ onPatientChange }) => (
    <button onClick={() => onPatientChange({ id: 20 })}>Switch patient</button>
  ),
}));
vi.mock('../components/dashboard/InvitationNotifications', () => ({
  default: () => null,
}));
vi.mock('../components/medical/labresults/TestComponentTrendsPanel', () => ({
  default: () => <div>History panel</div>,
}));
vi.mock('../services/api', () => ({
  apiService: { getEntityFiles: (...args) => mocks.getFiles(...args) },
}));
const wrapper = ({ children }) => (
  <MemoryRouter>
    <MantineProvider>{children}</MantineProvider>
  </MemoryRouter>
);
function fixture() {
  return {
    loading: false,
    reports: [{ id: 40, patient_id: 10, test_name: 'Test report' }],
    components: [
      {
        id: 1,
        lab_result_id: 40,
        test_name: 'ALT (SGPT)',
        value: 10,
        unit: 'U/L',
        category: 'hepatology',
        completed_date: '2024-01-02',
        ref_range_text: '0 - 30',
        status: 'normal',
      },
      {
        id: 2,
        lab_result_id: 40,
        test_name: 'Novel assay',
        value: 0,
        unit: null,
        completed_date: null,
        status: null,
      },
    ],
    refresh: vi.fn(),
    error: null,
  };
}
beforeEach(() => {
  mocks.patient = { id: 10 };
  mocks.data = fixture();
  mocks.getFiles.mockResolvedValue([{ id: 50, file_name: 'test-report.pdf' }]);
});
describe('focused dashboard', () => {
  it('keeps full details behind the appropriate group and retains the original attachment link', async () => {
    render(<Dashboard />, { wrapper });
    expect(screen.queryByText('0 - 30')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'View Liver markers details' })
    );
    expect(await screen.findByText('0 - 30')).toBeInTheDocument();
    expect(screen.getByText('One reading')).toBeInTheDocument();
    const original = await screen.findByRole('link', {
      name: /test-report.pdf/,
    });
    expect(original).toHaveAttribute(
      'href',
      '/api/v1/entity-files/files/50/view'
    );
    expect(mocks.getFiles).toHaveBeenCalledWith(
      'lab-result',
      40,
      expect.any(AbortSignal)
    );
  });
  it('shows unfamiliar tests, zeros and unspecified dates without inventing healthy statuses', async () => {
    render(<Dashboard />, { wrapper });
    fireEvent.click(
      screen.getByRole('button', { name: 'View Other tests details' })
    );
    expect(await screen.findByText('Not provided')).toBeInTheDocument();
    expect(screen.getAllByText('Date not recorded').length).toBeGreaterThan(0);
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
  });
  it('closes source details immediately when the current patient changes', async () => {
    const view = render(<Dashboard />, { wrapper });
    fireEvent.click(
      screen.getByRole('button', { name: 'View Liver markers details' })
    );
    await screen.findByRole('link', { name: /test-report.pdf/ });
    mocks.patient = { id: 20 };
    mocks.data = { ...fixture(), reports: [], components: [], loading: true };
    view.rerender(<Dashboard />);
    await waitFor(() =>
      expect(screen.queryByText('0 - 30')).not.toBeInTheDocument()
    );
    expect(
      screen.queryByRole('link', { name: /test-report.pdf/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Loading this patient’s results…')
    ).toBeInTheDocument();
  });
  it('keeps history in the same unit and leaves undated readings unplotted', async () => {
    const base = fixture().components[0];
    mocks.data.components = [
      base,
      { ...base, id: 3, value: 20, completed_date: '2024-02-02' },
      { ...base, id: 4, value: 30, completed_date: null },
      {
        ...base,
        id: 5,
        value: 999,
        unit: 'mg/dL',
        completed_date: '2024-03-02',
      },
    ];
    render(<Dashboard />, { wrapper });
    fireEvent.click(
      screen.getByRole('button', { name: 'View Liver markers details' })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'View history' })
    );
    const history = await screen.findByRole('dialog', {
      name: 'ALT (SGPT) — history',
    });
    expect(within(history).getByText('Date not recorded')).toBeInTheDocument();
    expect(within(history).queryByText(/999/)).not.toBeInTheDocument();
    expect(within(history).getByText('30 U/L')).toBeInTheDocument();
  });
  it('shows previous values and changes without mixing incompatible units', async () => {
    const current = fixture().components[0];
    mocks.data.components = [
      current,
      { ...current, id: 3, value: 8, completed_date: '2023-12-01' },
      {
        ...current,
        id: 4,
        value: 900,
        unit: 'mg/dL',
        completed_date: '2023-12-20',
      },
    ];
    render(<Dashboard />, { wrapper });
    expect(screen.getByText(/Change: \+2 U\/L/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'View Liver markers details' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Liver markers' });
    expect(
      within(dialog).getByText('Previous: 8 U/L · 2023-12-01')
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Change: \+2 U\/L \(\+25%\)/)
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'View history' })
    );
    const history = await screen.findByRole('dialog', {
      name: 'ALT (SGPT) — history',
    });
    expect(
      within(history).getByText('Previous: 8 U/L · 2023-12-01')
    ).toBeInTheDocument();
    expect(within(history).queryByText(/900/)).not.toBeInTheDocument();
  });
  it('shows one vitamin D result and shares all three readings while retaining original report labels', async () => {
    const base = {
      lab_result_id: 40,
      unit: 'ng/ml',
      category: 'chemistry',
      status: null,
    };
    mocks.data.components = [
      {
        ...base,
        id: 1,
        test_name: '25 OH Vitamin D',
        value: 50,
        completed_date: '2024-03-01',
      },
      {
        ...base,
        id: 2,
        test_name: '25 OH Vitamin D',
        value: 40,
        completed_date: '2024-02-01',
      },
      {
        ...base,
        id: 3,
        test_name: 'VITAMIN D-T (25-OH)',
        value: 777,
        completed_date: '2024-01-01',
      },
      {
        ...base,
        id: 4,
        test_name: 'Vitamin B12',
        value: 200,
        unit: 'pg/ml',
        completed_date: '2024-03-01',
      },
    ];
    render(<Dashboard />, { wrapper });
    const card = screen.getByRole('button', { name: 'View Vitamins details' });
    expect(within(card).getAllByText('Vitamin D (25-OH)')).toHaveLength(1);
    expect(
      within(card).queryByText('VITAMIN D-T (25-OH)')
    ).not.toBeInTheDocument();
    fireEvent.click(card);
    const dialog = await screen.findByRole('dialog', { name: 'Vitamins' });
    expect(within(dialog).getByText('Vitamin D (25-OH)')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Expand Vitamin D (25-OH)' })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText('VITAMIN D-T (25-OH)')
    ).not.toBeInTheDocument();
    expect(within(dialog).getByText('Vitamin B12')).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'View history' })
    );
    const history = await screen.findByRole('dialog', {
      name: 'Vitamin D (25-OH) — history',
    });
    expect(within(history).getAllByRole('row')).toHaveLength(4);
    expect(within(history).getByText('777 ng/ml')).toBeInTheDocument();
    expect(
      within(history).getByText('VITAMIN D-T (25-OH)')
    ).toBeInTheDocument();
    expect(within(history).getAllByText('25 OH Vitamin D')).toHaveLength(2);
    expect(within(history).getByText('40 ng/ml')).toBeInTheDocument();
  });
  it('distinguishes an empty library from API failure and retries', () => {
    mocks.data = { ...fixture(), components: [], reports: [] };
    const view = render(<Dashboard />, { wrapper });
    expect(
      screen.getByText('No measurements imported yet')
    ).toBeInTheDocument();
    mocks.data = {
      ...fixture(),
      components: [],
      error: 'Could not load this patient’s test results. Please retry.',
    };
    view.rerender(<Dashboard />);
    expect(screen.getByText('Results unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.data.refresh).toHaveBeenCalled();
  });
});
