#! /usr/bin/env node
import * as program from 'commander';
import * as bluebird from 'bluebird';
import * as path from 'path';
import { scrapeHtml } from '../lib/scrape';
import { readDir, readFile, writeFile } from '../lib/helpers';

const defaults = {
  concurrency: 3,
};

program
  .description('Scrape downloaded website pages')
  .option(
    '-p --path <path>',
    'The path to the directory containing the HTML files to scrape',
  )
  .option(
    '-o --output <output>',
    'The path where to scraping results should be saved',
  )
  .option(
    '-f --force',
    'Re-scrape and overwrite files that already exist in the output folder.',
  )
  .option(
    '-c --concurrency',
    'The maximum number of pages that should should be scraped at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

async function main({
  path: srcDirectory,
  output,
  force,
  concurrency = defaults.concurrency,
}: Record<string, any>) {
  const files = await readDir(srcDirectory);
  let scheduledFiles = files;

  if (!force) {
    const alreadyScraped = new Set(await readDir(output));
    scheduledFiles = scheduledFiles.filter(
      file => !alreadyScraped.has(file.replace(/\.html?$/, '.json')),
    );
  }

  return bluebird.map(
    scheduledFiles,
    async file => {
      const html = await readFile(file, 'utf8');
      const result = await scrapeHtml(html);
      const jsonString = JSON.stringify(result, undefined, 0);

      await writeFile(
        path.join(output, file.replace(/\.html?$/, '.json')),
        jsonString,
      );
    },
    { concurrency },
  );
}

main(program).catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
