/// <reference types="vite/client" />

/** Injected by Vite's `define` at build time — set to package.json `version`. */
declare const __APP_VERSION__: string;

/**
 * plotly.js-strict-dist-min ships no own types and @types/plotly.js types the `plotly.js`
 * entry, not the dist bundles. We consume it via a lazy `import('plotly.js-strict-dist-min')`
 * in PlotlyChart and structurally narrow the default export there, so an ambient
 * `any`-default declaration is sufficient (WS-1 / v1.17).
 */
declare module 'plotly.js-strict-dist-min' {
  const Plotly: unknown;
  export default Plotly;
}
