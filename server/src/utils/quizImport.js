import mongoose from 'mongoose';
import { QUESTION_TYPES } from '../models/Quiz.js';
import { cleanText } from './quizSanitize.js';

/**
 * Bulk question import from the organizer's file. Formats (the wizard offers both templates):
 *
 * CSV, one question per row, header row required:
 *   type,question,option1,option2,option3,option4,option5,option6,correct,marks,negative_marks,explanation,image,time_limit_sec,tolerance
 *   - type: single | multiple | truefalse | short
 *   - correct: option number(s) for single/multiple ("2", or "1;3"), True/False for truefalse,
 *     accepted answer(s) for short ("aspirin|acetylsalicylic acid", or a number like "7.4")
 *
 * JSON: an array of { type, question (or text), options: [..], correct, marks, negativeMarks,
 *   explanation, image, timeLimitSec, tolerance } with `correct` as above (numbers or strings).
 *
 * Returns { questions, errors } - rows with problems are skipped and reported by row number.
 */
const newId = () => new mongoose.Types.ObjectId().toString();

/** RFC-4180-ish CSV: commas, quoted fields with "" escapes and line breaks inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text).replace(/^\uFEFF/, ''); // Excel's byte-order mark
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const num = (v, fallback) => {
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
};

/** One raw question (from either format) -> the stored shape, or an error message. */
function buildQuestion(raw) {
  const type = String(raw.type ?? '').trim().toLowerCase().replace(/[\s_-]/g, '');
  const t = { single: 'single', mcq: 'single', multiple: 'multiple', multi: 'multiple', truefalse: 'truefalse', tf: 'truefalse', short: 'short', numerical: 'short', numeric: 'short' }[type];
  if (!t || !QUESTION_TYPES.includes(t)) return { error: `unknown type "${raw.type ?? ''}" (use single, multiple, truefalse or short)` };
  const text = cleanText(raw.question ?? raw.text, 4000);
  if (!text) return { error: 'the question text is empty' };
  const marks = num(raw.marks, 1);
  if (!(marks > 0) || marks > 100) return { error: 'marks must be a number above 0' };
  const negativeMarks = num(raw.negativeMarks ?? raw.negative_marks, 0);
  if (!(negativeMarks >= 0)) return { error: 'negative marks must be 0 or more' };
  const timeLimitSec = Math.round(num(raw.timeLimitSec ?? raw.time_limit_sec, 0));
  if (!(timeLimitSec >= 0)) return { error: 'time limit must be seconds (0 for none)' };
  const image = cleanText(raw.image, 1000);
  if (image && !/^https?:\/\//i.test(image)) return { error: 'the image must be a web link (https://…)' };
  const q = { _id: newId(), type: t, text, image, marks, negativeMarks, explanation: cleanText(raw.explanation, 4000), timeLimitSec, options: [], correctAnswers: [], numericTolerance: 0 };

  const correctRaw = Array.isArray(raw.correct) ? raw.correct.map(String) : String(raw.correct ?? '').split(/[;|]/).map((x) => x.trim());
  const correct = correctRaw.filter((x) => x !== '');

  if (t === 'short') {
    q.correctAnswers = (Array.isArray(raw.correct) ? raw.correct.map(String) : String(raw.correct ?? '').split('|')).map((x) => cleanText(x, 200)).filter(Boolean);
    if (!q.correctAnswers.length) return { error: 'add at least one accepted answer in "correct"' };
    q.numericTolerance = num(raw.tolerance, 0);
    if (!(q.numericTolerance >= 0)) return { error: 'tolerance must be 0 or more' };
    return { question: q };
  }

  if (t === 'truefalse') {
    q.options = [{ _id: newId(), text: 'True' }, { _id: newId(), text: 'False' }];
    const c = (correct[0] ?? '').toLowerCase();
    const idx = c === 'true' || c === 't' || c === '1' ? 0 : c === 'false' || c === 'f' || c === '2' ? 1 : -1;
    if (idx < 0) return { error: 'for true/false, "correct" must be True or False' };
    q.correctAnswers = [q.options[idx]._id];
    return { question: q };
  }

  const optionTexts = (raw.options ?? []).map((o) => cleanText(o, 500)).filter(Boolean);
  if (optionTexts.length < 2) return { error: 'needs at least 2 options' };
  if (optionTexts.length > 6) return { error: 'at most 6 options' };
  q.options = optionTexts.map((text) => ({ _id: newId(), text }));
  const picks = [...new Set(correct.map((x) => Number(x)))];
  if (!picks.length || picks.some((n) => !Number.isInteger(n) || n < 1 || n > q.options.length)) {
    return { error: `"correct" must be option number(s) between 1 and ${q.options.length}` };
  }
  if (t === 'single' && picks.length !== 1) return { error: 'a single-answer question needs exactly one correct option' };
  q.correctAnswers = picks.map((n) => q.options[n - 1]._id);
  return { question: q };
}

export function importQuestions(format, content) {
  const questions = [];
  const errors = [];
  let raws;
  if (format === 'json') {
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      return { questions, errors: ['The file is not valid JSON.'] };
    }
    raws = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
    if (!raws) return { questions, errors: ['The JSON must be a list of questions.'] };
  } else {
    const rows = parseCsv(content);
    if (rows.length < 2) return { questions, errors: ['The CSV needs a header row and at least one question.'] };
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name) => head.indexOf(name);
    if (col('type') < 0 || col('question') < 0 || col('correct') < 0) {
      return { questions, errors: ['The header row must include type, question and correct (download the template).'] };
    }
    raws = rows.slice(1).map((r) => {
      const get = (name) => (col(name) >= 0 ? r[col(name)] : undefined);
      return {
        type: get('type'),
        question: get('question'),
        options: [1, 2, 3, 4, 5, 6].map((i) => get(`option${i}`)).filter((x) => x !== undefined && String(x).trim() !== ''),
        correct: get('correct'),
        marks: get('marks'),
        negative_marks: get('negative_marks'),
        explanation: get('explanation'),
        image: get('image'),
        time_limit_sec: get('time_limit_sec'),
        tolerance: get('tolerance'),
      };
    });
  }
  raws.slice(0, 300).forEach((raw, i) => {
    const r = buildQuestion(raw ?? {});
    // row numbers as people see them in a spreadsheet (header is row 1)
    if (r.error) errors.push(`${format === 'csv' ? `Row ${i + 2}` : `Question ${i + 1}`}: ${r.error}`);
    else questions.push(r.question);
  });
  if (raws.length > 300) errors.push('Only the first 300 questions were read.');
  return { questions, errors };
}
