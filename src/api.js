import { createClient as nimbuClient } from './client';
import { NODE_TO_ENDPOINT_MAPPING } from './constants';

export const createClient = nimbuClient;

export const queryAll = (client, path, query, paginationSize) => {
  return client.get(path, { fetchAll: true });
};

export const mapEndPoint = (path, variables = {}) => {
  let mapping = NODE_TO_ENDPOINT_MAPPING[path];
  Object.keys(variables).forEach((key) => {
    mapping = mapping.replace(`:${key}`, variables[key]);
  });
  return mapping;
};
