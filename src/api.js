import queryString from 'query-string';

import { createClient as nimbuClient } from './client';
import { CHANNEL_ENTRY, NODE_TO_ENDPOINT_MAPPING, CLASSNAME_TO_NODE_MAPPING } from './constants';

export const createClient = nimbuClient;

export const queryAll = (client, path, query, paginationSize) => {
  return client.get(path, { fetchAll: true });
};

export const mapEndPoint = (path, variables = {}, query = {}) => {
  let mapping = NODE_TO_ENDPOINT_MAPPING[path] || NODE_TO_ENDPOINT_MAPPING[CHANNEL_ENTRY];

  Object.keys(variables).forEach((key) => {
    mapping = mapping.replace(`:${key}`, variables[key]);
  });

  if (Object.keys(query).length > 0) {
    mapping = mapping + '?' + queryString.stringify(query);
  }
  return mapping;
};

export const mapNodeType = (className) => {
  return CLASSNAME_TO_NODE_MAPPING[className] || `${className}_${CHANNEL_ENTRY}`;
};
