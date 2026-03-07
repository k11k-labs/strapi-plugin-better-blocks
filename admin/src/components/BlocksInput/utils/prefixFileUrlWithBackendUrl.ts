declare global {
  interface Window {
    strapi: {
      backendURL: string;
    };
  }
}

export const prefixFileUrlWithBackendUrl = (fileURL?: string) => {
  return !!fileURL && fileURL.startsWith('/')
    ? `${window.strapi.backendURL}${fileURL}`
    : fileURL;
};
