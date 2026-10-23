import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Group, Loader, Select, Stack, Text } from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconExternalLink,
  IconFileText,
} from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { ENTITY_TYPES } from '../../utils/entityRelationships';
import { buildEntityUrl } from '../../utils/entityNavigation';
import {
  displayReference,
  displayValue,
  observationDate,
  sourcePage,
  summaryTestName,
} from '../../utils/labOverview';
import StatusFlag from './StatusFlag';

const isPdf = file =>
  file.file_type?.toLowerCase() === 'application/pdf' ||
  /\.pdf$/i.test(file.file_name || '');
const isImage = file =>
  file.file_type?.toLowerCase().startsWith('image/') ||
  /\.(png|jpe?g|gif|webp)$/i.test(file.file_name || '');

// Loads a report's attachments once per drawer instance. The drawer is keyed by
// patient, so nothing is shared across patients.
function useReportFiles(labResultId) {
  const cache = useRef(new Map());
  const [state, setState] = useState({ id: null, files: [], error: false });
  useEffect(() => {
    if (!labResultId) return undefined;
    if (cache.current.has(labResultId)) {
      setState({
        id: labResultId,
        files: cache.current.get(labResultId),
        error: false,
      });
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setState({ id: null, files: [], error: false });
    apiService
      .getEntityFiles('lab-result', labResultId, controller.signal)
      .then(files => {
        cache.current.set(labResultId, files);
        if (active) setState({ id: labResultId, files, error: false });
      })
      .catch(() => {
        if (active) setState({ id: labResultId, files: [], error: true });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [labResultId]);
  return { ...state, loading: state.id !== labResultId };
}

// Browsers without a built-in PDF viewer (e.g. Android Chrome) render an empty frame.
const canEmbedPdf = () => navigator.pdfViewerEnabled !== false;

function FileView({ file, page }) {
  const url = apiService.getEntityFileViewUrl(file.id);
  const pageUrl = page ? `${url}#page=${page}` : url;
  if (isPdf(file) && canEmbedPdf())
    return (
      <iframe
        className="lab-preview-frame"
        src={pageUrl}
        title={file.file_name}
      />
    );
  if (isImage(file))
    return <img className="lab-preview-image" src={url} alt={file.file_name} />;
  return (
    <Stack align="center" gap="xs" py="xl">
      <IconFileText size={28} />
      <Text size="sm" c="dimmed" ta="center">
        {isPdf(file)
          ? 'This browser can’t show PDFs inside the page.'
          : 'This file type can’t be shown here.'}
      </Text>
      <Button
        component="a"
        href={pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        size="compact-sm"
        variant="default"
        leftSection={<IconExternalLink size={14} />}
      >
        Open {file.file_name}
        {page ? ` (page ${page})` : ''}
      </Button>
    </Stack>
  );
}

export default function ReportPreview({
  metric,
  index,
  onIndexChange,
  onBack,
  reports,
  dateLabel,
}) {
  const reading = metric?.readings[index];
  const labResultId = reading?.lab_result_id;
  const { files, loading, error } = useReportFiles(labResultId);
  const [chosen, setChosen] = useState(null);
  const viewable = files.filter(file => isPdf(file) || isImage(file));
  const file =
    files.find(f => String(f.id) === chosen) || viewable[0] || files[0];
  const report = reports.find(r => r.id === labResultId);
  const page = reading ? sourcePage(reading) : null;
  const total = metric?.readings.length || 0;
  // Readings are newest first; "Older" moves down the list.
  const canOlder = index < total - 1;
  const canNewer = index > 0;

  useEffect(() => setChosen(null), [labResultId]);
  useEffect(() => {
    if (!metric) return undefined;
    const onKey = event => {
      if (event.target.closest?.('input, textarea, select')) return;
      if (event.key === 'ArrowLeft' && canOlder) onIndexChange(index + 1);
      if (event.key === 'ArrowRight' && canNewer) onIndexChange(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [metric, index, canOlder, canNewer, onIndexChange]);

  if (!reading) return null;
  return (
    <div className="lab-preview">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Button
          size="compact-sm"
          variant="subtle"
          leftSection={<IconArrowLeft size={14} />}
          onClick={onBack}
        >
          Back to history
        </Button>
        <Text size="xs" c="dimmed" ta="right">
          {report?.test_name || 'Lab report'} ·{' '}
          {dateLabel(observationDate(reading))}
          {(reading.facility || report?.facility) &&
            ` · ${reading.facility || report.facility}`}
        </Text>
      </Group>

      <Group className="lab-preview-stepper" gap="xs" wrap="nowrap">
        <Button
          size="compact-sm"
          variant="default"
          leftSection={<IconArrowLeft size={14} />}
          disabled={!canOlder}
          onClick={() => onIndexChange(index + 1)}
        >
          Older
        </Button>
        <Text size="sm" fw={600}>
          {summaryTestName(reading)}{' '}
          <Text span size="sm" c="dimmed" fw={400}>
            · {total - index} of {total}
          </Text>
        </Text>
        <Button
          size="compact-sm"
          variant="default"
          rightSection={<IconArrowRight size={14} />}
          disabled={!canNewer}
          onClick={() => onIndexChange(index - 1)}
        >
          Newer
        </Button>
      </Group>
      <Group className="lab-preview-reading" gap="md">
        <Text size="sm">
          <Text span fw={700} size="lg">
            {displayValue(reading)}
          </Text>{' '}
          {reading.unit} <StatusFlag status={reading.status} />
        </Text>
        <Text size="sm" c="dimmed">
          Reference {displayReference(reading)}
        </Text>
        {page && (
          <Text size="sm" c="dimmed">
            Page {page}
          </Text>
        )}
        {reading.test_name !== summaryTestName(reading) && (
          <Text size="xs" c="dimmed">
            {`Report label: "${reading.test_name}"`}
          </Text>
        )}
      </Group>
      {files.length > 1 && (
        <Select
          size="xs"
          mb="xs"
          aria-label="Attached file"
          allowDeselect={false}
          value={String(file.id)}
          onChange={setChosen}
          data={files.map(f => ({
            value: String(f.id),
            label: f.file_name,
          }))}
        />
      )}
      <div className="lab-preview-document">
        {loading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" aria-label="Loading report" />
          </Group>
        ) : error ? (
          <Text size="sm" c="dimmed">
            The report file couldn’t be loaded. Try again, or open the lab
            result.
          </Text>
        ) : file ? (
          <FileView key={`${file.id}:${page}`} file={file} page={page} />
        ) : (
          <Stack align="center" gap="xs" py="xl">
            <IconFileText size={28} />
            <Text size="sm" c="dimmed">
              No file is attached to this report.
            </Text>
          </Stack>
        )}
      </div>
      <Group className="lab-preview-footer" gap="xs">
        {file && (
          <Button
            component="a"
            href={`${apiService.getEntityFileViewUrl(file.id)}${page ? `#page=${page}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            size="compact-sm"
            variant="default"
            leftSection={<IconExternalLink size={14} />}
          >
            Open in new tab
          </Button>
        )}
        <Button
          component={Link}
          to={buildEntityUrl(ENTITY_TYPES.LAB_RESULT, labResultId, {
            autoOpen: true,
          })}
          size="compact-sm"
          variant="default"
        >
          Open lab result
        </Button>
      </Group>
    </div>
  );
}
