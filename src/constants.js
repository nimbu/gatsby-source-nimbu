// Node prefix
export const TYPE_PREFIX = `Nimbu`;

// Node types
export const ARTICLE = `Article`;
export const BLOG = `Blog`;
export const CHANNEL = `Channel`;
export const CHANNEL_ENTRY = `ChannelEntry`;
export const COLLECTION = `Collection`;
export const MENU = `Menu`;
export const PAGE = `Page`;
export const PRODUCT = `Product`;
export const PRODUCT_VARIANT = `ProductVariant`;
export const SITE = `Site`;
export const TRANSLATION = `Translation`;

// Collection Types
export const SHOP = `shop`;
export const CONTENT = `content`;
export const CHANNELS = `channels`;

export const NODE_TO_ENDPOINT_MAPPING = {
  [ARTICLE]: `/blogs/:blog/articles`,
  [BLOG]: `/blogs`,
  [COLLECTION]: `/collections`,
  [PRODUCT]: `/products`,
  [PAGE]: `/pages?resolve=1`,
  [MENU]: `/menus`,
  [TRANSLATION]: `/translations`,
  [CHANNEL]: `/channels`,
  [CHANNEL_ENTRY]: `/channels/:channel/entries`,
};

export const CLASSNAME_TO_NODE_MAPPING = {
  pages: PAGE,
  products: PRODUCT,
  navigation: MENU,
};
