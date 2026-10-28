// Settings that are the same on every device.
export const CONFIG = {
  // Microsoft «Application (client) ID» από το portal.azure.com → App registrations
  clientId: 'b60aa1fa-8ae7-4a86-ab5f-b17e7566a1a0',
  // only for development / tests (local fake OneDrive). Leave empty in production.
  devServer: new URLSearchParams(location.search).get('dev') || '',
};
