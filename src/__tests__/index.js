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
          const jsonFile = `${path.split('?').shift().split('/').slice(1).join('_')}.json`;
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
  };

  beforeAll(async () => {
    await sourceNodes(args, {
      accessToken: `123456789`,
      includeChannels: ['gatsby_one', 'gatsby_two'],
    });
  });

  it(`Generates nodes`, () => {
    expect(Object.keys(nodes).length).not.toEqual(0);
    // better than no tests?  ¯\_(ツ)_/¯
    expect(nodes).toMatchSnapshot();
  });
});
