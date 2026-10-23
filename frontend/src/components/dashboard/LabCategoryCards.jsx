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

// Shared frame for category cards and the Body card.
export function ThemedCard({ theme, title, subtitle, badge, children }) {
  return (
    <Paper
      withBorder
      radius="md"
      className="lab-card"
      component="section"
      aria-label={title}
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
          <Text fw={700}>{title}</Text>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </div>
        {badge}
      </div>
      {children}
    </Paper>
  );
}

function CategoryCard({
  group,
  metrics,
  isPrimary,
  showAll,
  onOpen,
  dateLabel,
}) {
  const [expanded, setExpanded] = useState(false);
  const ordered = orderForCard(metrics);
  // Key view: the card's key/pinned/flagged tests. All view: the first few rows.
  const primary = showAll
    ? ordered
    : isPrimary
      ? ordered.filter(isPrimary)
      : ordered.slice(0, COLLAPSED_ROWS);
  if (!primary.length) return null;
  const visible = expanded ? ordered : primary;
  const hidden = ordered.length - primary.length;
  const flagged = metrics.filter(metric => metric.flagged).length;
  const cardDate = metrics
    .map(metric => observationDate(metric.latest))
    .filter(Boolean)
    .sort()
    .at(-1);
  const count =
    isPrimary && hidden > 0
      ? `${primary.length} of ${ordered.length} tests`
      : `${ordered.length} ${ordered.length === 1 ? 'test' : 'tests'}`;
  return (
    <ThemedCard
      theme={CARD_THEMES[group.id] || CARD_THEMES.other}
      title={group.title}
      subtitle={`${count}${cardDate ? ` · ${dateLabel(cardDate)}` : ''}`}
      badge={
        flagged > 0 && (
          <Badge color="yellow" variant="light" size="sm">
            {flagged} flagged
          </Badge>
        )
      }
    >
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
      {hidden > 0 && (
        <Button
          variant="subtle"
          size="compact-sm"
          className="lab-card-more"
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more`}
        </Button>
      )}
    </ThemedCard>
  );
}

export default function LabCategoryCards({
  metrics,
  isPrimary,
  showAll,
  onOpen,
  dateLabel,
  leading,
}) {
  return (
    <div className="lab-card-grid">
      {leading}
      {OVERVIEW_GROUPS.map(group => {
        const items = metrics.filter(metric => metric.group === group.id);
        return (
          items.length > 0 && (
            <CategoryCard
              key={group.id}
              group={group}
              metrics={items}
              isPrimary={isPrimary}
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
