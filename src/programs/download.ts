#! /usr/bin/env node
import * as program from 'commander';
import * as path from 'path';
import fetch from 'node-fetch';
import * as ProgressBar from 'progress';
import { processBatch } from '../lib/processBatch';
import { readDir, readJsonFile, writeFile } from '../lib/helpers';
import { URL } from 'url';

// tslint:disable no-console

const defaults = {
  base: 'https://static.hollowverse.com',
  concurrency: 3,
};

type Path = {
  post_name: string;
};

program
  .description(
    'Download pages of the website, reading URL paths from a JSON file',
  )
  .option(
    '-i --input <input>',
    'The path to the JSON file containing an array of URL paths to download',
  )
  .option(
    '-o --output <output>',
    'The path to the folder where the downloaded HTML files should be saved.',
  )
  .option(
    '-b --base [base]',
    `The website domain name to download from. Defaults to ${defaults.base}`,
  )
  .option('-d --dry', 'Dry run (do not write files to disk).')
  .option(
    '-f --force',
    'Re-download and overwrite files that already exist in the output folder.',
  )
  .option(
    '-c --concurrency [concurrency]',
    'The maximum number of pages that should be downloaded at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

async function main({
  input,
  output,
  force,
  dry,
  base = defaults.base,
  concurrency = defaults.concurrency,
}: Record<string, any>) {
  const postNames = await readJsonFile<Path[]>(input);
  let scheduledPaths = postNames.map(p => p.post_name);
  console.log(`${scheduledPaths.length} posts found.`);

  if (!force) {
    let alreadyDownloaded: Set<string>;
    try {
      alreadyDownloaded = new Set(await readDir(output));
    } catch (e) {
      alreadyDownloaded = new Set();
    }

    const filteredScheduledPaths = scheduledPaths.filter(
      postName => !alreadyDownloaded.has(`${postName}.html`),
    );

    const diff = scheduledPaths.length - filteredScheduledPaths.length;

    if (diff > 0) {
      scheduledPaths = filteredScheduledPaths;
      console.log(`Skipping download of ${diff} pages (already downloaded).`);
      console.log('Pass --force to force downloading of those pages.');
    }
  }

  const progressBar = new ProgressBar(':bar [:percent] :path', {
    width: 25,
    total: scheduledPaths.length,
  });

  await processBatch({
    tasks: scheduledPaths.map(p => String(new URL(p, base))),
    processTask: async url => (await fetch(url)).text(),
    concurrency: Number(concurrency),
    async onTaskCompleted(html, url, i) {
      if (!dry) {
        await writeFile(path.join(output, `${scheduledPaths[i]}.html`), html);
      }
      progressBar.tick({ path: url });
    },
  });

  console.log(
    dry
      ? `${scheduledPaths.length} URLs downloaded.`
      : `${scheduledPaths.length} URLs downloaded and written to disk.`,
  );
}

main(program).catch(error => {
  console.error(`Failed to download some pages: ${error.message}`);
  process.exit(1);
});
