import * as cheerio from 'cheerio';
import { URL } from 'url';
import { replaceSmartQuotes } from './helpers';
import { findLastIndex } from 'lodash';
import { format, parse } from 'date-fns';
import { isURL } from 'validator';

type Piece = InlinePiece | BlockPiece;

type Text = {
  parentId: number;
  type: 'text';
  text: string;
  sourceUrl?: string;
  sourceTitle?: string;
};

type Emphasis = {
  parentId: number;
  type: 'emphasis';
  text: string;
};

type InlineLink = {
  parentId: number;
  type: 'link';
  text: string;
  sourceUrl: string;
  sourceTitle: string | undefined;
};

type BlockPiece = {
  id: number;
  parentId: number | undefined;
  type: 'paragraph' | 'quote' | 'heading';
};
type InlinePiece = InlineLink | Text | Emphasis;

type StubResult = {
  name: string;
  tags: string[];
  relatedPeople: Array<{
    slug: string;
    name: string;
  }>;
};

export function isBlockPiece(obj: Piece): obj is BlockPiece {
  return 'id' in obj && (obj as BlockPiece).id !== undefined;
}

export function isInlinePiece(obj: Piece): obj is InlinePiece {
  return 'parentId' in obj && (obj as InlinePiece).parentId !== undefined;
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
  content: Piece[];
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

function isBlockTagName(tagName: string) {
  return [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'div',
    'p',
    'blockquote',
  ].includes(tagName);
}

function hasPossibleSource(piece: Piece): piece is InlineLink | Text {
  return (
    (!isBlockPiece(piece) && piece.type === 'text') || piece.type === 'link'
  );
}

function getKind(tagName: string) {
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
    return 'heading';
  } else if (tagName === 'blockquote') {
    return 'quote';
  }

  return 'paragraph';
}

// tslint:disable-next-line:max-func-body-length
function getPieces(
  $: CheerioStatic,
  e: CheerioElement,
  getId: () => number,
  rootId: number | undefined,
) {
  const content: Piece[] = [];
  const isBlock = isBlockTagName(e.tagName);
  const kind = getKind(e.tagName);

  const parentId = getId();
  if (isBlock) {
    const parent: BlockPiece = {
      type: kind,
      id: parentId,
      parentId: rootId,
    };

    content.push(parent);
  }

  e.childNodes.forEach(node => {
    const $node = $(node);
    const lastTextPieceIndex = findLastIndex(content, { type: 'text' });
    const lastTextPiece =
      lastTextPieceIndex !== -1 ? content[lastTextPieceIndex] : undefined;

    if (node.type === 'tag' && node.tagName === 'sup') {
      try {
        const refId = $node.find('a').attr('href');
        const $a = $.root()
          .find(refId)
          .find('a:first-of-type');
        const href = $a.attr('href').trim();
        if (
          isURL(href, urlValidationOptions) &&
          lastTextPiece &&
          hasPossibleSource(lastTextPiece)
        ) {
          lastTextPiece.sourceUrl = href;
          lastTextPiece.sourceTitle = $a.text() || undefined;
        }
      } catch (e) {
        // Reference is not formatted correctly, do nothing
      }
    } else if (node.tagName === 'a') {
      content.push({
        parentId,
        type: 'link',
        text: $(node).text(),
        sourceUrl: $(node).attr('href'),
        sourceTitle: undefined,
      });
    } else if (['em', 'b', 'i'].includes(node.tagName)) {
      content.push({
        parentId,
        type: 'emphasis',
        text: $(node).text(),
      });
    } else if (node.type === 'tag' && node.childNodes.length > 0) {
      content.push(...getPieces($, node, getId, parentId));
    } else {
      const text = node.type === 'text' ? node.nodeValue : $(node).text();
      if (
        lastTextPiece &&
        lastTextPieceIndex === content.length - 1 &&
        isInlinePiece(lastTextPiece)
      ) {
        lastTextPiece.text += text;
      } else {
        content.push({
          parentId,
          type: 'text',
          text,
        });
      }

      return;
    }

    content.push({ type: 'text', text: '', parentId });
  });

  return content
    .map(result => {
      if (isBlockPiece(result)) {
        return result;
      }

      let { text } = result;
      text = replaceSmartQuotes(text.trim());

      if (result.type === 'text') {
        let { sourceTitle } = result;
        const { sourceUrl, ...rest } = result;
        if (sourceTitle) {
          sourceTitle = replaceSmartQuotes(sourceTitle.trim());
        }

        return {
          ...rest,
          sourceUrl,
          sourceTitle,
          text,
        };
      }

      return {
        ...result,
        text,
      };
    })
    .filter(v => isBlockPiece(v) || Boolean(v.text));
}

const createGetId = () => {
  let i = 0;

  return () => {
    i = i + 1;

    return i;
  };
};

const STUB_TEXT =
  'Share what you know about the religion and political views of ';

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

  const getId = createGetId();

  $entryContent
    .find('> p, > h2, > h3, > h4, > h5, > h6, > blockquote')
    .each((_, e) => {
      content.push(...getPieces($, e, getId, undefined));
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
