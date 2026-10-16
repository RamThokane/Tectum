import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { toast } from '../store/ui';
import { readSession } from '../lib/quiz';

/**
 * Tests: data hooks for the organizer and participant pages. Attempt calls carry the attempt's
 * session token (X-Attempt-Session) so only the tab that started it can use it.
 */
const onError = (e) => toast(e.message, 'error');

// ---------------------------------------------------------------- organizer
export function useMyQuizzes() {
  return useQuery({ queryKey: ['quiz', 'mine'], queryFn: () => api.get('/quizzes/mine').then((r) => r.data.quizzes) });
}

export function useQuizForOrganizer(id) {
  return useQuery({
    queryKey: ['quiz', id],
    queryFn: () => api.get(`/quizzes/${id}`).then((r) => r.data.quiz),
    enabled: Boolean(id),
  });
}

/** Create (no id) or update a test. Returns the saved test. */
export function useSaveQuiz(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => (id ? api.put(`/quizzes/${id}`, body) : api.post('/quizzes', body)).then((r) => r.data.quiz),
    onSuccess: (quiz) => {
      qc.setQueryData(['quiz', quiz._id], quiz);
      qc.invalidateQueries({ queryKey: ['quiz', 'mine'] });
    },
    onError,
  });
}

export function useQuizAction(id) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['quiz', id] });
    qc.invalidateQueries({ queryKey: ['quiz', 'mine'] });
  };
  return {
    publish: useMutation({ mutationFn: () => api.post(`/quizzes/${id}/publish`).then((r) => r.data.quiz), onSuccess: refresh }),
    regenerate: useMutation({ mutationFn: () => api.post(`/quizzes/${id}/regenerate-code`).then((r) => r.data), onSuccess: refresh, onError }),
    joinable: useMutation({ mutationFn: (joinable) => api.patch(`/quizzes/${id}/joinable`, { joinable }).then((r) => r.data), onSuccess: refresh, onError }),
    remove: useMutation({ mutationFn: (qid = id) => api.delete(`/quizzes/${qid}`).then((r) => r.data), onSuccess: refresh, onError }),
    duplicate: useMutation({ mutationFn: (qid = id) => api.post(`/quizzes/${qid}/duplicate`).then((r) => r.data.quiz), onSuccess: refresh, onError }),
    invite: useMutation({ mutationFn: (userIds) => api.post(`/quizzes/${id}/invite`, { userIds }).then((r) => r.data), onSuccess: refresh, onError }),
  };
}

export function useQuizResults(id) {
  return useQuery({ queryKey: ['quiz', id, 'results'], queryFn: () => api.get(`/quizzes/${id}/results`).then((r) => r.data), enabled: Boolean(id), refetchInterval: 20_000 });
}

export function useAttemptDetail(quizId, attemptId) {
  return useQuery({
    queryKey: ['quiz', quizId, 'attempt', attemptId],
    queryFn: () => api.get(`/quizzes/${quizId}/attempts/${attemptId}`).then((r) => r.data),
    enabled: Boolean(quizId && attemptId),
  });
}

