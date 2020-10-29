// Node prefix
export const TYPE_PREFIX = `Nimbu`;

// Node types
export const ARTICLE = `Article`;
export const BLOG = `Blog`;
export const CHANNEL = `Channel`;
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
  [PAGE]: `/pages`,
  [MENU]: `/menus?nested=1`,
  [TRANSLATION]: `/translations`,
  [CHANNEL]: `/channels`,
};
