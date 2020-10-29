import chalk from 'chalk';
import { ArticleNode, BlogNode, PageNode, MenuNode, TranslationNode } from './nodes';
import { createClient, queryAll, mapEndPoint } from './api';
import { forEach } from 'p-iteration';

import { SHOP, CONTENT, ARTICLE, BLOG, PAGE, MENU, TRANSLATION } from './constants';

export const sourceNodes = async (
  { actions: { createNode, touchNode }, createNodeId, store, cache, getCache, reporter },
  { accessToken, verbose = true, paginationSize = 250, includeCollections = [CONTENT, SHOP] }
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
      reporter,
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
          cacheImages: true,
          preProcess: async (blog) => {
            return await createNodes(mapEndPoint(ARTICLE, { blog: blog.slug }), ArticleNode, args, {
              cacheImages: true,
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
        createNodes(mapEndPoint(MENU), MenuNode, args),
        createNodes(mapEndPoint(TRANSLATION), TranslationNode, args),
        createPageNodes(mapEndPoint(PAGE), PageNode, args),
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

    // printGraphQLError(e);
  }
};

/**
 * Fetch and create nodes for the provided endpoint, query, and node factory.
 */
const createNodes = async (
  endpoint,
  nodeFactory,
  { client, createNode, formatMsg, verbose, imageArgs, paginationSize },
  { cacheImages = false, preProcess = async () => {}, postProcess = async () => {} } = {}
) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${endpoint} nodes`);

  if (verbose) console.time(msg);

  await forEach(await queryAll(client, endpoint, {}, paginationSize), async (entity) => {
    let node;

    await preProcess(entity);

    if (cacheImages) {
      node = await nodeFactory(imageArgs)(entity);
    } else {
      node = await nodeFactory(entity);
    }

    createNode(node);

    await postProcess(entity, node);
  });
  if (verbose) console.timeEnd(msg);
};

const createPageNodes = async (
  endpoint,
  nodeFactory,
  { client, createNode, formatMsg, verbose, paginationSize },
  f = async () => {}
) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${endpoint} nodes`);

  if (verbose) console.time(msg);

  await forEach(await queryAll(client, endpoint, {}, paginationSize), async (entity) => {
    const node = await nodeFactory(entity);
    createNode(node);
    await f(entity);
  });
  if (verbose) console.timeEnd(msg);
};
