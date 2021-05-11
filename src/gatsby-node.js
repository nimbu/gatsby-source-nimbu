import chalk from 'chalk';
import {
  ArticleNode,
  BlogNode,
  ChannelEntryNode,
  ChannelNode,
  CollectionNode,
  MenuNode,
  PageNode,
  ProductNode,
  ProductVariantNode,
  TranslationNode,
} from './nodes';
import { createClient, queryAll, mapEndPoint, mapNodeType } from './api';
import { forEach } from 'p-iteration';

import {
  ARTICLE,
  BLOG,
  CHANNEL_ENTRY,
  CHANNEL,
  CHANNELS,
  CONTENT,
  COLLECTION,
  MENU,
  PAGE,
  PRODUCT,
  SHOP,
  TRANSLATION,
} from './constants';

export const sourceNodes = async (
  { actions: { createNode, touchNode }, createNodeId, store, cache, getCache, reporter, getNode },
  {
    accessToken,
    verbose = true,
    paginationSize = 250,
    includeCollections = [CONTENT, SHOP, CHANNELS],
    downloadImages = true,
    includeChannels = [],
    excludeChannels = [],
  }
) => {
  const client = createClient(accessToken);
  const sites = await client.get('/sites');
  const siteName = sites[0].subdomain;

  // Convenience function to namespace console messages.
  const formatMsg = (msg) => chalk`{blue gatsby-source-nimbu/${siteName}} ${msg}`;

  try {
    console.log(formatMsg(`starting to fetch data from Nimbu`));

    //   // Arguments used for file node creation.
    const imageArgs = {
      createNode,
      createNodeId,
      touchNode,
      store,
      cache,
      getCache,
      getNode,
      reporter,
      downloadImages,
    };

    //   // Arguments used for node creation.
    const args = {
      client,
      createNode,
      createNodeId,
      formatMsg,
      verbose,
      imageArgs,
      paginationSize,
    };

    //   // Message printed when fetching is complete.
    const msg = formatMsg(`finished fetching data from Nimbu`);

    let promises = [];

    if (includeCollections.includes(CONTENT)) {
      promises = promises.concat([
        createNodes(mapEndPoint(BLOG), BlogNode, args, {
          preProcess: async (blog) => {
            return await createNodes(mapEndPoint(ARTICLE, { blog: blog.slug }), ArticleNode, args, {
              preProcess: async (article) => {
                // Add a link between the article and blog nodes.
                if (!blog.articles) blog.articles = [];
                blog.articles.push(article.id);

                article.blog = { id: blog.id };
                return article;
              },
            });
          },
        }),
        createNodes(mapEndPoint(MENU, {}, { nested: 1 }), MenuNode, args),
        createNodes(mapEndPoint(TRANSLATION), TranslationNode, args),
        createNodes(mapEndPoint(PAGE), PageNode, args),
      ]);
    }

    if (includeCollections.includes(SHOP)) {
      let productCollections = {};

      await createNodes(mapEndPoint(PRODUCT), ProductNode, args, {
        proProcess: async (product) => {
          if (product.collections) {
            product.collections.forEach((c) => {
              if (!productCollections[c.id]) {
                productCollections[c.id] = [];
              }
              productCollections[c.id].push(product.id);
            });
          }
        },
        postProcess: async (product, productNode) => {
          if (product.variants)
            await forEach(product.variants, async (variant) => {
              createNode(await ProductVariantNode(imageArgs, productNode)(variant));
            });
        },
      });

      await createNodes(mapEndPoint(COLLECTION), CollectionNode, args, {
        proProcess: async (collection) => {
          if (productCollections[collection.id]) {
            collection.products = productCollections[collection.id];
          }
        },
      });
    }

    if (includeCollections.includes(CHANNELS)) {
      let query = {};
      if (includeChannels && includeChannels.length > 0) {
        query = { 'slug.in': includeChannels.join(',') };
      } else if (excludeChannels && excludeChannels.length > 0) {
        query = { 'slug.nin': excludeChannels.join(',') };
      }

      promises = promises.concat([
        createNodes(mapEndPoint(CHANNEL, {}, query), ChannelNode, args, {
          preProcess: async (channel) =>
            createNodes(
              mapEndPoint(mapNodeType(channel.slug), { channel: channel.slug }),
              ChannelEntryNode(channel.slug),
              args,
              {
                preProcess: async (entry) => {
                  // Add a link between the article and channel nodes.
                  if (!channel.entries) channel.entries = [];
                  channel.entries.push(entry.id);

                  entry.channel = { id: channel.id, customizations: channel.customizations };
                  return entry;
                },
              }
            ),
        }),
      ]);
    }

    console.time(msg);
    await Promise.all(promises);
    console.timeEnd(msg);
  } catch (e) {
    console.error(e);

    console.error(chalk`\n{red error} an error occurred while sourcing data`);

    // If not a request error, let Gatsby print the error.
    if (!e.hasOwnProperty(`request`)) throw e;
  }
};

/**
 * Fetch and create nodes for the provided endpoint, query, and node factory.
 */
const createNodes = async (
  endpoint,
  nodeFactory,
  { client, createNode, formatMsg, verbose, imageArgs, paginationSize },
  { preProcess = async () => {}, postProcess = async () => {} } = {}
) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${endpoint} nodes`);

  if (verbose) console.time(msg);

  await forEach(await queryAll(client, endpoint, {}, paginationSize), async (entity) => {
    await preProcess(entity);

    let node = await nodeFactory(imageArgs)(entity);
    createNode(node);

    await postProcess(entity, node);
  });
  if (verbose) console.timeEnd(msg);
};
