"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    SwaggerUIBundle?: {
      (config: Record<string, unknown>): unknown;
      presets: { apis: unknown };
      SwaggerUIStandalonePreset: unknown;
    };
  }
}

const SWAGGER_CSS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const SWAGGER_BUNDLE = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
const DOM_ID = "swagger-ui";

function ensureStylesheet(href: string): () => void {
  if (document.querySelector(`link[href="${href}"]`)) {
    return () => {};
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  return () => link.remove();
}

function ensureScript(src: string): Promise<void> {
  if (window.SwaggerUIBundle) {
    return Promise.resolve();
  }
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export default function SwaggerPage() {
  useEffect(() => {
    const cleanupCss = ensureStylesheet(SWAGGER_CSS);
    let cancelled = false;

    ensureScript(SWAGGER_BUNDLE)
      .then(() => {
        if (cancelled) return;
        const SwaggerUIBundle = window.SwaggerUIBundle;
        if (!SwaggerUIBundle) return;

        SwaggerUIBundle({
          url: "/api/admin-proxy/openapi.json",
          dom_id: `#${DOM_ID}`,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
          layout: "BaseLayout",
          requestInterceptor: (req: { credentials?: string }) => {
            req.credentials = "same-origin";
            return req;
          },
        });
      })
      .catch((err) => console.error("Swagger UI failed to load:", err));

    return () => {
      cancelled = true;
      cleanupCss();
      const root = document.getElementById(DOM_ID);
      if (root) root.innerHTML = "";
    };
  }, []);

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="px-8 py-6 border-b border-slate-100">
        <h1 className="text-xl font-bold text-slate-900">API Reference</h1>
        <p className="text-sm text-slate-500 mt-1">
          Interactive documentation for the QueryFlux admin API.
        </p>
      </div>
      <div className="flex-1 px-4 py-4">
        <div id={DOM_ID} />
      </div>
    </div>
  );
}
