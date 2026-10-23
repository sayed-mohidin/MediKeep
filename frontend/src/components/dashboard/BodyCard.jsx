import { Link } from 'react-router-dom';
import { Button, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconScale } from '@tabler/icons-react';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { convertForDisplay, unitLabels } from '../../utils/unitConversion';
import { summarizeBody } from '../../utils/bodyMeasures';
import { displayChange } from '../../utils/labOverview';
import { ThemedCard } from './LabCategoryCards';

const THEME = { icon: IconScale, color: 'cyan' };
const BMI_NOTE =
  'BMI = weight ÷ height². WHO adult ranges: under 18.5 underweight, 18.5–24.9 healthy, 25–29.9 overweight, 30+ obese. Lower action points (23 and 27.5) are suggested for Asian populations. BMI does not account for muscle mass.';

function BodyRow({ label, value, unit, note, hint }) {
  return (
    <UnstyledButton
      component={Link}
      to="/vitals"
      className="lab-test-row"
      aria-label={`${label}: ${value} ${unit || ''}. Open Vitals`}
    >
      <span className="lab-test-name">
        {label}
        {note && <span className="lab-test-date">{note}</span>}
      </span>
      <span className="lab-test-value">
        <span className="lab-test-number">{value}</span>
        {unit && <span className="lab-test-unit">{unit}</span>}
      </span>
      <span className="lab-change">{hint}</span>
      <IconChevronRight className="lab-test-chevron" size={16} aria-hidden />
    </UnstyledButton>
  );
}

export default function BodyCard({ readings, error, dateLabel }) {
  const { unitSystem } = useUserPreferences();
  const body = summarizeBody(readings);
  const weightUnit = unitLabels[unitSystem]?.weight || 'lbs';
  const weightOf = row =>
    Math.round(convertForDisplay(row.weight, 'weight', unitSystem) * 10) / 10;
  const date = row => dateLabel(String(row.recorded_date).slice(0, 10));
  const empty = !body.weight && !body.pressure;

  return (
    <ThemedCard
      theme={THEME}
      title="Body"
      subtitle={
        body.weight ? `Latest · ${date(body.weight)}` : 'From your Vitals'
      }
    >
      {error ? (
        <Text size="sm" c="dimmed" px="sm" py="xs">
          Vitals couldn’t be loaded.
        </Text>
      ) : empty ? (
        <div className="lab-card-empty">
          <Text size="sm" c="dimmed">
            Add your weight and height in Vitals to see your BMI here.
          </Text>
          <Button
            component={Link}
            to="/vitals"
            size="compact-sm"
            variant="light"
            color="cyan"
          >
            Add in Vitals
          </Button>
        </div>
      ) : (
        <div className="lab-card-rows">
          {body.bmi != null && (
            <Tooltip label={BMI_NOTE} multiline w={300} withArrow>
              <div>
                <BodyRow label="BMI" value={body.bmi} note={body.bmiCategory} />
              </div>
            </Tooltip>
          )}
          {body.weight && (
            <BodyRow
              label="Weight"
              value={weightOf(body.weight)}
              unit={weightUnit}
              note={!body.height ? 'Add height for BMI' : undefined}
              hint={
                body.previousWeight &&
                `${displayChange(weightOf(body.weight) - weightOf(body.previousWeight))} ${weightUnit}`
              }
            />
          )}
          {body.pressure && (
            <BodyRow
              label="Blood pressure"
              value={`${body.pressure.systolic_bp}/${body.pressure.diastolic_bp}`}
              unit="mmHg"
              note={date(body.pressure)}
            />
          )}
        </div>
      )}
    </ThemedCard>
  );
}
