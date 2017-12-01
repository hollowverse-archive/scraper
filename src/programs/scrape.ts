#! /usr/bin/env node
import * as program from 'commander';
import * as ProgressBar from 'progress';
import * as path from 'path';
import { scrapeBatch } from '../lib/scrapeBatch';
import { readDir, glob, writeFile, hasKey } from '../lib/helpers';
import { getWikipediaInfo } from '../lib/getWikipediaInfo';
import { isEmpty } from 'lodash';

// tslint:disable no-console

const defaults = {
  concurrency: 3,
};

program
  .description('Scrape downloaded website pages')
  .option(
    '-p --pattern <pattern>',
    'A glob pattern of HTML files to scrape, must be wrapped in single quotes',
  )
  .option(
    '-r --root <root>',
    'The directory containing the downloaded HTML files',
  )
  .option(
    '--no-wikipedia',
    'Do not add corresponding Wikipedia page URL to results',
  )
  .option(
    '-o --output <output>',
    'The path where to scraping results should be saved',
  )
  .option(
    '-f --force',
    'Re-scrape and overwrite files that already exist in the output folder.',
  )
  .option('-d --dry', 'Dry run (do not write files to disk).')
  .option(
    '-c --concurrency [concurrency]',
    'The maximum number of pages that should be scraped at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

async function main({
  pattern,
  root,
  output,
  force,
  wikipedia,
  dry,
  concurrency = defaults.concurrency,
}: Record<string, any>) {
  const files = await glob(pattern, { cwd: root, matchBase: false });
  let scheduledFiles = files;

  if (!force) {
    let alreadyScraped: Set<string>;
    try {
      alreadyScraped = new Set(await readDir(output));
    } catch (e) {
      alreadyScraped = new Set();
    }

    scheduledFiles = scheduledFiles.filter(
      file => !alreadyScraped.has(file.replace(/\.html?$/, '.json')),
    );

    console.log(
      `\n${files.length -
        scheduledFiles.length} already scraped and --force was not passed.\n`,
    );
  }

  const progressBar = new ProgressBar(':bar [:percent] :page', {
    width: 25,
    total: scheduledFiles.length,
  });

  const results = await scrapeBatch({
    files: scheduledFiles.map(file => path.join(root, file)),
    concurrency: Number(concurrency),
    async onFileScraped(result, file, _) {
      if (!dry) {
        await writeFile(
          path.join(output, path.basename(file).replace(/\.html?$/, '.json')),
          JSON.stringify(result, undefined, 2),
        );
      }
      progressBar.tick({ page: file });
    },

    async transformResult(result, __) {
      if (wikipedia) {
        const wikipediaData = await getWikipediaInfo(result);

        return {
          ...result,
          wikipediaData,
        };
      }

      return result;
    },
  });

  console.log(
    `${scheduledFiles.length} scraped${!dry ? ' and written to disk' : ''}.`,
  );

  const missingData = results.filter(result => {
    if (hasKey(result, 'wikipediaData')) {
      return isEmpty(result.wikipediaData);
    }

    return false;
  });

  if (missingData.length) {
    console.log(
      `Could not find matching Wikipedia page(s) for ${
        missingData.length
      } page(s):`,
    );

    missingData.forEach(({ name }) => {
      console.log(`* ${name}`);
    });
  }
}

main(program).catch(error => {
  console.error(`Failed to scrape some pages: ${error.message}`);
  process.exit(1);
});
