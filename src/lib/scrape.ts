import * as cheerio from 'cheerio';
import { URL } from 'url';
import { replaceSmartQuotes } from './helpers';
import { findLastIndex } from 'lodash';
import { format, parse } from 'date-fns';
import { isURL } from 'validator';

type Piece = {
  type: 'text' | 'quote' | 'heading' | 'link' | 'emphasis';
  kind: undefined;
  text: string;
  sourceUrl?: string;
  sourceTitle?: string;
};

type StubResult = {
  name: string;
  tags: string[];
  relatedPeople: Array<{
    slug: string;
    name: string;
  }>;
};

type Open = {
  type: 'open';
  kind: 'paragraph' | 'quote' | 'heading';
  text: undefined;
  sourceUrl: undefined;
  sourceTitle: undefined;
};

type Close = {
  type: 'close';
  kind: 'paragraph' | 'quote' | 'heading';
  text: undefined;
  sourceUrl: undefined;
  sourceTitle: undefined;
};

export function isPiece(obj: Open | Close | Piece): obj is Piece {
  return obj.type !== 'open' && obj.type !== 'close';
}

type CompleteResult = {
  name: string;
  tags: string[];
  relatedPeople: Array<{
    slug: string;
    name: string;
  }>;
  author: string;
  lastUpdatedOn?: string;
  religion?: string;
  politicalViews?: string;
  content: Array<Piece | Open | Close>;
};

export type Result = CompleteResult | StubResult;

const urlValidationOptions = {
  require_protocol: true,
  require_host: true,
  require_valid_protocol: true,
  allow_underscores: true,
  protocols: ['https', 'http'],
};

export function isResultWithContent(
  result: CompleteResult | StubResult,
): result is CompleteResult {
  return (
    (result as CompleteResult).author !== undefined &&
    Array.isArray((result as CompleteResult).content)
  );
}

function isBlockElement(tagName: string) {
  return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'p', 'blockquote'].includes(tagName);
}

function getKind(tagName: string) {
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
    return 'heading';
  } else if (tagName === 'blockquote') {
    return 'quote';
  }

  return 'paragraph';
}

function getPieces($: CheerioStatic, e: CheerioElement) {
  const content: Array<Piece | Open | Close> = [];
  const isBlock = isBlockElement(e.tagName);
  const kind = getKind(e.tagName);

  if (isBlock) {
    content.push({
      type: 'open',
      kind,
      text: undefined,
      sourceTitle: undefined,
      sourceUrl: undefined,
    });
  }

  e.childNodes.forEach((node) => {
    const $node = $(node);
    const lastTextNodeIndex = findLastIndex(content, { type: 'text' });
    const lastTextNode = lastTextNodeIndex !== -1 ? content[lastTextNodeIndex] : undefined;

    if (node.type === 'tag' && node.tagName === 'sup') {
      try {
        const id = $node.find('a').attr('href');
        const $a = $.root().find(id).find('a:first-of-type');
        const href = $a.attr('href').trim();
        if (isURL(href, urlValidationOptions) && lastTextNode && isPiece(lastTextNode)) {
          lastTextNode.sourceUrl = href;
          lastTextNode.sourceTitle = $a.text() || undefined;
        }
      } catch (e) {
        // Reference is not formatted correctly, do nothing
      }
    } else if (node.tagName === 'a') {
      content.push({
        type: 'link',
        text: $(node).text(),
        sourceUrl: $(node).attr('href'),
      });
    } else if (['em', 'b', 'i'].includes(node.tagName)) {
      content.push({
        type: 'emphasis',
        text: $(node).text(),
      });
    } else if (node.type === 'tag' && node.childNodes.length > 0) {
      content.push(...getPieces($, node));
    } else {
      const text = node.type === 'text' ? node.nodeValue : $(node).text();
      if (lastTextNode && lastTextNodeIndex === content.length - 1 && isPiece(lastTextNode)) {
        lastTextNode.text += text;
      } else {
        content.push({
          type: 'text',
          text,
        });
      }
      
      return;
    }

    content.push({ type: 'text', text: '' });
  });

  if (isBlock) {
    content.push({ type: 'close', kind });
  }

  return (
    content
      // tslint:disable-next-line:no-shadowed-variable
      .map(result => {
        if (isPiece(result)) {
          const { sourceTitle, sourceUrl, text, ...rest } = result;

          return {
            ...rest,
            sourceUrl,
            sourceTitle:
              sourceTitle !== undefined
              ? replaceSmartQuotes(sourceTitle)
              : undefined,
            text: replaceSmartQuotes(text.trim()),
          };
        }

        return result;
      })
      .filter(v => !isPiece(v) || Boolean(v.text))
  );
}

const STUB_TEXT =
  'Share what you know about the religion and political views of ';

// tslint:disable-next-line:max-func-body-length
export async function scrapeHtml(html: string): Promise<Result> {
  const $ = cheerio.load(html);

  const name = $.root()
    .find('.header-image h1')
    .text()
    .replace('The religion and political views of', '')
    .trim();

  const tags = $.root()
    .find('article')
    .attr('class')
    .split(' ')
    .filter(c => c.startsWith('tag-'))
    .map(c => c.replace('tag-', ''));

  const author = $.root()
    .find('.thv-posted-on > p > a:first-of-type')
    .text()
    .trim();

  const match = $.root()
    .find('.thv-posted-on > p')
    .text()
    .match(/last updated on (.+)\.\s.+$/i);

  let lastUpdatedOn: string | undefined;
  if (match && match[1]) {
    lastUpdatedOn = format(parse(match[1].split('.')[0]), 'YYYY-MM-DD');
  }

  const relatedPeople: CompleteResult['relatedPeople'] = [];

  $.root()
    .find('#similar-posts a')
    .each((_, a) => {
      const $a = $(a);
      relatedPeople.push({
        slug: new URL($a.attr('href')).pathname.replace(/[\/\\]/gi, ''),
        name: $a.find('h1').text(),
      });
    });

  const $entryContent = $.root().find('.entry-content');

  if (
    $entryContent
      .find('> p:first-of-type')
      .text()
      .startsWith(STUB_TEXT)
  ) {
    // Post is a stub, it has no actual content
    return {
      name,
      relatedPeople,
      tags,
    };
  }

  const religion =
    $.root()
      .find('.hollowverse-summary h2:nth-of-type(1)')
      .next('p')
      .text()
      .trim() || undefined;

  const politicalViews =
    $.root()
      .find('.hollowverse-summary h2:nth-of-type(2)')
      .next('p')
      .text()
      .trim() || undefined;

  $.root()
    .find('#ingrown-sidebar')
    .remove();

  const content: CompleteResult['content'] = [];

  $entryContent.find('> p, > h2, > h3, > h4, > h5, > h6, > blockquote').each((_, e) => {
    content.push(...getPieces($, e));
  });

  return {
    name,
    tags,
    relatedPeople,
    lastUpdatedOn,
    religion,
    politicalViews,
    author,
    content,
  };
}
