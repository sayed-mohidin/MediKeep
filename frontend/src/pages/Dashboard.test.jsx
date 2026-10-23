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
vi.mock('../services/api', () => ({
  apiService: {
    getEntityFiles: (...args) => mocks.getFiles(...args),
    getEntityFileViewUrl: id => `/api/v1/entity-files/files/${id}/view`,
  },
}));
const wrapper = ({ children }) => (
  <MemoryRouter>
    <MantineProvider>{children}</MantineProvider>
  </MemoryRouter>
);
const alt = (extra = {}) => ({
  id: 1,
  lab_result_id: 40,
  test_name: 'ALT (SGPT)',
  value: 10,
  unit: 'U/L',
  category: 'hepatology',
  completed_date: '2024-01-02',
  ref_range_text: '0 - 30',
  status: 'normal',
  ...extra,
});
function fixture() {
  return {
    loading: false,
    reports: [
      { id: 40, patient_id: 10, test_name: 'January panel' },
      { id: 41, patient_id: 10, test_name: 'December panel' },
    ],
    components: [
      alt(),
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
const row = name => screen.getByRole('button', { name: new RegExp(name) });
beforeEach(() => {
  mocks.patient = { id: 10 };
  mocks.data = fixture();
  mocks.getFiles.mockReset();
  mocks.getFiles.mockResolvedValue([
    { id: 50, file_name: 'report.pdf', file_type: 'application/pdf' },
  ]);
});
describe('health overview list', () => {
  it('shows every test as a row and expands its history in place', () => {
    render(<Dashboard />, { wrapper });
    expect(
      screen.getByRole('region', { name: 'Liver markers' })
    ).toBeInTheDocument();
    expect(screen.queryByText('0 - 30')).not.toBeInTheDocument();
    fireEvent.click(row('ALT'));
    expect(row('ALT')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('0 - 30')).toBeInTheDocument();
    expect(screen.getByText('January panel')).toBeInTheDocument();
  });
  it('shows unfamiliar tests, zeros and unspecified dates without inventing statuses', () => {
    render(<Dashboard />, { wrapper });
    fireEvent.click(row('Novel assay'));
    expect(screen.getByText('Not provided')).toBeInTheDocument();
    expect(screen.getAllByText(/Date not recorded/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
  });
  it('shows the change since the previous reading in the same unit only', () => {
    mocks.data.components = [
      alt(),
      alt({ id: 3, lab_result_id: 41, value: 8, completed_date: '2023-12-01' }),
      alt({ id: 4, value: 900, unit: 'mg/dL', completed_date: '2023-12-20' }),
    ];
    render(<Dashboard />, { wrapper });
    expect(
      within(row('ALT')).getByText(/\+2 U\/L \(\+25%\)/)
    ).toBeInTheDocument();
    expect(within(row('ALT')).getByText('vs 2023-12-01')).toBeInTheDocument();
    fireEvent.click(row('ALT'));
    expect(screen.getByText(/Also recorded in mg\/dL/)).toBeInTheDocument();
  });
  it('filters with search and chips, and offers a way back from no results', () => {
    mocks.data.components = [
      alt({ status: 'high' }),
      {
        ...alt(),
        id: 5,
        test_name: 'Vitamin B12',
        unit: 'pg/ml',
        category: null,
      },
    ];
    render(<Dashboard />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /Flagged/ }));
    expect(row('ALT')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Vitamin B12/ })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search tests'), {
      target: { value: 'b12' },
    });
    expect(
      screen.getByText('No tests match these filters.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(row('Vitamin B12')).toBeInTheDocument();
    expect(row('ALT')).toBeInTheDocument();
  });
  it('merges the two vitamin D labels into one row and keeps each report label', () => {
    const base = { lab_result_id: 40, unit: 'ng/ml', status: null };
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
    ];
    render(<Dashboard />, { wrapper });
    expect(
      screen.getAllByRole('button', { name: /Vitamin D \(25-OH\)/ })
    ).toHaveLength(1);
    fireEvent.click(row('Vitamin D \\(25-OH\\)'));
    expect(
      screen.getAllByRole('button', { name: /Preview report/ })
    ).toHaveLength(3);
    expect(screen.getByText('777 ng/ml')).toBeInTheDocument();
  });
  it('previews the original report and steps to older readings', async () => {
    mocks.data.components = [
      alt({ notes: 'Source: Paperless document 81, page 2. Checked.' }),
      alt({ id: 3, lab_result_id: 41, value: 8, completed_date: '2023-12-01' }),
    ];
    render(<Dashboard />, { wrapper });
    fireEvent.click(row('ALT'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview report from 2024-01-02' })
    );
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('January panel')).toBeInTheDocument();
    expect(within(drawer).getByText('· 2 of 2')).toBeInTheDocument();
    const frame = await within(drawer).findByTitle('report.pdf');
    expect(frame).toHaveAttribute(
      'src',
      '/api/v1/entity-files/files/50/view#page=2'
    );
    expect(within(drawer).getByText('Page 2')).toBeInTheDocument();
    expect(mocks.getFiles).toHaveBeenCalledWith(
      'lab-result',
      40,
      expect.any(AbortSignal)
    );
    fireEvent.click(within(drawer).getByRole('button', { name: 'Older' }));
    expect(
      await within(drawer).findByText('December panel')
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: 'Older' })
    ).toBeDisabled();
    await waitFor(() =>
      expect(mocks.getFiles).toHaveBeenCalledWith(
        'lab-result',
        41,
        expect.any(AbortSignal)
      )
    );
  });
  it('offers to open the PDF when the browser cannot show it inline', async () => {
    Object.defineProperty(navigator, 'pdfViewerEnabled', {
      value: false,
      configurable: true,
    });
    try {
      mocks.data.components = [
        alt({ notes: 'Source: Paperless document 81, page 3.' }),
      ];
      render(<Dashboard />, { wrapper });
      fireEvent.click(row('ALT'));
      fireEvent.click(
        screen.getByRole('button', { name: 'Preview report from 2024-01-02' })
      );
      const drawer = await screen.findByRole('dialog');
      const open = await within(drawer).findByRole('link', {
        name: 'Open report.pdf (page 3)',
      });
      expect(open).toHaveAttribute(
        'href',
        '/api/v1/entity-files/files/50/view#page=3'
      );
      expect(within(drawer).queryByTitle('report.pdf')).not.toBeInTheDocument();
    } finally {
      delete navigator.pdfViewerEnabled;
    }
  });
  it('closes details and the preview immediately when the patient changes', async () => {
    const view = render(<Dashboard />, { wrapper });
    fireEvent.click(row('ALT'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview report from 2024-01-02' })
    );
    await screen.findByRole('dialog');
    mocks.patient = { id: 20 };
    mocks.data = { ...fixture(), reports: [], components: [], loading: true };
    view.rerender(<Dashboard />);
    await waitFor(() =>
      expect(screen.queryByText('0 - 30')).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(
      screen.getByText('Loading this patient’s results…')
    ).toBeInTheDocument();
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
