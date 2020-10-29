"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.sourceNodes = void 0;

var _chalk = _interopRequireDefault(require("chalk"));

var _nodes = require("./nodes");

var _api = require("./api");

var _pIteration = require("p-iteration");

var _constants = require("./constants");

const sourceNodes = async ({
  actions: {
    createNode,
    touchNode
  },
  createNodeId,
  store,
  cache,
  getCache,
  reporter
}, {
  accessToken,
  verbose = true,
  paginationSize = 250,
  includeCollections = [_constants.CONTENT, _constants.SHOP]
}) => {
  const client = (0, _api.createClient)(accessToken);
  const sites = await client.get('/sites');
  const siteName = sites[0].subdomain; // Convenience function to namespace console messages.

  const formatMsg = msg => (0, _chalk.default)`{blue gatsby-source-nimbu/${siteName}} ${msg}`;

  try {
    console.log(formatMsg(`starting to fetch data from Nimbu`)); //   // Arguments used for file node creation.

    const imageArgs = {
      createNode,
      createNodeId,
      touchNode,
      store,
      cache,
      getCache,
      reporter
    }; //   // Arguments used for node creation.

    const args = {
      client,
      createNode,
      createNodeId,
      formatMsg,
      verbose,
      imageArgs,
      paginationSize
    }; //   // Message printed when fetching is complete.

    const msg = formatMsg(`finished fetching data from Nimbu`);
    let promises = [];

    if (includeCollections.includes(_constants.CONTENT)) {
      promises = promises.concat([createNodes((0, _api.mapEndPoint)(_constants.BLOG), _nodes.BlogNode, args, {
        cacheImages: true,
        preProcess: async blog => {
          return await createNodes((0, _api.mapEndPoint)(_constants.ARTICLE, {
            blog: blog.slug
          }), _nodes.ArticleNode, args, {
            cacheImages: true,
            preProcess: async article => {
              // Add a link between the article and blog nodes.
              if (!blog.articles) blog.articles = [];
              blog.articles.push(article.id);
              article.blog = {
                id: blog.id
              };
              return article;
            }
          });
        }
      }), createNodes((0, _api.mapEndPoint)(_constants.MENU), _nodes.MenuNode, args), createNodes((0, _api.mapEndPoint)(_constants.TRANSLATION), _nodes.TranslationNode, args), createPageNodes((0, _api.mapEndPoint)(_constants.PAGE), _nodes.PageNode, args)]);
    }

    console.time(msg);
    await Promise.all(promises);
    console.timeEnd(msg);
  } catch (e) {
    console.error(e);
    console.error((0, _chalk.default)`\n{red error} an error occurred while sourcing data`); // If not a request error, let Gatsby print the error.

    if (!e.hasOwnProperty(`request`)) throw e; // printGraphQLError(e);
  }
};
/**
 * Fetch and create nodes for the provided endpoint, query, and node factory.
 */


exports.sourceNodes = sourceNodes;

const createNodes = async (endpoint, nodeFactory, {
  client,
  createNode,
  formatMsg,
  verbose,
  imageArgs,
  paginationSize
}, {
  cacheImages = false,
  preProcess = async () => {},
  postProcess = async () => {}
} = {}) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${endpoint} nodes`);
  if (verbose) console.time(msg);
  await (0, _pIteration.forEach)(await (0, _api.queryAll)(client, endpoint, {}, paginationSize), async entity => {
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

const createPageNodes = async (endpoint, nodeFactory, {
  client,
  createNode,
  formatMsg,
  verbose,
  paginationSize
}, f = async () => {}) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${endpoint} nodes`);
  if (verbose) console.time(msg);
  await (0, _pIteration.forEach)(await (0, _api.queryAll)(client, endpoint, {}, paginationSize), async entity => {
    const node = await nodeFactory(entity);
    createNode(node);
    await f(entity);
  });
  if (verbose) console.timeEnd(msg);
};