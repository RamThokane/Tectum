import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// Starts with 'posts' so likes, votes and reveals patch it in place like any other post cache.
export const CASE_OF_THE_DAY = ['posts', 'case-of-the-day'];
export const fetchCaseOfTheDay = () => api.get('/posts/case-of-the-day').then((r) => r.data);

/**
 * Today's case: the one an admin chose, or the most-discussed case until one is chosen.
 * `pinnedId` is only sent to admins (members never see who picked it).
 */
export function useCaseOfTheDay() {
  const query = useQuery({ queryKey: CASE_OF_THE_DAY, queryFn: fetchCaseOfTheDay, staleTime: 5 * 60_000 });
  return { ...query, data: query.data === undefined ? undefined : query.data.post ?? null, pinnedId: query.data?.pinnedId ?? null };
}
