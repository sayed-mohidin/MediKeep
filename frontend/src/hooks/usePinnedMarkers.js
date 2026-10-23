import { useCallback, useEffect, useState } from 'react';

const storageKey = patientId => `medikeep.keyMarkers.${patientId}`;
const read = patientId => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(patientId)));
    return { pinned: saved?.pinned || [], unpinned: saved?.unpinned || [] };
  } catch {
    return { pinned: [], unpinned: [] };
  }
};

// Per-patient additions to and removals from the default key markers, kept in this browser.
export function usePinnedMarkers(patientId) {
  const [state, setState] = useState(() => ({ patientId, ...read(patientId) }));
  useEffect(() => {
    if (state.patientId !== patientId)
      setState({ patientId, ...read(patientId) });
  }, [patientId, state.patientId]);
  const current =
    state.patientId === patientId ? state : { patientId, ...read(patientId) };

  const isPinned = useCallback(
    (key, isDefault) =>
      isDefault
        ? !current.unpinned.includes(key)
        : current.pinned.includes(key),
    [current]
  );
  const setPinned = useCallback(
    (key, isDefault, pinned) => {
      const without = list => list.filter(item => item !== key);
      const next = {
        // Only deviations from the default list are stored.
        pinned:
          !isDefault && pinned
            ? [...without(current.pinned), key]
            : without(current.pinned),
        unpinned:
          isDefault && !pinned
            ? [...without(current.unpinned), key]
            : without(current.unpinned),
      };
      try {
        localStorage.setItem(storageKey(patientId), JSON.stringify(next));
      } catch {
        // Storage can be unavailable (private mode); the choice still applies for this visit.
      }
      setState({ patientId, ...next });
    },
    [current, patientId]
  );
  return { isPinned, setPinned };
}
