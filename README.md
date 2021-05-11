# gatsby-source-nimbu

Source plugin for pulling data into [Gatsby][gatsby] from a [Nimbu][nimbu] project via the [Nimbu
API][nimbu-api].

## Features

- Provides public content from content management system (pages, blogs, etc), the shop (products,
  collections, etc) or the channels database available via the [Nimbu API][nimbu-api]
- Supports [gatsby-transformer-sharp][gatsby-transformer-sharp] and [gatsby-image][gatsby-image] for
  all images

## Install

```shell
npm install gatsby-source-nimbu
```

## How to use

Ensure you have an access token for the [Nimbu API][nimbu-api]. The token should have the following
permissions, depending on the use case you want to solve:

- Read content
- Read products
- Read channels

Then in your `gatsby-config.js` add the following config to enable this plugin:

```js
plugins: [
  /*
   * Gatsby's data processing layer begins with “source”
   * plugins. Here the site sources its data from Nimbu.
   */
  {
    resolve: 'gatsby-source-nimbu',
    options: {
        // An API access token to your Nimbu project. This is required.
        accessToken: process.env.NIMBU_API_TOKEN,

        // Set verbose to true to display a verbose output on `npm run develop`
        // or `npm run build`. This prints which nodes are being fetched and how
        // much time was required to fetch and process the data.
        // Defaults to true.
        verbose: true,

        // Number of records to fetch on each request when building the cache
        // at startup. If your application encounters timeout errors during
        // startup, try decreasing this number.
        paginationSize: 250,

        // List of collections you want to fetch.
        // Possible values are: 'content', 'shop' and 'channels'.
        // Defaults to ['content', 'shop', 'channels'].
        includeCollections: ['content', 'shop', 'channels'],

        // An optional exhaustive list of the channels to fetch the data for.
        // All others will be skipped.
        includeChannels: [],

        // An optional list of the channels to NOT get data from. All data from
        // others will be fetched and injected in the GraphQL layer.
        excludeChannels: [],

        // Download Images Locally
        // set to false if you plan on using Nimbu's CDN, defaults to true
        downloadImages: true,
      },
    },
  },
];
```

[gatsby]: https://www.gatsbyjs.org/
[nimbu]: https://www.nimbu.io/
[nimbu-api]: https://docs.nimbu.io/en/api
[gatsby-plugin-sharp]: https://www.gatsbyjs.com/plugins/gatsby-plugin-sharp/
[gatsby-image-fragments]: https://www.gatsbyjs.com/plugins/gatsby-image/
