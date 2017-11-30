#! /usr/bin/env node
import * as program from 'commander';
import * as ProgressBar from 'progress';
import { downloadPages } from '../lib/downloadPages';
import { readDir, readJsonFile } from '../lib/helpers';

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
    '-p --posts <paths>',
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
  .option(
    '-f --force',
    'Re-download and overwrite files that already exist in the output folder.',
  )
  .option(
    '-c --concurrency',
    'The maximum number of pages that should should be downloaded at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

async function main({
  posts,
  output,
  force,
  base = defaults.base,
  concurrency = defaults.concurrency,
}: Record<string, any>) {
  const postNames = await readJsonFile<Path[]>(posts);
  let scheduledPaths = postNames.map(p => p.post_name);
  process.stdout.write(`${scheduledPaths.length} posts found.\n`);

  if (!force) {
    const alreadyDownloaded = new Set(await readDir(output));
    process.stdout.write(`${alreadyDownloaded.size} already downloaded.\n`);
    scheduledPaths = scheduledPaths.filter(
      postName => !alreadyDownloaded.has(`${postName}.html`),
    );
  }

  const progressBar = new ProgressBar(':bar [:percent] :path', {
    width: 25,
    total: scheduledPaths.length,
  });

  const downloadedUrls = await downloadPages({
    distDirectory: output,
    paths: scheduledPaths,
    base,
    concurrency,
    onPageDownloaded(_, next) {
      progressBar.tick({ path: next });
    },
    onFinished() {
      process.stdout.write('\n');
    },
  });

  process.stdout.write(`${downloadedUrls.length} URLs downloaded.\n`);
}

main(program).catch(error => {
  process.stderr.write(`Failed to download some pages. ${error.message}\n`);
  process.exit(1);
});
