#! /usr/bin/env node

import { downloadPages } from '../lib/downloadPages';
import { readDir, readFile } from '../lib/helpers';

import * as path from 'path';

const distDirectory = path.resolve(process.cwd(), 'downloaded');
const postNamesFile = path.resolve(process.cwd(), 'fixtures', 'postNames.json');

type PostNamesExport = Array<{
  post_name: string;
}>;

// tslint:disable:no-console
async function main() {
  const postNames: PostNamesExport = await readFile(postNamesFile, 'utf8').then(
    JSON.parse,
  );
  const alreadyDownloaded = new Set(await readDir(distDirectory));
  const scheduledPaths = postNames
    .map(p => p.post_name)
    .filter(postName => !alreadyDownloaded.has(`${postName}.html`));

  console.log(
    `${scheduledPaths.length} scheduled for download. ${alreadyDownloaded.size} already downloaded`,
  );

  return downloadPages({ distDirectory, paths: scheduledPaths });
}

main()
  .then(p => {
    console.log(`${p.length} downloaded.`);
  })
  .catch(error => {
    console.error('Error downloading pages', error);

    process.exit(1);
  });
