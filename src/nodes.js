import createNodeHelpers from 'gatsby-node-helpers';
import { map } from 'p-iteration';
import { createRemoteFileNode } from 'gatsby-source-filesystem';

import { TYPE_PREFIX, ARTICLE, BLOG, PAGE, MENU, TRANSLATION } from './constants';

const { createNodeFactory, generateNodeId } = createNodeHelpers({
  typePrefix: TYPE_PREFIX,
});

const downloadImageAndCreateFileNode = async (
  { url, filename, version },
  { createNode, createNodeId, touchNode, store, cache, getCache, reporter }
) => {
  let fileNodeID;

  const mediaDataCacheKey = `${TYPE_PREFIX}__Media__${url}`;
  const cacheMediaData = await cache.get(mediaDataCacheKey);

  if (cacheMediaData) {
    fileNodeID = cacheMediaData.fileNodeID;
    touchNode({ nodeId: fileNodeID });
    return fileNodeID;
  }

  const fileNode = await createRemoteFileNode({
    url,
    store,
    cache,
    createNode,
    createNodeId,
    getCache,
    parentNodeId: generateNodeId(`${filename}-${version}`),
    reporter,
  });

  if (fileNode) {
    fileNodeID = fileNode.id;
    await cache.set(mediaDataCacheKey, { fileNodeID });
    return fileNodeID;
  }

  return undefined;
};

export const PageNode = createNodeFactory(PAGE);
export const BlogNode = (imageArgs) =>
  createNodeFactory(BLOG, async (node) => {
    if (node.articles) {
      if (!node.articles___NODE) {
        node.articles___NODE = [];
      }
      node.articles.forEach((a) => node.articles___NODE.push(generateNodeId(ARTICLE, a)));

      delete node.articles;
    }

    if (node.header)
      node.header.localFile___NODE = await downloadImageAndCreateFileNode(node.header, imageArgs);

    return node;
  });

export const ArticleNode = (imageArgs) =>
  createNodeFactory(ARTICLE, async (node) => {
    if (node.blog) {
      node.blog___NODE = generateNodeId(BLOG, node.blog.id);
      delete node.blog;
    }

    await map(['header', 'thumbnail', 'og_image'], async (attr) => {
      if (node[attr])
        node[attr].localFile___NODE = await downloadImageAndCreateFileNode(node[attr], imageArgs);
    });

    return node;
  });
export const MenuNode = createNodeFactory(MENU);
export const TranslationNode = createNodeFactory(TRANSLATION);
