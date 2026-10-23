import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
} from '@tabler/icons-react';
import { isFlagged } from '../../utils/labOverview';

const FLAG_ICONS = { high: IconArrowUp, low: IconArrowDown };

export default function StatusFlag({ status }) {
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
