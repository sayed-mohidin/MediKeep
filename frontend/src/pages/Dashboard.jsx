import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowRight, IconFlask, IconRefresh } from '@tabler/icons-react';
import PageHeader from '../components/layout/PageHeader';
import PatientSelector from '../components/medical/PatientSelector';
import InvitationNotifications from '../components/dashboard/InvitationNotifications';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useCurrentPatient, useCacheManager } from '../hooks/useGlobalData';
import { useDateFormat } from '../hooks/useDateFormat';
import { useLabOverview } from '../hooks/useLabOverview';
import { apiService } from '../services/api';
import {
  buildOverview,
  displayReference,
  displayValue,
  summaryTestName,
  isFlagged,
  measurementKey,
  observationDate,
  previousComparison,
  displayChange,
  comparisonUnit,
  markerName,
} from '../utils/labOverview';
import './LabOverview.css';

function ReadingComparison({ row, components, dateLabel, compact = false }) {
  const comparison = previousComparison(components, row);
  if (!comparison)
    return compact ? null : (
      <Text size="xs" c="dimmed">
        No earlier comparable reading
      </Text>
    );
  const { previous, change, percent } = comparison;
  return (
    <span className="lab-reading-comparison">
      {!compact && (
        <span>
          Previous: {displayValue(previous)} {previous.unit} ·{' '}
          {dateLabel(observationDate(previous))}
        </span>
      )}
      <span>
        Change: {displayChange(change)} {row.unit}
        {percent !== null && ` (${displayChange(percent)}%)`}
        {compact && ` since ${dateLabel(observationDate(previous))}`}
      </span>
    </span>
  );
}

