export const DEFAULT_SYNC_SERVER_BASE_URL = '';

export const toSyncEndpoint = (baseUrl: string) => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');

  if (!trimmed) {
    return '';
  }

  return `${trimmed}/api/sync`;
};

export const toHealthEndpoint = (baseUrl: string) => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');

  if (!trimmed) {
    return '';
  }

  return `${trimmed}/health`;
};
