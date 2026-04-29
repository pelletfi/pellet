import { test, expect } from "@playwright/test";

test("home renders the OLI landing", async ({ page }) => {
  await page.goto("/");
  // Wait for the framer-motion hero to mount + hydrate.
  await expect(page.locator("h1.landing-hero-h1")).toContainText("Open-Ledger Interface");
});

test("nav has agents + docs links", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav.nav-links")).toContainText("Agents");
  await expect(page.locator("nav.nav-links")).toContainText("Docs");
});

test("favicon serves", async ({ request }) => {
  const res = await request.get("/icon.png");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("brand mark serves as svg", async ({ request }) => {
  const res = await request.get("/pellet-mark.svg");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("svg");
});

test("docs page renders", async ({ request }) => {
  const res = await request.get("/docs");
  expect(res.status()).toBe(200);
});

test("agents placeholder page renders", async ({ request }) => {
  const res = await request.get("/agents");
  expect(res.status()).toBe(200);
});

test("/api/v1/health returns block height", async ({ request }) => {
  const res = await request.get("/api/v1/health");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.status).toBe("ok");
  expect(typeof json.block).toBe("number");
});

test("/api/agents returns the seeded list (legacy v0 surface)", async ({ request }) => {
  const res = await request.get("/api/agents");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.agents)).toBe(true);
});
