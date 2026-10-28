// Settings that are the same on every device.
export const CONFIG = {
  // Microsoft «Application (client) ID» από το portal.azure.com → App registrations
  clientId: '',
  // only for development / tests (local fake OneDrive). Leave empty in production.
  devServer: new URLSearchParams(location.search).get('dev') || '',
};
