#! /usr/bin/env node
import {
  groupBy,
  keyBy,
  mapValues,
  omitBy,
  isEmpty,
  mapKeys,
  find,
} from 'lodash';

type Post = {
  id: number;
  post_name: string;
  post_parent: number;
  post_date_gmt: string;
  term_taxonomy_id: number | null;
};

type Term = {
  term_id: number;
  name: string;
  slug: string;
};

type TermTaxonomyRelationship = {
  term_id: number;
  term_taxonomy_id: number;
};

const progressStatus = [
  'pitch',
  'complete',
  'partial',
  'pending-review',
  'postponed',
  'low-priority',
];

// tslint:disable:no-console
export async function getProgressForPosts(
  posts: Post[],
  terms: Term[],
  termTaxonomies: TermTaxonomyRelationship[],
) {
  const termIdsByTaxonomyId = keyBy(termTaxonomies, t => t.term_taxonomy_id);

  // Group revisions with their parent post
  const postsByParentId = groupBy(posts, p => {
    if (p.post_parent === 0) {
      return p.id;
    }

    return p.post_parent;
  });

  // An object of the shape `{ 202: 'pitch', ...rest }`
  const termIdToTermSlug = mapValues(keyBy(terms, t => t.term_id), t => t.slug);

  const tagsByParentPostName = mapValues(postsByParentId, v =>
    v
      .map(p => ({
        ...p,
        termId:
          p.term_taxonomy_id !== null && termIdsByTaxonomyId[p.term_taxonomy_id]
            ? termIdsByTaxonomyId[p.term_taxonomy_id].term_id
            : undefined,
      }))
      // Assign the term slug (`partial`, `low-priority`) that corresponds to the the term ID above
      .map(({ termId, ...rest }) => ({
        ...rest,
        termId,
        termSlug: termId !== undefined ? termIdToTermSlug[termId] : undefined,
      }))
      // We are only interested in tags that indicate the status of the post (partial, complete...)
      .filter(
        ({ termSlug }) =>
          termSlug !== undefined && progressStatus.includes(termSlug),
      ),
  );

  const postsById = keyBy(posts, p => p.id);

  // Replace object keys, which are post IDs, with the corresponding post names
  return mapKeys(
    omitBy(
      mapValues(tagsByParentPostName, revisions => {
        const revision =
          find(revisions, c => c.post_parent === 0) || revisions[0];

        return revision ? revision.termSlug : undefined;
      }),
      isEmpty,
    ),
    (_, id) => postsById[id].post_name,
  );
}
