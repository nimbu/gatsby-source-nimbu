import createNodeHelpers from 'gatsby-node-helpers';
import { forEach, forEachSeries, map } from 'p-iteration';
import { createRemoteFileNode, createFilePath } from 'gatsby-source-filesystem';
import cheerio from 'cheerio';
import URIParser from 'urijs';

import {
  TYPE_PREFIX,
  ARTICLE,
  BLOG,
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
  { url, filename, version, returnNode = false },
  { createNode, createNodeId, touchNode, store, cache, getCache, getNode, reporter, downloadImages }
) => {
  if (!downloadImages) return undefined;

  let fileNodeID;

  const mediaDataCacheKey = `${TYPE_PREFIX}__Media__${url}`;
  const cacheMediaData = await cache.get(mediaDataCacheKey);

  if (cacheMediaData) {
    fileNodeID = cacheMediaData.fileNodeID;
    let fileNode = getNode(fileNodeID);
    touchNode(getNode(fileNodeID));

    if (returnNode) {
      return fileNode;
    } else {
      return fileNodeID;
    }
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

    if (returnNode) {
      return fileNode;
    } else {
      return fileNodeID;
    }
  }

  return undefined;
};

const processContent = async (content, imageArgs) => {
  const { downloadImages } = imageArgs;
  if (!downloadImages) return content;

  if (content && typeof content === 'string') {
    // scan for html reference to <a> or <img> tags
    const $ = cheerio.load(content, { xmlMode: true, decodeEntities: false });

    let refs = [];
    let swapSrc = new Map();

    $('a, img').each((i, item) => {
      let url = item.attribs.href || item.attribs.src;
      let urlKey = url;

      if (!url) {
        return;
      }

      // removes protocol to handle mixed content in a page
      let urlNoProtocol = url.replace(/^https?:/i, '');

      // handling relative url
      const urlParsed = new URIParser(url);
      const isUrlRelative = urlParsed.is('relative');
      const isCDNFile = urlNoProtocol.startsWith('//cdn.nimbu.io');

      // if not relative root url or not matches content delivery domain, skip processing
      if (!isUrlRelative && !isCDNFile) {
        return;
      }

      if (refs.some(({ url: storedUrl }) => storedUrl === url)) {
        return;
      }

      // console.log(isCDNFile ? 'found image:' : 'found internal link', url);

      refs.push({
        url,
        urlKey,
        relativeLink: isUrlRelative,
        isFile: isCDNFile,
        name: item.name,
        elem: $(item),
      });
    });

    await Promise.all(
      refs.map(async (item) => {
        if (item.isFile) {
          const url = item.url;
          const urlParts = url.split('/');
          const filenameAndVersion = urlParts[urlParts.length - 1];
          const filenameAndVersionParts = filenameAndVersion.split('?');
          const filename = filenameAndVersionParts[0];
          const version = filenameAndVersionParts[1] || 'latest';

          try {
            const fileNode = await downloadImageAndCreateFileNode(
              {
                url,
                filename,
                version,
                returnNode: true,
              },
              imageArgs
            );

            if (fileNode) {
              const staticUrl = `/static/${fileNode.internal.contentDigest}/${fileNode.base}`;

              swapSrc.set(item.urlKey, {
                src: staticUrl,
                id: fileNode.id,
              });
            }
          } catch (error) {
            console.error(`Could not download "${url}":`, error);
          }
        }
      })
    );

    $('img').each((i, item) => {
      let url = item.attribs.src;
      let swapVal = swapSrc.get(url);
      if (!swapVal) {
        return;
      }

      $(item).attr('src', swapVal.src);
      $(item).removeAttr('srcset');
      $(item).removeAttr('sizes');
    });

    $('a').each((i, item) => {
      let url = item.attribs.href;
      let swapVal = swapSrc.get(url);
      if (!swapVal) {
        return;
      }

      $(item).attr('href', swapVal.src);
      $(item).attr('data-gts-swapped-href', 'gts-swapped-href');
    });

    return $.html();
  } else {
    return content;
  }
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
        default:
          node[key] = await processContent(node[key], imageArgs);
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
      } else {
        // search for references to cdn.nimbu.io and download
        item.content = await processContent(item.content, imageArgs);
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
