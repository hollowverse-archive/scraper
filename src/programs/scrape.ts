#! /usr/bin/env node
import * as program from 'commander';
import * as ProgressBar from 'progress';
import * as path from 'path';
import { scrapeHtml, Result } from '../lib/scrape';
import {
  readDir,
  glob,
  writeFile,
  removeFile,
  readFile,
  readJsonFile,
} from '../lib/helpers';
import { getWikipediaInfo, WikipediaData } from '../lib/getWikipediaInfo';
import { isEmpty } from 'lodash';
import { processBatch } from '../lib/processBatch';

// tslint:disable no-console

const defaults = {
  concurrency: 3,
  pattern: '*.html',
};

program
  .description('Scrape downloaded website pages')
  .option(
    '-p --pattern [pattern]',
    `A glob pattern of HTML files to scrape, must be wrapped in single quotes. Defaults to '${
      defaults.pattern
    }'`,
  )
  .option(
    '-i --input <input>',
    'The path to the directory containing the downloaded HTML files',
  )
  .option(
    '--no-wikipedia',
    'Do not add corresponding Wikipedia page URL to results',
  )
  .option(
    '--reuse',
    'Reuse existing Wikipedia data if --no-wikipedia is passed',
  )
  .option(
    '--overrides [overrides]',
    'Path to a JSON file that lists the URLs to the actual Wikipedia pages' +
      'that should replace the disambiguation page URLs returned from the Wikipedia API, ' +
      'has no effect if --no-wikipedia is used',
  )
  .option(
    '--image-overrides [image-overrides]',
    'Path to a JSON file that lists the filenames on Wikipedia' +
      'that should be used instead of attempting to find an image using Wikipedia API, ' +
      'has no effect if --no-wikipedia is used',
  )
  .option(
    '--no-remove',
    'Do not remove people not found on Wikipedia (has no effect with --dry, conflicts with --no-wikipedia)',
  )
  .option(
    '-o --output <output>',
    'The path where to scraping results should be saved',
  )
  .option(
    '-f --force',
    'Re-scrape and overwrite files that already exist in the output folder',
  )
  .option('-d --dry', 'Dry run (do not write files to disk)')
  .option(
    '-c --concurrency [concurrency]',
    'The maximum number of pages that should be scraped at the same time. ' +
      `Defaults to ${defaults.concurrency}`,
  );

program.parse(process.argv);

export type ResultWithWikipediaData = Result & {
  wikipediaData?: Partial<WikipediaData>;
};

// tslint:disable-next-line:max-func-body-length
async function main({
  pattern = defaults.pattern,
  input,
  output,
  force,
  wikipedia,
  overrides,
  imageOverrides,
  remove,
  reuse,
  dry,
  concurrency = defaults.concurrency,
}: Record<string, any>) {
  const files = await glob(pattern, { cwd: input, matchBase: false });
  let scheduledFiles = files;

  if (!force) {
    let alreadyScraped: Set<string>;
    try {
      alreadyScraped = new Set(await readDir(output));
    } catch (e) {
      alreadyScraped = new Set();
    }

    const filteredScheduledFiles = scheduledFiles.filter(
      file => !alreadyScraped.has(file.replace(/\.html?$/, '.json')),
    );

    const diff = scheduledFiles.length - filteredScheduledFiles.length;

    if (diff > 0) {
      scheduledFiles = filteredScheduledFiles;
      console.log(`Skipping scraping of ${diff} (already scraped).`);
      console.log('Pass --force to force scraping of those pages.');
    }
  }

  let overridesMap: Record<string, string | null | undefined> = {};
  if (wikipedia && overrides) {
    overridesMap = await readJsonFile<typeof overridesMap>(overrides);
  }

  let imageOverridesMap: Record<string, string | null | undefined> = {};
  if (wikipedia && imageOverrides) {
    imageOverridesMap = await readJsonFile<typeof imageOverridesMap>(
      imageOverrides,
    );
  }

  const progressBar = new ProgressBar(':bar [:percent] :page', {
    width: 25,
    total: scheduledFiles.length,
  });

  type ScrapeTask = {
    filePath: string;
    postName: string;
  };

  const results = await processBatch<ScrapeTask, ResultWithWikipediaData>({
    tasks: scheduledFiles.map(file => ({
      filePath: path.join(input, file),
      postName: path.basename(file).replace(/\.html?$/, ''),
    })),
    concurrency: Number(concurrency),
    processTask: async ({ filePath, postName }) => {
      const html = await readFile(filePath, 'utf8');

      let result;
      result = await scrapeHtml(html);
      const pageUrlOverride = overridesMap[postName];
      const pageImageOverride = imageOverridesMap[postName];
      if (wikipedia && pageUrlOverride !== null) {
        const wikipediaData = await getWikipediaInfo({
          result,
          pageUrlOverride,
          pageImageOverride,
        });

        result = {
          ...result,
          wikipediaData,
        };
      }

      return result;
    },
    async onTaskCompleted(result, { postName, filePath }) {
      const outputFile = path.join(output, `${postName}.json`);
      if (!dry) {
        if (wikipedia && remove && isEmpty(result.wikipediaData)) {
          await removeFile(outputFile).catch(() => null);
        } else {
          if (reuse) {
            try {
              const { wikipediaData } = await readJsonFile<
                ResultWithWikipediaData
              >(outputFile);
              result.wikipediaData = wikipediaData;
            } catch {
              // Do nothing
            }
          }

          await writeFile(outputFile, JSON.stringify(result, undefined, 2));
        }
      }
      progressBar.tick({ page: filePath });
    },
  });

  console.log(
    dry
      ? `${scheduledFiles.length} scraped.`
      : `${scheduledFiles.length} scraped and written to disk.`,
  );

  const missingData = results.filter(result => {
    if (result.wikipediaData !== undefined) {
      return isEmpty(result.wikipediaData);
    }

    return false;
  });

  if (missingData.length) {
    console.log(
      `Could not find matching Wikipedia pages for ${
        missingData.length
      } people:`,
    );

    missingData.forEach(({ name }) => {
      console.log(`  * ${name}`);
    });

    if (!dry && remove) {
      console.log('Those files were removed.');
    }
  }

  const missingImages = results.filter(result => {
    if (result.wikipediaData !== undefined) {
      return (
        !isEmpty(result.wikipediaData) &&
        result.wikipediaData.isDisambiguation === false &&
        result.wikipediaData.image === undefined
      );
    }

    return false;
  });

  if (missingImages.length) {
    console.log(
      `The following ${missingImages.length} people were found on Wikipedia, ` +
        'but without matching thumbnail images:',
    );

    missingImages.forEach(({ name }) => {
      console.log(`  * ${name}`);
    });
  }

  const areDisambiguationPages = results.filter(result => {
    if (result.wikipediaData !== undefined) {
      return (
        !isEmpty(result.wikipediaData) &&
        result.wikipediaData.isDisambiguation === true
      );
    }

    return false;
  });

  if (areDisambiguationPages.length) {
    console.log(
      'Wikipedia returned disambiguation pages for ' +
        `the following ${areDisambiguationPages.length} people:`,
    );

    areDisambiguationPages.forEach(result => {
      if (result.wikipediaData !== undefined) {
        console.log(`  * ${result.name} (${result.wikipediaData.url})`);
      }
    });
  }
}

main(program).catch(error => {
  console.error(`Failed to scrape some pages: ${error.message}`);
  process.exit(1);
});
