#! /usr/bin/env node
import * as program from 'commander';
import { getProgressForPosts } from '../lib/assignStatus';
import { readFile, writeFile } from '../lib/helpers';
import * as bluebird from 'bluebird';

program
  .description(
    'Determines the status of a post, given the required database dump data',
  )
  .option(
    '-p --posts <posts>',
    'The path to the JSON file containing an array of post details, ' +
      'as exported from WordPress database',
  )
  .option(
    '-t --terms <terms>',
    'The path to the JSON file containing an array of term details, ' +
      '(term_id, slug) as exported from WordPress database',
  )
  .option(
    '-x --term-taxonomy <term-taxonomy>',
    'The path to the JSON file containing an array of term taxonomy relationships, ' +
      '(term_id, term_taxonomy_id) as exported from WordPress database',
  )
  .option(
    '-o --output <output>',
    'The path where the results file should be saved, if not specified, outputs to stdout',
  );

program.parse(process.argv);

async function main({
  posts,
  terms,
  termTaxonomy,
  output,
}: Record<string, any>) {
  // tslint:disable:no-shadowed-variable
  return bluebird
    .map([posts, terms, termTaxonomy], async file =>
      readFile(file, 'utf8').then(JSON.parse),
    )
    .then(async ([posts, terms, termTaxonomy]) => {
      return getProgressForPosts(posts, terms, termTaxonomy)
        .then(data => JSON.stringify(data, undefined, 2))
        .then(async string => {
          if (output) {
            return writeFile(output, string);
          } else {
            process.stdout.write(string);
          }
        });
    });
  // tslint:enable:no-shadowed-variable
}

main(program).catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
