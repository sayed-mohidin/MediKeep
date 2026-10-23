import { useEffect, useState } from 'react';
import { apiService } from '../services/api';

export const COMPONENT_LIMIT = 5000;
export async function loadLabOverview(patientId, signal) {
  const reports = [];
  // The reports endpoint is paginated even though its response is an array.
  for (let skip = 0; ; skip += 1000) {
    const batch = await apiService.get('/lab-results/', {
      params: { patient_id: patientId, limit: 1000, skip },
      signal,
    });
    if (batch.some(report => report.patient_id !== patientId))
      throw new Error('Unexpected patient in report response');
    reports.push(...batch);
    if (batch.length < 1000) break;
  }
  const components = await apiService.get(
    `/lab-test-components/patient/${patientId}/all`,
    { params: { limit: COMPONENT_LIMIT }, signal }
  );
  return {
    reports,
    components,
    truncated: components.length === COMPONENT_LIMIT,
  };
}
export function useLabOverview(patientId) {
  const [state, setState] = useState({
    patientId: null,
    loading: true,
    reports: [],
    components: [],
    error: null,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({
      patientId,
      loading: !!patientId,
      reports: [],
      components: [],
      error: null,
    });
    if (patientId) {
      loadLabOverview(patientId, controller.signal)
        .then(data => {
          if (active)
            setState({ ...data, patientId, loading: false, error: null });
        })
        .catch(_error => {
          if (active && !controller.signal.aborted)
            setState({
              patientId,
              reports: [],
              components: [],
              loading: false,
              error:
                'Could not load this patient’s test results. Please retry.',
            });
        });
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, [patientId, revision]);
  // Never paint another patient's previous state, even before the effect cleanup runs.
  const visible =
    state.patientId === patientId
      ? state
      : {
          patientId,
          loading: !!patientId,
          reports: [],
          components: [],
          error: null,
        };
  return { ...visible, refresh: () => setRevision(value => value + 1) };
}
