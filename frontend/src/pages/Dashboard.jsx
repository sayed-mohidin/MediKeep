import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconFlask,
  IconInfoCircle,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import PageHeader from '../components/layout/PageHeader';
import PatientSelector from '../components/medical/PatientSelector';
import InvitationNotifications from '../components/dashboard/InvitationNotifications';
import LabMetricList from '../components/dashboard/LabMetricList';
import ReportPreviewDrawer from '../components/dashboard/ReportPreviewDrawer';
import { useCurrentPatient, useCacheManager } from '../hooks/useGlobalData';
import { useDateFormat } from '../hooks/useDateFormat';
import { useLabOverview } from '../hooks/useLabOverview';
import {
  OVERVIEW_GROUPS,
  buildMetrics,
  filterMetrics,
  hasChanged,
  observationDate,
  sortMetrics,
} from '../utils/labOverview';
import './LabOverview.css';

const SORT_OPTIONS = [
  { value: 'group', label: 'Group by panel' },
  { value: 'flagged', label: 'Flagged first' },
  { value: 'change', label: 'Biggest change' },
  { value: 'name', label: 'A–Z' },
];
const HOW_TO_READ =
  'Each row shows the latest reading for a test. Flags come from the labels or ranges recorded in the report and are not a clinical assessment. Changes compare against the previous dated reading in the same unit, without rescaling.';

