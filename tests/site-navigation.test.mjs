import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const authSource = await readFile(new URL("../js/auth.js", import.meta.url), "utf8");

for (const basePath of ["/", "/charity_site/"]) {
  for (const page of ["index.html", "pages/chat.html", "pages/login.html", "pages/profile.html"]) {
    test(`account navigation works from ${basePath}${page}`, async () => {
      const attributes = new Map();
      const loginLink = {
        removeAttribute: (name) => attributes.delete(name),
        setAttribute: (name, value) => attributes.set(name, value),
      };
      let sessionChanged;
      const supabase = {
        auth: {
          onAuthStateChange: (callback) => { sessionChanged = callback; },
          getSession: async () => ({ data: { session: null }, error: null }),
        },
      };
      const context = vm.createContext({
        URL,
        document: { querySelector: (selector) => selector === ".login-link" ? loginLink : null },
        window: { location: { pathname: `${basePath}${page}` } },
      });
      const client = new vm.SyntheticModule(["supabase"], function () {
        this.setExport("supabase", supabase);
      }, { context });
      const module = new vm.SourceTextModule(authSource, {
        context,
        initializeImportMeta: (meta) => { meta.url = `https://example.com${basePath}js/auth.js`; },
      });
      await module.link(() => client);
      await module.evaluate();

      assert.equal(loginLink.href, `https://example.com${basePath}pages/login.html`);
      assert.equal(loginLink.textContent, "Log in");
      assert.equal(attributes.get("aria-current"), page === "pages/login.html" ? "page" : undefined);

      sessionChanged("SIGNED_IN", { user: { email: "member@example.com" } });
      assert.equal(loginLink.href, `https://example.com${basePath}pages/profile.html`);
      assert.equal(loginLink.textContent, "Your profile");
      assert.equal(attributes.get("aria-current"), page === "pages/profile.html" ? "page" : undefined);

      sessionChanged("SIGNED_OUT", null);
      assert.equal(loginLink.href, `https://example.com${basePath}pages/login.html`);
      assert.equal(attributes.get("aria-current"), page === "pages/login.html" ? "page" : undefined);
    });
  }
}