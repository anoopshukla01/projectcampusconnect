import { useState, useEffect } from 'react';

/**
 * Standardized hook for backend API integration across Campus Connect.
 * Provides explicit LOADING, EMPTY, POPULATED, and ERROR states.
 */
export function useApiData(endpoint, defaultData = null) {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('access_token') || localStorage.getItem('ss_token');
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch(endpoint, { headers })
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Couldn't load data`);
        }
        if (!contentType.includes('application/json')) {
          // Received HTML (e.g. 404 fallback page when backend is not running)
          return defaultData;
        }
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setData(json || defaultData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (defaultData) {
            setData(defaultData);
            setLoading(false);
          } else {
            setError(err.message || "Couldn't load your data — try again");
            setLoading(false);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [endpoint]);

  const isEmpty = !loading && !error && (
    data === null ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && Object.keys(data).length === 0) ||
    (data.subjects && data.subjects.length === 0) ||
    (data.grades && data.grades.length === 0) ||
    (data.announcements && data.announcements.length === 0) ||
    (data.events && data.events.length === 0) ||
    (data.items && data.items.length === 0) ||
    (data.notes && data.notes.length === 0) ||
    (data.resources && data.resources.length === 0) ||
    (data.assignments && data.assignments.length === 0)
  );

  return { data, loading, error, isEmpty, setData };
}
