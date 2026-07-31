/**
 * useBranches — shared hook for fetching the college's active branch list.
 *
 * Calls GET /api/v1/admin/branches?active_only=true once per mount.
 * All pages that need a branch dropdown import this hook instead of
 * maintaining their own hardcoded list.
 *
 * Returns:
 *   branches  — array of { id, name, code, is_active }
 *   loading   — true while the request is in flight
 *   error     — error message string if the request failed, or null
 *   refetch   — function to manually re-trigger the fetch
 */
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../services/api';

let _cache = null; // module-level cache so all components share one fetch

export function useBranches() {
  const [branches, setBranches] = useState(_cache ?? []);
  const [loading, setLoading]   = useState(!_cache);
  const [error, setError]       = useState(null);

  const fetchBranches = useCallback(async () => {
    if (_cache) {
      setBranches(_cache);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await adminApi.listBranches({ active_only: 'true' });
    if (res?.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    const list = res?.branches ?? [];
    _cache = list;
    setBranches(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  /** Call this after creating / deactivating a branch to bust the cache. */
  const refetch = useCallback(() => {
    _cache = null;
    fetchBranches();
  }, [fetchBranches]);

  return { branches, loading, error, refetch };
}

export default useBranches;
