import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../services/api';

/**
 * Standardised hook for backend API integration across Campus Connect.
 * Provides explicit LOADING, EMPTY, POPULATED, and ERROR states.
 *
 * Uses the central api service (which handles token refresh + auth headers)
 * instead of raw fetch, so every component gets silent refresh for free.
 *
 * @param {string | null} endpoint  - Relative path after /api/v1, e.g. '/academics/grades'.
 *                                    Pass null to skip the initial fetch.
 * @param {*} defaultData           - Value to use while loading or on error.
 * @param {Record<string,any>} [queryParams] - Optional query-string params.
 */
export function useApiData(endpoint, defaultData = null, queryParams = undefined) {
  const [data, setData]       = useState(defaultData);
  const [loading, setLoading] = useState(endpoint !== null);
  const [error, setError]     = useState(null);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    setError(null);

    const result = await apiGet(endpoint, queryParams);

    if (result?._networkError || result?._sessionExpired) {
      if (defaultData !== null) {
        setData(defaultData);
        setLoading(false);
      } else {
        setError(result.error ?? "Couldn't load your data — try again");
        setLoading(false);
      }
      return;
    }

    if (result?.error && !result?._raw) {
      // Server returned an error response
      if (defaultData !== null) {
        setData(defaultData);
      } else {
        setError(result.error);
      }
      setLoading(false);
      return;
    }

    setData(result ?? defaultData);
    setLoading(false);
  }, [endpoint, queryParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isEmpty =
    !loading &&
    !error &&
    (data === null ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'object' &&
        !Array.isArray(data) &&
        Object.keys(data).length === 0) ||
      (data?.subjects       && data.subjects.length       === 0) ||
      (data?.grades         && data.grades.length         === 0) ||
      (data?.announcements  && data.announcements.length  === 0) ||
      (data?.events         && data.events.length         === 0) ||
      (data?.items          && data.items.length          === 0) ||
      (data?.notes          && data.notes.length          === 0) ||
      (data?.resources      && data.resources.length      === 0) ||
      (data?.assignments    && data.assignments.length    === 0) ||
      (data?.drives         && data.drives.length         === 0) ||
      (data?.rooms          && data.rooms.length          === 0) ||
      (data?.messages       && data.messages.length       === 0));

  /** Manually re-trigger the fetch (e.g. after a mutation). */
  const refetch = useCallback(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, isEmpty, setData, refetch };
}
