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
  includeCollections = [_constants.CONTENT, _constants.SHOP, _constants.CHANNELS],
  downloadImages = true,
  includeChannels = [],
  excludeChannels = []
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
      reporter,
      downloadImages
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
        preProcess: async blog => {
          return await createNodes((0, _api.mapEndPoint)(_constants.ARTICLE, {
            blog: blog.slug
          }), _nodes.ArticleNode, args, {
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
      }), createNodes((0, _api.mapEndPoint)(_constants.MENU, {}, {
        nested: 1
      }), _nodes.MenuNode, args), createNodes((0, _api.mapEndPoint)(_constants.TRANSLATION), _nodes.TranslationNode, args), createNodes((0, _api.mapEndPoint)(_constants.PAGE), _nodes.PageNode, args)]);
    }

    if (includeCollections.includes(_constants.SHOP)) {
      let productCollections = {};
      await createNodes((0, _api.mapEndPoint)(_constants.PRODUCT), _nodes.ProductNode, args, {
        proProcess: async product => {
          if (product.collections) {
            product.collections.forEach(c => {
              if (!productCollections[c.id]) {
                productCollections[c.id] = [];
              }

              productCollections[c.id].push(product.id);
            });
          }
        },
        postProcess: async (product, productNode) => {
          if (product.variants) await (0, _pIteration.forEach)(product.variants, async variant => {
            createNode(await (0, _nodes.ProductVariantNode)(imageArgs, productNode)(variant));
          });
        }
      });
      await createNodes((0, _api.mapEndPoint)(_constants.COLLECTION), _nodes.CollectionNode, args, {
        proProcess: async collection => {
          if (productCollections[collection.id]) {
            collection.products = productCollections[collection.id];
          }
        }
      });
    }

    if (includeCollections.includes(_constants.CHANNELS)) {
      let query = {};

      if (includeChannels && includeChannels.length > 0) {
        query = {
          'slug.in': includeChannels.join(',')
        };
      } else if (excludeChannels && excludeChannels.length > 0) {
        query = {
          'slug.nin': excludeChannels.join(',')
        };
      }

      promises = promises.concat([createNodes((0, _api.mapEndPoint)(_constants.CHANNEL, {}, query), _nodes.ChannelNode, args, {
        preProcess: async (channel) => createNodes((0, _api.mapEndPoint)((0, _api.mapNodeType)(channel.slug), {
          channel: channel.slug
        }), (0, _nodes.ChannelEntryNode)(channel.slug), args, {
          preProcess: async entry => {
            // Add a link between the article and channel nodes.
            if (!channel.entries) channel.entries = [];
            channel.entries.push(entry.id);
            entry.channel = {
              id: channel.id,
              customizations: channel.customizations
            };
            return entry;
          }
        })
      })]);
    }

    console.time(msg);
    await Promise.all(promises);
    console.timeEnd(msg);
  } catch (e) {
    console.error(e);
    console.error((0, _chalk.default)`\n{red error} an error occurred while sourcing data`); // If not a request error, let Gatsby print the error.

    if (!e.hasOwnProperty(`request`)) throw e;
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
  preProcess = async () => {},
  postProcess = async () => {}
} = {}) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${endpoint} nodes`);
  if (verbose) console.time(msg);
  await (0, _pIteration.forEach)(await (0, _api.queryAll)(client, endpoint, {}, paginationSize), async entity => {
    await preProcess(entity);
    let node = await nodeFactory(imageArgs)(entity);
    createNode(node);
    await postProcess(entity, node);
  });
  if (verbose) console.timeEnd(msg);
};