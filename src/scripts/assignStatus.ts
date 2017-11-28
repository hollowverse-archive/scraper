#! /usr/bin/env node
import { readFile, writeFile } from '../lib/helpers';
import * as bluebird from 'bluebird';
import {
  groupBy,
  keyBy,
  mapValues,
  omitBy,
  isEmpty,
  mapKeys,
  values,
} from 'lodash';

import * as path from 'path';

const tagsFile = path.resolve(process.cwd(), 'fixtures', 'tags.json');
const postNamesFile = path.resolve(
  process.cwd(),
  'fixtures',
  'postsWithChildren.json',
);
const termTaxonomyFile = path.resolve(
  process.cwd(),
  'fixtures',
  'termTaxonomy.json',
);

type PostsWithChildrenExport = Array<{
  id: number;
  post_name: string;
  post_parent: number;
  post_date_gmt: string;
  term_taxonomy_id: number | null;
}>;

type TagsExport = Array<{
  term_id: number;
  name: string;
  slug: string;
}>;

type TermTaxonomyExport = Array<{
  term_id: number;
  term_taxonomy_id: number;
}>;

const progressStatus = [
  'pitch',
  'complete',
  'partial',
  'pending',
  'low-priority',
];

// tslint:disable:no-console
async function getProgressForPost() {
  const [tagsExport, postsExport, taxonomyExport] = (await bluebird.map(
    [tagsFile, postNamesFile, termTaxonomyFile],
    file => readFile(file, 'utf8').then(JSON.parse),
  )) as [TagsExport, PostsWithChildrenExport, TermTaxonomyExport];

  const termIdsByTaxonomyId = keyBy(taxonomyExport, t => t.term_taxonomy_id);

  // Group revisions with their parent post
  const postsByParentId = groupBy(postsExport, p => {
    if (p.post_parent === 0) {
      return p.id;
    }

    return p.post_parent;
  });

  // An object of the shape `{ 202: 'pitch', ...rest }`
  const termIdToTermSlug = mapValues(
    keyBy(tagsExport, t => t.term_id),
    t => t.slug,
  );

  const tagsByParentPostName = mapValues(postsByParentId, v =>
    v
      .map(
        p =>
          p.term_taxonomy_id !== null && termIdsByTaxonomyId[p.term_taxonomy_id]
            ? termIdsByTaxonomyId[p.term_taxonomy_id].term_id
            : undefined,
      )
      // Assign the term slug (`partial`, `low-priority`) that corresponds to the the term ID above
      .map(
        termId => (termId !== undefined ? termIdToTermSlug[termId] : undefined),
      )
      // We are only interested in tags that indicate the status of the post (partial, complete...)
      .filter(
        termSlug => termSlug !== undefined && progressStatus.includes(termSlug),
      ),
  );

  if (values(tagsByParentPostName).some(c => c.length > 1)) {
    throw new Error('Unexpected');
  }

  const postsById = keyBy(postsExport, p => p.id);

  // Replace object keys, which are post IDs, with the corresponding post names
  return mapKeys(
    omitBy(mapValues(tagsByParentPostName, c => c[0]), isEmpty),
    (_, id) => postsById[id].post_name,
  );
}

getProgressForPost()
  .then(data => JSON.stringify(data, undefined, 2))
  .then(async string => {
    console.log('Tags assigned.');

    return writeFile('progress.json', string);
  })
  .catch(error => {
    console.error('Error assigning tags pages', error);

    process.exit(1);
  });
