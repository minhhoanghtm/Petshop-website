import "@testing-library/jest-dom";

// Polyfill import.meta.env for Vite-specific code running in Jest
// (jest-environment-jsdom does not provide this)
if (typeof globalThis.import === "undefined") {
  globalThis.import = {};
}
if (!globalThis.import.meta) {
  globalThis.import = { meta: { env: {} } };
}
globalThis.import.meta.env = {
  VITE_API_BASE_URL: "http://localhost:5000",
  VITE_GOOGLE_CLIENT_ID: "test-google-client-id",
  MODE: "test",
  DEV: false,
  PROD: false,
};
