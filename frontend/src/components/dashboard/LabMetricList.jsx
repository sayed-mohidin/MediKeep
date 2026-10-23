import { Button, Paper, Table, Text, UnstyledButton } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconChevronRight,
  IconEye,
} from '@tabler/icons-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  OVERVIEW_GROUPS,
  displayChange,
  displayPercent,
  displayReference,
  displayValue,
  isFlagged,
  observationDate,
  summaryTestName,
} from '../../utils/labOverview';

const FLAG_ICONS = { high: IconArrowUp, low: IconArrowDown };

export function StatusFlag({ status }) {
  if (!status || status === 'normal') return null;
  const flagged = isFlagged({ status });
  const Icon = FLAG_ICONS[status] || IconAlertTriangle;
  return (
    <span
      className="lab-status"
      data-severity={
        status === 'critical' ? 'critical' : flagged ? 'flag' : 'info'
      }
    >
      {flagged && <Icon size={13} stroke={2.2} aria-hidden />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Sparkline({ rows }) {
  const width = 96;
  const height = 26;
  const pad = 3;
  if (rows.length < 2) return <span className="lab-sparkline" aria-hidden />;
  const values = rows.map(row => row.value);
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const x = i => pad + (i * (width - 2 * pad)) / (values.length - 1);
  const y = v => height - pad - ((v - lo) / span) * (height - 2 * pad);
  const last = values.length - 1;
  return (
    <svg
      className="lab-sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <path
        d={values
          .map(
            (v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
          )
          .join('')}
        fill="none"
        stroke="var(--mantine-color-blue-6)"
        strokeOpacity={0.55}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(last)}
        cy={y(values[last])}
        r={3}
        fill="var(--mantine-color-blue-6)"
        stroke="var(--mantine-color-body)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function ChangeSummary({ metric, dateLabel }) {
  const { comparison, latest } = metric;
  if (!comparison)
    return (
      <span className="lab-metric-when">
        {metric.readings.length > 1
          ? 'No comparable earlier reading'
          : 'First reading'}
      </span>
    );
  return (
    <>
      {displayChange(comparison.change)} {latest.unit}
      {comparison.percent !== null &&
        ` (${displayPercent(comparison.percent)})`}
      <span className="lab-metric-when">
        vs {dateLabel(observationDate(comparison.previous))}
      </span>
    </>
  );
}

function HistoryChart({ metric, dateLabel, onPreview }) {
  const { latest, chartRows } = metric;
  if (chartRows.length < 2)
    return (
      <Text size="sm" c="dimmed">
        A chart needs at least two dated readings in the same unit.
      </Text>
    );
  const points = chartRows.map(row => ({
    date: observationDate(row),
    value: row.value,
    row,
  }));
  const min = latest.ref_range_min;
  const max = latest.ref_range_max;
  const hasRange = min != null || max != null;
  return (
    <>
      <div className="lab-chart-legend">
        <span>
          <span className="lab-legend-line" /> {latest.unit}
        </span>
        {hasRange && (
          <span>
            <span className="lab-legend-band" /> Reference{' '}
            {displayReference(latest)}
          </span>
        )}
      </div>
      <div
        style={{ width: '100%', height: 200 }}
        aria-label="Measurement history chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
            onClick={state => {
              const point = points[state?.activeTooltipIndex];
              if (point) onPreview(metric.readings.indexOf(point.row));
            }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border-light)"
            />
            {hasRange && (
              <ReferenceArea
                y1={min ?? undefined}
                y2={max ?? undefined}
                fill="var(--mantine-color-green-6)"
                fillOpacity={0.1}
                ifOverflow="hidden"
              />
            )}
            <XAxis
              dataKey="date"
              tickFormatter={dateLabel}
              tick={{ fontSize: 11 }}
              stroke="var(--mantine-color-dimmed)"
            />
            <YAxis
              domain={['auto', 'auto']}
              width={44}
              tick={{ fontSize: 11 }}
              stroke="var(--mantine-color-dimmed)"
            />
            <ChartTooltip
              labelFormatter={dateLabel}
              formatter={value => [`${value} ${latest.unit}`, 'Result']}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke="var(--mantine-color-blue-6)"
              strokeWidth={2}
              dot={{
                r: 4,
                strokeWidth: 2,
                fill: 'var(--mantine-color-blue-6)',
              }}
              activeDot={{ r: 6, cursor: 'pointer' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function MetricDetail({ id, metric, reports, dateLabel, onPreview }) {
  const { latest, readings, otherUnits } = metric;
  const reportName = row =>
    reports.find(report => report.id === row.lab_result_id)?.test_name;
  return (
    <div className="lab-metric-detail" id={id}>
      <div>
        <HistoryChart
          metric={metric}
          dateLabel={dateLabel}
          onPreview={onPreview}
        />
        <Text size="xs" c="dimmed" mt="xs">
          {summaryTestName(latest) !== latest.test_name &&
            `Report label: "${latest.test_name}". `}
          {otherUnits.length > 0 &&
            `Also recorded in ${otherUnits.join(', ')}; those readings are listed but not compared or plotted. `}
          {
            "Ranges can differ between labs; a change isn't a clinical assessment."
          }
        </Text>
      </div>
      <Table.ScrollContainer minWidth={300}>
        <Table verticalSpacing={6} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Result</Table.Th>
              <Table.Th className="lab-hide-narrow">Reference</Table.Th>
              <Table.Th>Report</Table.Th>
              <Table.Th aria-label="Preview" />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {readings.map((row, index) => (
              <Table.Tr
                key={`${row.lab_result_id}:${row.id}`}
                className={index === 0 ? 'lab-reading-latest' : undefined}
              >
                <Table.Td className="lab-nowrap">
                  {dateLabel(observationDate(row))}
                </Table.Td>
                <Table.Td>
                  {displayValue(row)} {row.unit}{' '}
                  <StatusFlag status={row.status} />
                </Table.Td>
                <Table.Td className="lab-hide-narrow">
                  {displayReference(row)}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {reportName(row) || row.test_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Button
                    size="compact-xs"
                    variant="default"
                    leftSection={<IconEye size={14} />}
                    onClick={() => onPreview(index)}
                    aria-label={`Preview report from ${dateLabel(observationDate(row))}`}
                  >
                    Preview
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  );
}

function MetricRow({
  metric,
  expanded,
  onToggle,
  onPreview,
  reports,
  dateLabel,
}) {
  const { latest } = metric;
  const detailId = `lab-metric-${metric.key.replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <div className="lab-metric">
      <UnstyledButton
        className="lab-metric-row"
        aria-expanded={expanded}
        aria-controls={expanded ? detailId : undefined}
        onClick={onToggle}
      >
        <span className="lab-metric-name">
          <span className="lab-metric-title">{summaryTestName(latest)}</span>
          <span className="lab-metric-when">
            {metric.readings.length}{' '}
            {metric.readings.length === 1 ? 'reading' : 'readings'} ·{' '}
            {dateLabel(observationDate(latest))}
          </span>
        </span>
        <span className="lab-metric-value">
          <span className="lab-metric-number">{displayValue(latest)}</span>
          {latest.unit && (
            <span className="lab-metric-unit">{latest.unit}</span>
          )}
          <StatusFlag status={latest.status} />
        </span>
        <Sparkline rows={metric.chartRows} />
        <span className="lab-metric-change">
          <ChangeSummary metric={metric} dateLabel={dateLabel} />
        </span>
        <IconChevronRight
          className="lab-metric-chevron"
          size={16}
          aria-hidden
        />
      </UnstyledButton>
      {expanded && (
        <MetricDetail
          id={detailId}
          metric={metric}
          reports={reports}
          dateLabel={dateLabel}
          onPreview={onPreview}
        />
      )}
    </div>
  );
}

export default function LabMetricList({
  metrics,
  grouped,
  expanded,
  onToggle,
  onPreview,
  reports,
  dateLabel,
}) {
  const row = metric => (
    <MetricRow
      key={metric.key}
      metric={metric}
      expanded={expanded.has(metric.key)}
      onToggle={() => onToggle(metric.key)}
      onPreview={index => onPreview(metric.key, index)}
      reports={reports}
      dateLabel={dateLabel}
    />
  );
  return (
    <Paper withBorder radius="md" className="lab-metric-list">
      {grouped
        ? OVERVIEW_GROUPS.map(group => {
            const items = metrics.filter(metric => metric.group === group.id);
            return (
              items.length > 0 && (
                <section key={group.id} aria-label={group.title}>
                  <div className="lab-group-label">{group.title}</div>
                  {items.map(row)}
                </section>
              )
            );
          })
        : metrics.map(row)}
    </Paper>
  );
}
