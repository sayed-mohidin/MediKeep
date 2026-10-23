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
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconFlask,
  IconInfoCircle,
  IconTrendingUp,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import PageHeader from '../components/layout/PageHeader';
import PatientSelector from '../components/medical/PatientSelector';
import InvitationNotifications from '../components/dashboard/InvitationNotifications';
import BodyCard from '../components/dashboard/BodyCard';
import LabCategoryCards from '../components/dashboard/LabCategoryCards';
import TestDrawer from '../components/dashboard/TestDrawer';
import { useCurrentPatient, useCacheManager } from '../hooks/useGlobalData';
import { useDateFormat } from '../hooks/useDateFormat';
import { useBodyMeasures } from '../hooks/useBodyMeasures';
import { useLabOverview } from '../hooks/useLabOverview';
import { usePinnedMarkers } from '../hooks/usePinnedMarkers';
import {
  buildMetrics,
  filterMetrics,
  hasChanged,
  isKeyMarker,
  observationDate,
} from '../utils/labOverview';
import './LabOverview.css';

const HOW_TO_READ =
  'Key markers shows the tests most often followed in routine check-ups, plus anything flagged; star a test to add or remove it. Everything shows every test. Flags come from the labels or ranges recorded in the report and are not a clinical assessment. Changes compare against the previous dated reading in the same unit, without rescaling.';

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
  const view = params.get('view') === 'all' ? 'all' : 'key';
  const body = useBodyMeasures(patientId);
  const { isPinned, setPinned } = usePinnedMarkers(patientId);
  // The open test belongs to one patient and is dropped on switch.
  const [open, setOpen] = useState(null);

  const metrics = useMemo(
    () => buildMetrics(data.components),
    [data.components]
  );
  const visible = useMemo(
    () => filterMetrics(metrics, { query, filter }),
    [metrics, query, filter]
  );
  const activeOpen = open?.patientId === patientId ? open : null;
  const openMetric = activeOpen
    ? metrics.find(metric => metric.key === activeOpen.key)
    : null;
  const filtering = !!query.trim() || filter !== 'all';
  const isDefaultKey = metric => isKeyMarker(metric.latest);
  // Flagged results always stay visible in the trimmed view.
  const isPrimary = metric =>
    metric.flagged || isPinned(metric.key, isDefaultKey(metric));
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
  const showPreview = useCallback(
    index => setOpen(current => current && { ...current, previewIndex: index }),
    []
  );
  function handlePatientChange(nextPatient) {
    // Hide details before requesting the next person's data.
    setOpen(null);
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
            <Group gap="xs" wrap="wrap" className="lab-toolbar">
              <SegmentedControl
                aria-label="Which tests to show"
                value={view}
                onChange={value => setParam('view', value, 'key')}
                data={[
                  { value: 'key', label: 'Key markers' },
                  { value: 'all', label: 'Everything' },
                ]}
              />
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
            </Group>
            <Text size="xs" c="dimmed" className="lab-legend">
              <IconArrowUp size={12} /> High · <IconArrowDown size={12} /> Low,
              as labelled in the report · <IconTrendingUp size={12} /> change
              since the previous report · Select a test for its history and
              original reports
            </Text>
            {data.truncated && (
              <Alert color="yellow">
                Showing the latest 5,000 readings. Older results remain
                available in the reports list.
              </Alert>
            )}
            {visible.length ? (
              <LabCategoryCards
                metrics={visible}
                isPrimary={view === 'key' ? isPrimary : null}
                showAll={filtering}
                leading={
                  !filtering && (
                    <BodyCard
                      readings={body.readings}
                      error={body.error}
                      dateLabel={dateLabel}
                    />
                  )
                }
                onOpen={key => setOpen({ patientId, key, previewIndex: null })}
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
      <TestDrawer
        key={patientId}
        metric={openMetric}
        previewIndex={activeOpen?.previewIndex ?? null}
        onPreview={showPreview}
        onClose={() => setOpen(null)}
        reports={data.reports}
        dateLabel={dateLabel}
        pinned={
          !!openMetric && isPinned(openMetric.key, isDefaultKey(openMetric))
        }
        onTogglePin={() =>
          openMetric &&
          setPinned(
            openMetric.key,
            isDefaultKey(openMetric),
            !isPinned(openMetric.key, isDefaultKey(openMetric))
          )
        }
      />
    </Container>
  );
}
