import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

/**
 * The most-discussed cases, fetched once and shared: the right rail lists them and Home's
 * "Case of the Day" is the first one (these used to be two requests, limit=1 and limit=4).
 * The key starts with 'posts' so votes and reveals patch it in place.
 */
export function useTrendingCases() {
  return useQuery({
    queryKey: ['posts', 'trending-cases'],
    queryFn: () => api.get('/posts', { params: { type: 'case_study', sort: 'discussed', limit: 4 } }).then((r) => r.data.posts),
    staleTime: 5 * 60_000,
  });
}
