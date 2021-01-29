import createNodeHelpers from 'gatsby-node-helpers';
import { forEach, forEachSeries, map } from 'p-iteration';
import { createRemoteFileNode } from 'gatsby-source-filesystem';

import {
  TYPE_PREFIX,
  ARTICLE,
  BLOG,
  CHANNEL_ENTRY,
  CHANNEL,
  COLLECTION,
  MENU,
  PAGE,
  PRODUCT,
  TRANSLATION,
  PRODUCT_VARIANT,
} from './constants';

import { mapNodeType } from './api';

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
    console.log(fileNodeID);
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

const processFields = async (node, imageArgs) => {
  return forEach(Object.keys(node), async (key) => {
    if (node[key] && node[key]['__type']) {
      let className, nodeType;
      // special field, process reference, file or gallery field
      switch (node[key]['__type']) {
        case 'Reference':
          className = node[key].className;
          nodeType = mapNodeType(className);

          node[`${key}___NODE`] = generateNodeId(nodeType, node[key].id);
          delete node[key];

          break;
        case 'Relation':
          className = node[key].className;
          nodeType = mapNodeType(className);

          node[`${key}___NODE`] = node[key].objects.map((o) => generateNodeId(nodeType, o.id));
          delete node[key];

          break;
        case 'File':
          if (node[key].url) {
            node[key].localFile___NODE = await downloadImageAndCreateFileNode(node[key], imageArgs);
          }
          break;
        case 'Gallery':
          // node[key] = await map(
          //   node[key].images,
          //   async (image) => await downloadImageAndCreateFileNode(image, imageArgs)
          // );
          break;
      }
    }
  });
};

const processPageItems = async (node, imageArgs) => {
  // loop through the page items / repeatable items
  return forEach(Object.keys(node.items), async (key) => {
    const item = node.items[key];
    const itemType = item.type;
    if (itemType === 'canvas') {
      // loop over each repeatable in the canvas
      if (item.repeatables != null && item.repeatables.length > 0) {
        await forEach(item.repeatables, (repeatable) => processPageItems(repeatable, imageArgs));
      }
    } else {
      // this is a regular page item
      if (itemType === 'file' && item.file != null && item.file.url != null) {
        item.file.localFile___NODE = await downloadImageAndCreateFileNode(item.file, imageArgs);
      } else if (itemType === 'reference') {
        // this is a reference
        if (item.reference_id != null) {
          // this is a single reference
          const className = item.reference_type;
          const nodeType = mapNodeType(className);

          node.items[`${key}___NODE`] = generateNodeId(nodeType, item.reference_id);
          delete node.items[key];
        } else if (item.reference_ids != null) {
          // this is a multi reference
          const className = item.reference_type;
          const nodeType = mapNodeType(className);

          node.items[`${key}___NODE`] = item.reference_ids.map((id) =>
            generateNodeId(nodeType, id)
          );
          delete node.items[key];
        }
      }
    }
  });
};

export const PageNode = (imageArgs) =>
  createNodeFactory(PAGE, async (node) => {
    await processPageItems(node, imageArgs);
    return node;
  });

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
export const MenuNode = () => createNodeFactory(MENU);
export const TranslationNode = () => createNodeFactory(TRANSLATION);

export const ProductNode = (imageArgs) =>
  createNodeFactory(PRODUCT, async (node) => {
    if (node.variants) {
      if (!node.variants___NODE) {
        node.variants___NODE = [];
      }
      node.variants.forEach((v) =>
        node.variants___NODE.push(generateNodeId(PRODUCT_VARIANT, v.id))
      );

      delete node.variants;
    }

    if (node.collections) {
      if (!node.collections___NODE) {
        node.collections___NODE = [];
      }
      node.collections.forEach((c) =>
        node.collections___NODE.push(generateNodeId(COLLECTION, c.id))
      );

      delete node.collections;
    }

    await processFields(node, imageArgs);

    return node;
  });

export const ProductVariantNode = (_imageArgs, productNode) =>
  createNodeFactory(PRODUCT_VARIANT, async (node) => {
    node.product___NODE = productNode.id;
    return node;
  });

export const CollectionNode = (imageArgs) =>
  createNodeFactory(COLLECTION, async (node) => {
    if (node.products) {
      if (!node.products___NODE) {
        node.products___NODE = [];
      }

      node.products.forEach((p) => node.products___NODE.push(generateNodeId(PRODUCT_VARIANT, p)));

      delete node.products;
    }

    await processFields(node, imageArgs);

    return node;
  });

export const ChannelNode = () =>
  createNodeFactory(CHANNEL, async (node) => {
    if (node.entries) {
      if (!node.entries___NODE) {
        node.entries___NODE = [];
      }
      node.entries.forEach((e) =>
        node.entries___NODE.push(generateNodeId(mapNodeType(node.slug), e))
      );

      delete node.entries;
    }
    return node;
  });

export const ChannelEntryNode = (className) => (imageArgs) =>
  createNodeFactory(mapNodeType(className), async (node) => {
    if (node.channel) {
      node.channel___NODE = generateNodeId(CHANNEL, node.channel.id);

      delete node.channel;
    }

    await processFields(node, imageArgs);

    return node;
  });
