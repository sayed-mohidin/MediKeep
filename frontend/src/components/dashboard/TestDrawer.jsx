import { Button, Drawer, Stack, Table, Text } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
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
  displayReference,
  displayValue,
  observationDate,
  summaryTestName,
} from '../../utils/labOverview';
import ReportPreview from './ReportPreview';
import StatusFlag from './StatusFlag';

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

function TestHistory({ metric, reports, dateLabel, onPreview }) {
  const { latest, readings, otherUnits } = metric;
  const reportName = row =>
    reports.find(report => report.id === row.lab_result_id)?.test_name;
  return (
    <div className="lab-test-history">
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

// One panel per test: its history, and the original report for any reading.
export default function TestDrawer({
  metric,
  previewIndex,
  onPreview,
  onClose,
  reports,
  dateLabel,
}) {
  const latest = metric?.latest;
  return (
    <Drawer
      opened={!!metric}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        latest && (
          <Stack gap={0}>
            <Text fw={700} size="lg">
              {summaryTestName(latest)}
            </Text>
            <Text size="sm" c="dimmed">
              Latest {displayValue(latest)} {latest.unit} ·{' '}
              {dateLabel(observationDate(latest))}
            </Text>
          </Stack>
        )
      }
      classNames={{ body: 'lab-drawer-body' }}
    >
      {metric &&
        (previewIndex === null ? (
          <TestHistory
            metric={metric}
            reports={reports}
            dateLabel={dateLabel}
            onPreview={onPreview}
          />
        ) : (
          <ReportPreview
            metric={metric}
            index={previewIndex}
            onIndexChange={onPreview}
            onBack={() => onPreview(null)}
            reports={reports}
            dateLabel={dateLabel}
          />
        ))}
    </Drawer>
  );
}
