import * as program from 'commander';
import writeJsonFile from '@hollowverse/common/helpers/writeJsonFile';
import { scrapePage } from './lib/scrape';
import { URL } from 'url';

program
  .version('1.0')
  .option(
    '-p --path <path>',
    'The path of the URL to scrape without the leading slash, e.g. tom-hanks',
  )
  .output(
    '-o --output [output]',
    'If specificed, the output data will be written to the specified path, ' +
      'otherwise, output is written to stdout',
  )
  .parse(process.argv);

scrapePage({
  url: new URL(program.path, 'https://static.hollowverse.com').toString(),
})
  .then(output => JSON.stringify(output.data))
  .then(async json => {
    if (program.output) {
      await writeJsonFile(program.output, json);
    } else {
      process.stdout.write(json);
    }
    process.exit(0);
  })
  .catch(e => {
    process.stderr.write(`Failed to scrape webpage ${e.message || e}\n`);
    process.exit(1);
  });