function ReportLinks({ reportIds, reports }) {
  const [state, setState] = useState({
    loading: true,
    files: [],
    error: false,
  });
  const ids = reportIds.join(',');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ loading: true, files: [], error: false });
    Promise.all(
      reportIds.map(id =>
        apiService
          .getEntityFiles('lab-result', id, controller.signal)
          .then(files => files.map(file => ({ ...file, reportId: id })))
      )
    )
      .then(lists => {
        if (active)
          setState({ loading: false, files: lists.flat(), error: false });
      })
      .catch(() => {
        if (active) setState({ loading: false, files: [], error: true });
      });
    return () => {
      active = false;
      controller.abort();
    };
    // The component is keyed by patient and source IDs; no cross-patient file cache is retained.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return (
    <Stack gap="xs" mt="md">
      <Text fw={600} size="sm">
        Original reports
      </Text>
      {state.loading ? (
        <Loader size="xs" aria-label="Loading report links" />
      ) : state.error ? (
        <Text size="sm" c="dimmed">
          Report links could not be loaded. Open the reports list to retry.
        </Text>
      ) : state.files.length ? (
        state.files.map(file => (
          <Anchor
            key={file.id}
            href={`/api/v1/entity-files/files/${file.id}/view`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {reports.find(report => report.id === file.reportId)?.test_name ||
              'Original report'}{' '}
            — {file.file_name}
          </Anchor>
        ))
      ) : (
        <Text size="sm" c="dimmed">
          No attachment is linked to these results.
        </Text>
      )}
      <Anchor component={Link} to="/lab-results">
        Browse all reports
      </Anchor>
    </Stack>
  );
}

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
  const [selection, setSelection] = useState(null);
  const [trend, setTrend] = useState(null);
  const groups = useMemo(
    () => buildOverview(data.components),
    [data.components]
  );
  const selectedGroup =
    selection?.patientId === patientId
      ? groups.find(group => group.id === selection.id)
      : null;
  const activeTrend = trend?.patientId === patientId ? trend.row : null;
  const latestDates = data.components
    .map(observationDate)
    .filter(Boolean)
    .sort();
  const latestDate = latestDates.at(-1);
  const currentReadings = groups.flatMap(group => group.items);
  const withMeasurements = new Set(
    data.components.map(row => row.lab_result_id)
  ).size;
  const reportIds = selectedGroup
    ? [...new Set(selectedGroup.items.map(row => row.lab_result_id))]
    : [];
  const historyRows = row =>
    data.components
      .filter(item => measurementKey(item) === measurementKey(row))
      .sort((a, b) =>
        (observationDate(a) || '').localeCompare(observationDate(b) || '')
      );
  const historyCount = row => historyRows(row).length;
  const selectedHistory = activeTrend ? historyRows(activeTrend) : [];
  const chartPoints = selectedHistory
    .filter(
      row =>
        observationDate(row) &&
        comparisonUnit(row.unit) &&
        typeof row.value === 'number' &&
        Number.isFinite(row.value)
    )
    .map(row => ({ date: observationDate(row), value: row.value }));
  const dateLabel = value => (value ? formatDate(value) : 'Date not recorded');

  function handlePatientChange(nextPatient) {
    // Hide details before requesting the next person's data.
    setSelection(null);
    setTrend(null);
    setCurrentPatient(nextPatient);
    invalidateAll();
  }

  function renderMeasurementRow(row) {
    return (
      <Table.Tr key={measurementKey(row)}>
        <Table.Td>{markerName(row)}</Table.Td>
        <Table.Td>
          <Text size="sm" fw={600}>
            {displayValue(row)} {row.unit}
          </Text>
          {row.status && row.status !== 'normal' && (
            <Badge size="xs" color={isFlagged(row) ? 'yellow' : 'gray'}>
              {row.status}
            </Badge>
          )}
        </Table.Td>
        <Table.Td>{displayReference(row)}</Table.Td>
        <Table.Td>{dateLabel(observationDate(row))}</Table.Td>
        <Table.Td>
          <ReadingComparison
            row={row}
            components={data.components}
            dateLabel={dateLabel}
          />
        </Table.Td>
        <Table.Td>
          {historyCount(row) > 1 ? (
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setTrend({ patientId, row })}
            >
              View history
            </Button>
          ) : (
            <Text size="xs" c="dimmed">
              {historyCount(row) === 1 ? 'One reading' : 'Unit not recorded'}
            </Text>
          )}
        </Table.Td>
      </Table.Tr>
    );
  }

  return (
    <Container size={1100} py="md" className="lab-overview">
      <PageHeader title="MediKeep" showBackButton={false} variant="dashboard" />
      <Stack gap="lg" mt="lg">
        <PatientSelector
          compact
          currentPatientId={patientId}
          onPatientChange={handlePatientChange}
        />
        <Group justify="space-between" align="start">
          <div>
            <Title order={2}>Your health overview</Title>
            <Text c="dimmed" size="sm">
              {latestDate
                ? `Latest measurements · ${dateLabel(latestDate)}`
                : 'A focused view of the results in your reports'}
            </Text>
          </div>
          <Button
            variant="subtle"
            leftSection={<IconRefresh size={16} />}
            onClick={data.refresh}
            disabled={!patientId || data.loading}
          >
            Refresh
          </Button>
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
        ) : (
          <>
            <Group gap="xs">
              <Badge variant="outline" color="gray">
                {data.reports.length} reports
              </Badge>
              <Badge variant="outline" color="gray">
                {withMeasurements} with measurements
              </Badge>
              <Badge
                variant="light"
                color={currentReadings.some(isFlagged) ? 'yellow' : 'gray'}
              >
                {currentReadings.filter(isFlagged).length} flagged results
              </Badge>
            </Group>
            {data.truncated && (
              <Alert color="yellow">
                Showing the latest 5,000 readings. Older results remain
                available in the reports list.
              </Alert>
            )}
            {!groups.length ? (
              <Paper withBorder p="xl" radius="md">
                <Stack align="center">
                  <IconFlask size={28} />
                  <Title order={3}>No measurements imported yet</Title>
                  <Text c="dimmed" ta="center">
                    Linked PDFs remain available in Reports. Import their
                    individual results to populate this overview.
                  </Text>
                  <Button component={Link} to="/lab-results">
                    Browse reports
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <div className="lab-overview-grid">
                {groups.map(group => {
                  const mixedDates =
                    new Set(group.items.map(observationDate)).size > 1;
                  return (
                    <button
                      key={group.id}
                      className="lab-summary-card"
                      aria-label={`View ${group.title} details`}
                      onClick={() => setSelection({ patientId, id: group.id })}
                    >
                      <div className="lab-card-heading">
                        <span className="lab-card-title">
                          <span className="lab-card-icon">{group.short}</span>
                          {group.title}
                        </span>
                        {group.flagged > 0 && (
                          <Badge color="yellow" size="sm" variant="light">
                            {group.flagged} flagged
                          </Badge>
                        )}
                      </div>
                      <div className="lab-card-metrics">
                        {group.highlights.map(row => (
                          <div
                            className="lab-card-metric"
                            key={measurementKey(row)}
                          >
                            <span className="lab-metric-name">
                              {summaryTestName(row)}
                            </span>
                            <span className="lab-metric-value">
                              {displayValue(row)} <small>{row.unit}</small>
                              {isFlagged(row) && (
                                <span className="lab-source-flag">
                                  {row.status}
                                </span>
                              )}
                              <ReadingComparison
                                row={row}
                                components={data.components}
                                dateLabel={dateLabel}
                                compact
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="lab-card-footer">
                        <span>
                          {group.items.length} measurements ·{' '}
                          {mixedDates
                            ? 'Dates vary'
                            : dateLabel(group.latestDate)}
                        </span>
                        <span>
                          Details <IconArrowRight size={12} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <Text size="xs" c="dimmed">
              Each card shows the latest available reading for its tests. Flags
              reflect recorded labels or comparisons with the report’s numerical
              ranges; they do not describe overall organ health. Open a card for
              dates, reference guidance and original reports.
            </Text>
            <Group justify="space-between">
              <Anchor component={Link} to="/lab-results">
                Browse all reports
              </Anchor>
              <Text size="xs" c="dimmed">
                Other medical sections are available in More records.
              </Text>
            </Group>
          </>
        )}
        <details className="lab-family-sharing">
          <summary>Family sharing</summary>
          <InvitationNotifications />
        </details>
      </Stack>
      <Modal
        opened={!!selectedGroup}
        onClose={() => setSelection(null)}
        title={selectedGroup?.title || 'Test details'}
        size="xl"
        centered
      >
        {selectedGroup && (
          <>
            <Text size="sm" c="dimmed" mb="md">
              Latest available readings. Each result retains its own date, unit
              and source report.
            </Text>
            <Table.ScrollContainer minWidth={680}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Test</Table.Th>
                    <Table.Th>Result</Table.Th>
                    <Table.Th>Reference</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Previous / change</Table.Th>
                    <Table.Th>History</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedGroup.items.map(renderMeasurementRow)}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Text size="xs" c="dimmed" mt="sm">
              Comparisons use earlier dated readings in the same or an
              equivalent unit notation, without rescaling values. Lab methods
              and reference ranges can differ; an increase or decrease is not a
              clinical assessment.
            </Text>
            <ReportLinks
              key={`${patientId}:${reportIds.join(',')}`}
              reportIds={reportIds}
              reports={data.reports}
            />
          </>
        )}
      </Modal>
      <Modal
        opened={!!activeTrend}
        onClose={() => setTrend(null)}
        title={activeTrend ? `${markerName(activeTrend)} — history` : 'History'}
        size="lg"
        centered
      >
        {activeTrend && (
          <>
            <Text size="sm" c="dimmed" mb="md">
              Original units and reference guidance are retained for each
              reading. Equivalent unit notation may be matched without rescaling
              values. Free and total hormone tests remain separate. Undated
              readings are listed below but are not plotted.
            </Text>
            <ReadingComparison
              row={activeTrend}
              components={data.components}
              dateLabel={dateLabel}
            />
            {chartPoints.length > 1 ? (
              <div
                style={{ width: '100%', height: 230 }}
                aria-label="Measurement history chart"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartPoints}
                    margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={dateLabel} />
                    <YAxis domain={['auto', 'auto']} width={50} />
                    <ChartTooltip labelFormatter={dateLabel} />
                    <Line
                      type="linear"
                      dataKey="value"
                      name={activeTrend.unit || 'Recorded value'}
                      stroke="var(--mantine-color-teal-6)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Text size="sm" c="dimmed">
                At least two dated numeric readings with known, compatible units
                are needed for a chart.
              </Text>
            )}
            <Table.ScrollContainer minWidth={400}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Report label</Table.Th>
                    <Table.Th>Result</Table.Th>
                    <Table.Th>Reference</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedHistory.map(row => (
                    <Table.Tr key={`${row.lab_result_id}:${row.id}`}>
                      <Table.Td>{dateLabel(observationDate(row))}</Table.Td>
                      <Table.Td>{row.test_name}</Table.Td>
                      <Table.Td>
                        {displayValue(row)} {row.unit}
                      </Table.Td>
                      <Table.Td>{displayReference(row)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <ReportLinks
              key={`history:${patientId}:${measurementKey(activeTrend)}`}
              reportIds={[
                ...new Set(selectedHistory.map(row => row.lab_result_id)),
              ]}
              reports={data.reports}
            />
          </>
        )}
      </Modal>
    </Container>
  );
}