export function useReinstate(quizId, attemptId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/quizzes/${quizId}/attempts/${attemptId}/reinstate`, body).then((r) => r.data),
    onSuccess: (d) => {
      toast(d.message);
      qc.invalidateQueries({ queryKey: ['quiz', quizId] });
    },
    onError,
  });
}

export const searchPeople = (q) => api.get('/quizzes/people', { params: { q } }).then((r) => r.data.users);
export const importQuestions = (id, format, content) => api.post(`/quizzes/${id}/import`, { format, content }).then((r) => r.data);
export function uploadQuestionImage(file) {
  const fd = new FormData();
  fd.append('questionImage', file);
  return api.post('/quizzes/images', fd).then((r) => r.data.url);
}

// ---------------------------------------------------------------- participant
export const joinWithCode = (code) => api.post('/quizzes/join', { code }).then((r) => r.data);

export function useQuizInfo(id) {
  return useQuery({ queryKey: ['quiz', id, 'info'], queryFn: () => api.get(`/quizzes/${id}/info`).then((r) => r.data), enabled: Boolean(id), retry: false });
}

/** mode: 'fullscreen', or 'phone' (iPhone mode: iPhones have no full screen for web pages). */
export const startAttempt = (id, mode = 'fullscreen') => api.post(`/quizzes/${id}/start`, { fullscreen: mode === 'fullscreen', mode }).then((r) => r.data);

/** Calls on a running attempt, with this tab's session token. */
export const attemptApi = (attemptId) => {
  const headers = () => ({ 'X-Attempt-Session': readSession(attemptId) ?? '' });
  return {
    load: () => api.get(`/attempts/${attemptId}`, { headers: headers() }).then((r) => r.data),
    heartbeat: () => api.post(`/attempts/${attemptId}/heartbeat`, null, { headers: headers() }).then((r) => r.data),
    save: (answers) => api.patch(`/attempts/${attemptId}/answer`, { answers }, { headers: headers() }).then((r) => r.data),
    violation: (type, meta = '') => api.post(`/attempts/${attemptId}/violation`, { type, meta }, { headers: headers() }).then((r) => r.data),
    submit: (auto = false) => api.post(`/attempts/${attemptId}/submit`, { auto }, { headers: headers() }).then((r) => r.data),
  };
};

export function useAttemptResult(attemptId) {
  return useQuery({ queryKey: ['attempt', attemptId, 'result'], queryFn: () => api.get(`/attempts/${attemptId}/result`).then((r) => r.data), enabled: Boolean(attemptId) });
}

export function useMyAttempts() {
  return useQuery({ queryKey: ['attempt', 'mine'], queryFn: () => api.get('/attempts/mine').then((r) => r.data.attempts) });
}

// ---------------------------------------------------------------- hosts, listed tests and registration
/** Can I conduct tests: { status, canHost, application, freeTests, published, freeLeft }. */
export function useHostStatus(enabled = true) {
  return useQuery({ queryKey: ['quiz', 'host-status'], queryFn: () => api.get('/quizzes/host/status').then((r) => r.data), enabled });
}

export function useApplyToHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/quizzes/host/apply', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quiz', 'host-status'] }),
  });
}

/** The Quizzes tab: approved hosts (organisations). */
export function useHosts() {
  return useQuery({ queryKey: ['quiz', 'hosts'], queryFn: () => api.get('/quizzes/hosts').then((r) => r.data.hosts) });
}

/** A host's Tests tab: { host, isSelf, upcoming, past }. */
export function useHostTests(userId) {
  return useQuery({ queryKey: ['quiz', 'by', userId], queryFn: () => api.get(`/quizzes/by/${userId}`).then((r) => r.data), enabled: Boolean(userId), refetchInterval: 60_000 });
}

export function useQuizDetails(id) {
  return useQuery({ queryKey: ['quiz', id, 'details'], queryFn: () => api.get(`/quizzes/${id}/details`).then((r) => r.data), enabled: Boolean(id), retry: false });
}

export function useMyRegistrations() {
  return useQuery({ queryKey: ['quiz', 'registrations', 'mine'], queryFn: () => api.get('/quizzes/registrations/mine').then((r) => r.data.tests) });
}

/** Register for a listed test ({ name, college }) or withdraw (null). */
export function useRegister(quizId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => (body ? api.post(`/quizzes/${quizId}/register`, body) : api.delete(`/quizzes/${quizId}/register`)).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quiz', 'by'] });
      qc.invalidateQueries({ queryKey: ['quiz', quizId, 'details'] });
      qc.invalidateQueries({ queryKey: ['quiz', 'registrations', 'mine'] });
    },
  });
}

/** The host's list of requests for a test, and accept / decline. */
export function useRegistrations(quizId, enabled = true) {
  return useQuery({ queryKey: ['quiz', quizId, 'registrations'], queryFn: () => api.get(`/quizzes/${quizId}/registrations`).then((r) => r.data), enabled: Boolean(quizId) && enabled, refetchInterval: 30_000 });
}

export function useDecideRegistrations(quizId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, action }) => api.post(`/quizzes/${quizId}/registrations`, { ids, action }).then((r) => r.data),
    onSuccess: (d) => {
      if (d.message) toast(d.message);
      qc.invalidateQueries({ queryKey: ['quiz', quizId] });
    },
    onError,
  });
}
