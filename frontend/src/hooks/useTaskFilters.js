/**
 * useTaskFilters
 *
 * Persists the task board filter state in the URL query string.
 * Navigating away and back restores the filter automatically.
 *
 * Usage:
 *   const { filter, setFilter } = useTaskFilters();
 */

import { useSearchParams } from 'react-router-dom';

export function useTaskFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = searchParams.get('filter') || 'all';

  function setFilter(value) {
    if (value === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: value });
    }
  }

  return { filter, setFilter };
}
