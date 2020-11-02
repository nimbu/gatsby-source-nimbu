import Nimbu from 'nimbu-client';

export const createClient = (accessToken, endPoint) => {
  return new Nimbu({
    token: accessToken,
    host: endPoint,
    headers: {
      'X-Nimbu-Client-Version': 1,
    },
  });
};
