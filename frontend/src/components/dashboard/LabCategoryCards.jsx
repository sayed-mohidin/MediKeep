import { useState } from 'react';
import {
  Badge,
  Button,
  Paper,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconButterfly,
  IconCandy,
  IconChevronRight,
  IconDroplet,
  IconFilter,
  IconHeartbeat,
  IconLeaf,
  IconSun,
  IconTestPipe,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import {
  OVERVIEW_GROUPS,
  displayChange,
  displayPercent,
  displayValue,
  hasChanged,
  observationDate,
  orderForCard,
  summaryTestName,
} from '../../utils/labOverview';
import StatusFlag from './StatusFlag';

// Decorative identity per category; colours stay clear of the yellow/red used for flags.
const CARD_THEMES = {
  blood: { icon: IconDroplet, color: 'red' },
  glucose: { icon: IconCandy, color: 'orange' },
  lipids: { icon: IconHeartbeat, color: 'pink' },
  kidney: { icon: IconFilter, color: 'violet' },
  liver: { icon: IconLeaf, color: 'teal' },
  thyroid: { icon: IconButterfly, color: 'indigo' },
  vitamins: { icon: IconSun, color: 'lime' },
  other: { icon: IconTestPipe, color: 'gray' },
};

// Long panels (a full blood count has 20+ tests) start collapsed to the most relevant rows.
const COLLAPSED_ROWS = 5;

function ChangeHint({ metric, dateLabel }) {
  const { comparison, latest } = metric;
  if (!comparison || comparison.change === 0) return <span />;
  const Icon = comparison.change > 0 ? IconTrendingUp : IconTrendingDown;
  const label = `Was ${displayValue(comparison.previous)} ${latest.unit} on ${dateLabel(
    observationDate(comparison.previous)
  )} (${displayChange(comparison.change)} ${latest.unit})`;
  return (
    <Tooltip label={label} withArrow>
      <span
        className="lab-change"
        data-changed={hasChanged(metric) || undefined}
      >
        <Icon size={14} aria-hidden />
        {comparison.percent === null
          ? displayChange(comparison.change)
          : displayPercent(comparison.percent)}
      </span>
    </Tooltip>
  );
}

function TestRow({ metric, cardDate, onOpen, dateLabel }) {
  const { latest } = metric;
  const date = observationDate(latest);
  return (
    <UnstyledButton
      className="lab-test-row"
      onClick={onOpen}
      aria-label={`Open ${summaryTestName(latest)} history`}
    >
      <span className="lab-test-name">
        {summaryTestName(latest)}
        {/* Only call out readings that are older than the card's latest report. */}
        {date !== cardDate && (
          <span className="lab-test-date">{dateLabel(date)}</span>
        )}
      </span>
      <span className="lab-test-value">
        <span className="lab-test-number">{displayValue(latest)}</span>
        {latest.unit && <span className="lab-test-unit">{latest.unit}</span>}
        <StatusFlag status={latest.status} />
      </span>
      <ChangeHint metric={metric} dateLabel={dateLabel} />
      <IconChevronRight className="lab-test-chevron" size={16} aria-hidden />
    </UnstyledButton>
  );
}

function CategoryCard({ group, metrics, showAll, onOpen, dateLabel }) {
  const [expanded, setExpanded] = useState(false);
  const ordered = orderForCard(metrics);
  const visible =
    showAll || expanded ? ordered : ordered.slice(0, COLLAPSED_ROWS);
  const hidden = ordered.length - visible.length;
  const flagged = metrics.filter(metric => metric.flagged).length;
  const theme = CARD_THEMES[group.id] || CARD_THEMES.other;
  const cardDate = metrics
    .map(metric => observationDate(metric.latest))
    .filter(Boolean)
    .sort()
    .at(-1);
  return (
    <Paper
      withBorder
      radius="md"
      className="lab-card"
      component="section"
      aria-label={group.title}
      style={{
        '--lab-accent': `var(--mantine-color-${theme.color}-6)`,
        '--lab-accent-tint': `var(--mantine-color-${theme.color}-light)`,
      }}
    >
      <div className="lab-card-head">
        <ThemeIcon
          variant="light"
          color={theme.color}
          size={38}
          radius="md"
          aria-hidden
        >
          <theme.icon size={20} stroke={1.8} />
        </ThemeIcon>
        <div className="lab-card-title">
          <Text fw={700}>{group.title}</Text>
          <Text size="xs" c="dimmed">
            {metrics.length} {metrics.length === 1 ? 'test' : 'tests'}
            {cardDate && ` · ${dateLabel(cardDate)}`}
          </Text>
        </div>
        {flagged > 0 && (
          <Badge color="yellow" variant="light" size="sm">
            {flagged} flagged
          </Badge>
        )}
      </div>
      <div className="lab-card-rows">
        {visible.map(metric => (
          <TestRow
            key={metric.key}
            metric={metric}
            cardDate={cardDate}
            onOpen={() => onOpen(metric.key)}
            dateLabel={dateLabel}
          />
        ))}
      </div>
      {!showAll && ordered.length > COLLAPSED_ROWS && (
        <Button
          variant="subtle"
          size="compact-sm"
          className="lab-card-more"
          onClick={() => setExpanded(value => !value)}
        >
          {hidden > 0 ? `Show all ${ordered.length}` : 'Show fewer'}
        </Button>
      )}
    </Paper>
  );
}

export default function LabCategoryCards({
  metrics,
  showAll,
  onOpen,
  dateLabel,
}) {
  return (
    <div className="lab-card-grid">
      {OVERVIEW_GROUPS.map(group => {
        const items = metrics.filter(metric => metric.group === group.id);
        return (
          items.length > 0 && (
            <CategoryCard
              key={group.id}
              group={group}
              metrics={items}
              showAll={showAll}
              onOpen={onOpen}
              dateLabel={dateLabel}
            />
          )
        );
      })}
    </div>
  );
}
