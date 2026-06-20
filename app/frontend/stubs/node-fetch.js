// Browser stub for node-fetch — MindAR bundles it but in the browser native fetch is available.
// This prevents fetch-blob (a Node.js-only dep) from being loaded.
const f = globalThis.fetch ? globalThis.fetch.bind(globalThis) : () => Promise.reject(new Error('fetch unavailable'));
export default f;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
export const FormData = globalThis.FormData;
