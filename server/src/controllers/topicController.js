import { TOPIC_GROUPS } from '../data/topicLibrary.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

/** "Antimicrobial resistance" -> "antimicrobial-resistance" */
export const slugify = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const BY_SLUG = new Map();
for (const { group, topics } of TOPIC_GROUPS) {
  for (const topic of topics) BY_SLUG.set(slugify(topic.label), { ...topic, group, slug: slugify(topic.label) });
}

/** The grouped topic list for Discovery. */
export const listTopics = (_req, res) => {
  res.json({
    groups: TOPIC_GROUPS.map(({ group, topics }) => ({
      group,
      topics: topics.map((t) => ({ slug: slugify(t.label), label: t.label })),
    })),
  });
};

/** One topic: Tectum's written notes plus links to WHO and PubMed. */
export const getTopic = asyncHandler(async (req, res) => {
  const topic = BY_SLUG.get(req.params.slug);
  if (!topic) throw ApiError.notFound('Topic not found');

  res.json({
    topic: {
      slug: topic.slug,
      label: topic.label,
      group: topic.group,
      summary: topic.summary,
      points: topic.points,
      why: topic.why,
      links: {
        who: `https://www.who.int/search?query=${encodeURIComponent(topic.label)}`,
        pubmed: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(topic.label)}`,
      },
    },
  });
});
