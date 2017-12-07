import * as got from 'got';
import { WIKIPEDIA_API_ENDPOINT } from './constants';
import { MetadataKey } from './types';

type GetFileMetadataOptions = {
  filename: string;
  thumbnailHeight?: number;
};

export async function getFileMetadata({
  filename,
  thumbnailHeight = 300,
}: GetFileMetadataOptions) {
  const response = await got(WIKIPEDIA_API_ENDPOINT, {
    json: true,
    query: {
      action: 'query',
      titles: `File:${filename}`,
      prop: 'imageinfo',
      iiprop: ['caonicaltitle', 'url', 'extmetadata'].join('|'),
      iiurlheight: thumbnailHeight,
      format: 'json',
    },
  });

  const body = response.body as {
    query: {
      pages: {
        [pageId: number]: {
          title: string;
          imageinfo: [
            {
              canonicaltitle: string;
              thumburl: string;
              thumbwidth: number;
              thumbheight: number;
              url: string;
              descriptionurl: string;
              descriptionshorturl: string;
              extmetadata: Partial<
                Record<MetadataKey, { source: string; value: string }>
              >;
            }
          ];
        };
      };
    };
  };

  const pages = Object.values(body.query.pages);

  return pages[0].imageinfo[0];
}
