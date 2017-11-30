import * as fs from 'fs';
import * as got from 'got';
import { promisify } from 'util';
import * as _glob from 'glob';

export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);
export const readDir = promisify(fs.readdir);

export const glob = async (pattern: string, options: _glob.IOptions = {}) => {
  return new Promise<string[]>((resolve, reject) => {
    _glob(pattern, options, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

export const readJsonFile = async <T = any>(file: string) =>
  readFile(file, 'utf8').then(JSON.parse) as Promise<T>;

export function replaceSmartQuotes(str: string) {
  // prettier-ignore
  return str.replace(/[‘’]/g, '\'').replace(/[“”]/g, '"');
}

export async function fetchPageAsHtml(url: string) {
  const response = await got(url, {
    headers: {
      Accept: 'text/html',
    },
  });

  return response.body;
}
