import createNodeHelpers from 'gatsby-node-helpers';
import { forEach, map } from 'p-iteration';
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

  console.log('---------DOWNLOAD--------');
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
            console.log('FILE');
            console.log(node[key]);
            node[key].localFile___NODE = await downloadImageAndCreateFileNode(node[key], imageArgs);
            console.log('AFTER');
            console.log(node[key]);
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

const recursiveDownload = async (node, imageArgs) => {
  //FIXME: debugging this forkbomb & testing
  return forEach(Object.keys(node), async (key) => {
    if (node[key] && node[key]['__type']) {
      if (node[key].url) {
        node[key].localFile___NODE = await downloadImageAndCreateFileNode(node[key], imageArgs);
        console.log('FOUND');
        return;
      }
    } else {
      if (typeof node[key] == 'object') {
        recursiveDownload(node[key]);
      }
    }
    /* console.log(key);
    if (node[key] && node[key]['__type']) {
      if (node[key].url) {
        node[key].localFile___NODE = await downloadImageAndCreateFileNode(node[key], imageArgs);
        console.log('FOUND');
      }
    }
    await recursiveDownload(node[key], imageArgs); */
  });
};

export const PageNode = (imageArgs) =>
  createNodeFactory(PAGE, async (node) => {
    // download images
    //const headers = []
    /*
    const headers = node.items.Blokken.repeatables.filter((r) => {
      return r.slug == 'header';
    });
    */
    //console.log('Amount of headers:');
    //console.log(headers.length);
    //const testNode = node.items.Blokken.repeatables;
    //const testNode = node.items.Blokken.repeatables[0].items;
    /*
    const fileNode = node.items.Blokken.repeatables[0].items[`Background Image`];
    console.log(fileNode);
    console.log(fileNode.content);
    if (fileNode.content) {
      fileNode.file.localFile___NODE = await downloadImageAndCreateFileNode(
        fileNode.file,
        imageArgs
      );
      console.log(fileNode);
    }*/
    /*
    console.log('TESTNODE');
    console.log(testNode);
    forEach(Object.keys(testNode), async (key) => {
      console.log(testNode[key]);
      forEach(Object.keys(node[key]), async (k) => {
        console.log(testNode[key][k]);
      });
    }); */
    //await recursiveDownload(node.items.Blokken.repeatables[0], imageArgs);
    // errors
    console.log(node.items);
    // TODO: testing
    // recursiveDownload(node.items.Blokken);
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
      console.log('MAPPING 3');
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