export default function Dashboard() {
  const {
    patient,
    loading: patientLoading,
    error: patientError,
  } = useCurrentPatient();
  const { setCurrentPatient, invalidateAll } = useCacheManager();
  const { formatDate } = useDateFormat();
  const patientId = patient?.id || null;
  const data = useLabOverview(patientId);
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const filter = params.get('filter') || 'all';
  const sort = params.get('sort') || 'group';
  // Expanded rows and the preview belong to one patient and are dropped on switch.
  const [expanded, setExpanded] = useState({ patientId, keys: new Set() });
  const [preview, setPreview] = useState(null);

  const metrics = useMemo(
    () => buildMetrics(data.components),
    [data.components]
  );
  const visible = useMemo(
    () => sortMetrics(filterMetrics(metrics, { query, filter }), sort),
    [metrics, query, filter, sort]
  );
  const expandedKeys =
    expanded.patientId === patientId ? expanded.keys : new Set();
  const activePreview = preview?.patientId === patientId ? preview : null;
  const previewMetric = activePreview
    ? metrics.find(metric => metric.key === activePreview.key)
    : null;
  const latestDate = metrics
    .map(metric => observationDate(metric.latest))
    .filter(Boolean)
    .sort()
    .at(-1);
  const dateLabel = useCallback(
    value => (value ? formatDate(value) : 'Date not recorded'),
    [formatDate]
  );

  const chips = [
    { id: 'all', label: 'All', count: metrics.length },
    {
      id: 'flagged',
      label: 'Flagged',
      count: metrics.filter(m => m.flagged).length,
    },
    {
      id: 'changed',
      label: 'Changed',
      count: metrics.filter(hasChanged).length,
    },
    ...OVERVIEW_GROUPS.map(group => ({
      id: group.id,
      label: group.title,
      count: metrics.filter(m => m.group === group.id).length,
    })).filter(chip => chip.count > 0),
  ];

  function setParam(key, value, fallback) {
    setParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value && value !== fallback) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }
  function clearFilters() {
    setParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.delete('q');
        next.delete('filter');
        return next;
      },
      { replace: true }
    );
  }
  function toggle(key) {
    const keys = new Set(expandedKeys);
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    setExpanded({ patientId, keys });
  }
  const changePreviewIndex = useCallback(
    index => setPreview(current => current && { ...current, index }),
    []
  );
  function handlePatientChange(nextPatient) {
    // Hide details before requesting the next person's data.
    setExpanded({ patientId: null, keys: new Set() });
    setPreview(null);
    setCurrentPatient(nextPatient);
    invalidateAll();
  }

  return (
    <Container size={1100} py="md" className="lab-overview">
      <PageHeader title="MediKeep" showBackButton={false} variant="dashboard" />
      <Stack gap="md" mt="lg">
        <PatientSelector
          compact
          currentPatientId={patientId}
          onPatientChange={handlePatientChange}
        />
        <InvitationNotifications hideWhenEmpty />
        <Group justify="space-between" align="end">
          <div>
            <Title order={2}>Health overview</Title>
            <Group gap={6}>
              <Text c="dimmed" size="sm">
                {latestDate
                  ? `Latest report · ${dateLabel(latestDate)}`
                  : 'Results from your lab reports'}
              </Text>
              <Tooltip label={HOW_TO_READ} multiline w={320} withArrow>
                <IconInfoCircle
                  size={15}
                  aria-label="How to read this"
                  color="var(--mantine-color-dimmed)"
                />
              </Tooltip>
            </Group>
          </div>
          <Group gap="xs">
            <Button
              component={Link}
              to="/lab-results"
              variant="default"
              size="sm"
            >
              All reports
            </Button>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Refresh"
              onClick={data.refresh}
              disabled={!patientId || data.loading}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>
        {patientError && (
          <Alert color="red">
            Could not load the current patient. Please select a patient or
            refresh the page.
          </Alert>
        )}
        {patientLoading || data.loading ? (
          <Group justify="center" py="xl" role="status">
            <Loader size="sm" />
            <Text>Loading this patient’s results…</Text>
          </Group>
        ) : data.error ? (
          <Alert color="red" title="Results unavailable">
            <Text size="sm">{data.error}</Text>
            <Button mt="sm" size="xs" onClick={data.refresh}>
              Retry
            </Button>
          </Alert>
        ) : !patientId ? (
          <Alert>Select a patient to view their results.</Alert>
        ) : !metrics.length ? (
          <Paper withBorder p="xl" radius="md">
            <Stack align="center">
              <IconFlask size={28} />
              <Title order={3}>No measurements imported yet</Title>
              <Text c="dimmed" ta="center">
                Linked PDFs remain available in Reports. Import their individual
                results to populate this overview.
              </Text>
              <Button component={Link} to="/lab-results">
                Browse reports
              </Button>
            </Stack>
          </Paper>
        ) : (
          <>
            <Group gap="xs" wrap="wrap">
              <TextInput
                className="lab-search"
                placeholder="Search tests, e.g. HbA1c, LDL, vitamin"
                aria-label="Search tests"
                leftSection={<IconSearch size={16} />}
                rightSection={
                  query && (
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label="Clear search"
                      onClick={() => setParam('q', '')}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  )
                }
                value={query}
                onChange={event => setParam('q', event.currentTarget.value)}
              />
              <Select
                aria-label="Sort"
                data={SORT_OPTIONS}
                value={sort}
                onChange={value => setParam('sort', value, 'group')}
                allowDeselect={false}
                w={170}
              />
            </Group>
            <Group gap={6} role="group" aria-label="Filter tests">
              {chips.map(chip => (
                <Button
                  key={chip.id}
                  size="compact-sm"
                  radius="xl"
                  variant={filter === chip.id ? 'filled' : 'default'}
                  color="dark"
                  aria-pressed={filter === chip.id}
                  onClick={() => setParam('filter', chip.id, 'all')}
                  rightSection={
                    <Text span size="xs" opacity={0.7}>
                      {chip.count}
                    </Text>
                  }
                >
                  {chip.label}
                </Button>
              ))}
            </Group>
            {data.truncated && (
              <Alert color="yellow">
                Showing the latest 5,000 readings. Older results remain
                available in the reports list.
              </Alert>
            )}
            {visible.length ? (
              <LabMetricList
                metrics={visible}
                grouped={sort === 'group'}
                expanded={expandedKeys}
                onToggle={toggle}
                onPreview={(key, index) =>
                  setPreview({ patientId, key, index })
                }
                reports={data.reports}
                dateLabel={dateLabel}
              />
            ) : (
              <Paper withBorder p="xl" radius="md">
                <Stack align="center" gap="xs">
                  <Text c="dimmed">No tests match these filters.</Text>
                  <Button size="xs" variant="default" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </Stack>
              </Paper>
            )}
          </>
        )}
      </Stack>
      <ReportPreviewDrawer
        key={patientId}
        metric={previewMetric}
        index={activePreview?.index ?? 0}
        onIndexChange={changePreviewIndex}
        onClose={() => setPreview(null)}
        reports={data.reports}
        dateLabel={dateLabel}
      />
    </Container>
  );
}
