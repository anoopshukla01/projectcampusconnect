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

const DEFAULT_BRANCHES = [
  { id: 'b-cse', name: 'Computer Science & Engineering', code: 'CSE', is_active: true },
  { id: 'b-it', name: 'Information Technology', code: 'IT', is_active: true },
  { id: 'b-ece', name: 'Electronics & Communication Engineering', code: 'ECE', is_active: true },
  { id: 'b-me', name: 'Mechanical Engineering', code: 'ME', is_active: true },
  { id: 'b-ce', name: 'Civil Engineering', code: 'CE', is_active: true },
  { id: 'b-ee', name: 'Electrical Engineering', code: 'EE', is_active: true },
  { id: 'b-aids', name: 'Artificial Intelligence & Data Science', code: 'AIDS', is_active: true },
];

let _cache = null;

export function useBranches() {
  const [branches, setBranches] = useState(_cache ?? DEFAULT_BRANCHES);
  const [loading, setLoading]   = useState(!_cache);
  const [error, setError]       = useState(null);

  const fetchBranches = useCallback(async (bypass = false) => {
    if (_cache && !bypass) {
      setBranches(_cache);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listBranches({ active_only: 'true' });
      if (res?.error) {
        setError(res.error);
        setBranches(prev => prev.length > 0 ? prev : DEFAULT_BRANCHES);
        setLoading(false);
        return;
      }
      const list = res?.branches?.length ? res.branches : DEFAULT_BRANCHES;
      _cache = list;
      setBranches(list);
    } catch (err) {
      setError('Failed to load branches');
      setBranches(prev => prev.length > 0 ? prev : DEFAULT_BRANCHES);
    } finally {
      setLoading(false);
    }
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
