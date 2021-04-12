import Nimbu from 'nimbu-client';

export const createClient = (accessToken, endPoint) => {
  if (!accessToken) {
    throw new Error('Please configure gatsby-source-nimbu with a valid accessToken');
  }

  return new Nimbu({
    token: accessToken,
    host: endPoint,
    headers: {
      'X-Nimbu-Client-Version': 1,
    },
  });
};
