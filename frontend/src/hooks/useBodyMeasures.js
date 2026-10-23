import { useEffect, useState } from 'react';
import { apiService } from '../services/api';

// Vitals for one patient. Like useLabOverview, a previous patient's state is never shown.
export function useBodyMeasures(patientId) {
  const [state, setState] = useState({
    patientId: null,
    readings: [],
    error: false,
  });
  useEffect(() => {
    if (!patientId) return undefined;
    const controller = new AbortController();
    let active = true;
    apiService
      .get(`/vitals/patient/${patientId}`, {
        params: { limit: 500 },
        signal: controller.signal,
      })
      .then(readings => {
        if (active) setState({ patientId, readings, error: false });
      })
      .catch(() => {
        if (active && !controller.signal.aborted)
          setState({ patientId, readings: [], error: true });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [patientId]);
  return state.patientId === patientId
    ? { ...state, loading: false }
    : { patientId, readings: [], error: false, loading: !!patientId };
}
