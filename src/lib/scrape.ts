import * as cheerio from 'cheerio';
import { URL } from 'url';
import { replaceSmartQuotes } from './helpers';
import { findLastIndex } from 'lodash';
import { format, parse } from 'date-fns';
import { isURL } from 'validator';

type Piece = {
  type: 'sentence' | 'quote' | 'heading' | 'link' | 'emphasis';
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

type Break = {
  type: 'break';
};

export function isPiece(obj: Break | Piece): obj is Piece {
  return obj.type !== 'break';
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
  content: Array<Piece | Break>;
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

function scrapeText($: CheerioStatic, e: CheerioElement): Piece[] {
  const pieces: Piece[] = [];

  e.childNodes.forEach((node) => {
    const $node = $(node);
    const lastTextNodeIndex = findLastIndex(pieces, { type: 'sentence' });

    if (node.type === 'tag' && node.tagName === 'sup') {
      try {
        const id = $node.find('a').attr('href');
        const $a = $.root().find(id).find('a:first-of-type');
        const href = $a.attr('href').trim();
        if (isURL(href, urlValidationOptions) && lastTextNodeIndex >= 0) {
          pieces[lastTextNodeIndex].sourceUrl = href;
          pieces[lastTextNodeIndex].sourceTitle = $a.text() || undefined;
        }
      } catch (e) {
        // Reference is not formatted correctly, do nothing
      }
    } else if (node.tagName === 'a') {
      pieces.push({
        type: 'link',
        text: $(node).text(),
        sourceUrl: $(node).attr('href'),
      });
    } else if (['em', 'b', 'i'].includes(node.tagName)) {
      pieces.push({
        type: 'emphasis',
        text: $(node).text(),
      });
    } else {
      const text = node.type === 'text' ? node.nodeValue : $(node).text();
      if (lastTextNodeIndex >= 0) {
        pieces[lastTextNodeIndex].text += text;
      } else {
        pieces.push({
          type: 'sentence',
          text,
        });
      }
      
      return;
    }

    pieces.push({ type: 'sentence', text: '' });
  });

  return (
    pieces
      // tslint:disable-next-line:no-shadowed-variable
      .map(({ sourceTitle, sourceUrl, text, ...rest }) => ({
        sourceUrl,
        sourceTitle:
          sourceTitle !== undefined
            ? replaceSmartQuotes(sourceTitle)
            : undefined,
        text: replaceSmartQuotes(text.trim()),
        ...rest,
      }))
      .filter(v => Boolean(v.text))
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

  $entryContent.find('> p, h2, blockquote').each((_, e) => {
    let type: Piece['type'];
    if (e.tagName === 'blockquote') {
      type = 'quote';
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(e.tagName)) {
      type = 'heading';
    } else {
      type = 'sentence';
    }

    if (type === 'quote') {
      $(e).find('> *').each((__, p) => {
        scrapeText($, p).forEach(v => {
          content.push({ ...v, type });
        });
      });
    } else if (e.tagName === 'p') {
      scrapeText($, e).forEach(v => {
        content.push(v);
      });
      content.push({ type: 'break' });
    } else {
      scrapeText($, e).forEach(v => {
        content.push({ ...v, type });
      });
    }
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
