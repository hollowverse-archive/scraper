import * as fs from 'fs';
import { promisify } from 'util';
import * as _glob from 'glob';

export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);
export const readDir = promisify(fs.readdir);
export const removeFile = async (path: string) =>
  new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

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

export function getImageFilename(slug: string, thumbUrl: string) {
  const ext = thumbUrl.match(/\.[a-z]{3,4}$/gi);
  let filename = slug;
  if (ext && ext[0]) {
    filename += ext[0].toLowerCase();
  }

  return filename;
}
