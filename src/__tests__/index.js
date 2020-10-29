jest.mock(`gatsby-source-filesystem`, () => {
  return {
    createRemoteFileNode: jest.fn(),
  };
});

jest.mock(`../client`, () => {
  return {
    createClient: jest.fn(() => {
      return {
        get: async (path) => {
          console.log('path', path);
          // Hack alert. match query text, from that get query name (like SHOP_POLICIES_QUERY) and convert to filename like policies.json
          const jsonFile = `${path
            .replace(/(\?[^\.]+)/g, '')
            .split('/')
            .slice(1)
            .join('_')}.json`;
          return require(`./fixtures/${jsonFile}`);
        },
      };
    }),
  };
});

const { sourceNodes } = require(`../gatsby-node`);

describe(`gatsby-source-nimbu`, () => {
  /**
   * This test is pretty bare-bones.
   * Mocking setup is borrowed from gatsby-source-shopify
   */
  const nodes = {};
  const actions = {
    createNode: jest.fn((node) => (nodes[node.id] = node)),
  };

  const activity = {
    start: jest.fn(),
    end: jest.fn(),
  };

  const reporter = {
    info: jest.fn(),
    activityTimer: jest.fn(() => activity),
    log: jest.fn(),
  };

  const cache = {
    get: jest.fn(),
  };

  const args = {
    actions,
    reporter,
    cache,
    // getNode: id => nodes[id],
  };

  beforeAll(async () => {
    await sourceNodes(args, { accessToken: `123456789` });
  });

  it(`Generates nodes`, () => {
    expect(Object.keys(nodes).length).not.toEqual(0);
    // better than no tests?  ¯\_(ツ)_/¯
    expect(nodes).toMatchSnapshot();
  });
});
