import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
import { claimsFetchMetadataBrowser, counterFromEnv, counts, countView, dayKey, isCountedPage, isNotARead, isNotAReader, readViews, topPages, totalViews, VIEWS_DAYS, type ViewsFile } from "@/lib/views";

// A browser's user agent, only ever sent here to a stand-in for the store: nothing is counted for real.
const BROWSER = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const navigation = (extra: Record<string, string> = {}) =>
  new Headers({ "user-agent": BROWSER, "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "sec-fetch-site": "none", "sec-fetch-user": "?1", ...extra });
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15";
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0";
const counter = { url: "https://example.upstash.io", writeToken: "write", readToken: "read" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("which pages count", () => {
  it("counts the site's reading pages", () => {
    for (const path of [
      "/",
      "/bill",
      "/budget",
      "/gap",
      "/balance",
      "/method",
      "/camden",
      "/south-oxfordshire",
      "/council-tax",
      "/council-tax/camden",
      "/council-tax-rise",
      "/council-tax-rise/band-d",
      "/building",
      "/council-homes",
      "/promises",
      "/promise/lab-2026-parks",
      "/decisions",
      "/party/labour",
      "/topic/health",
      "/wards",
      "/ward/addison",
      "/councillor/stephen-cowan",
      "/payments",
      "/payments/2026-06",
      "/supplier/veolia-es-uk-ltd",
      "/sources",
      "/follow",
      "/privacy",
      "/most-read",
    ])
      expect(isCountedPage(path), path).toBe(true);
  });

  it("counts every page in the sitemap, so a new page is never left out unnoticed", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const missed = sitemap()
      .map((e) => new URL(e.url).pathname)
      .filter((p) => !isCountedPage(p));
    expect(missed).toEqual([]);
  });

  it("never counts an address that could carry what a reader typed", () => {
    for (const path of [
      // Follow tokens ride on these pages and on the API.
      "/follow/confirm",
      "/follow/manage",
      "/api/follow/unsubscribe",
      "/api/follow/manage",
      // Postcodes go to the API in a POST body; a postcode-shaped part of an address is never counted.
      "/api/postcode",
      "/ward/sw6-1ab",
      "/ward/sw61ab",
      "/ward/w12",
      "/council-tax/w12-7rq",
      "/councillor/n1",
      // A salary, a capital value or any bare number.
      "/promise/52300",
      "/supplier/250000",
      "/payments/2026",
      // A Balance it share code lives in the query string, which is never part of the path counted.
      "/balance?s=abc123",
      "/balance/abc123",
      "/balance/og",
      // Bands and months only in their own shape.
      "/council-tax-rise/band-cd",
      "/council-tax-rise/c",
      "/payments/2026-6",
    ])
      expect(isCountedPage(path), path).toBe(false);
  });

  it("skips the API, files, share images, unknown places and scanners' guesses", () => {
    for (const path of [
      "/api/altcha",
      "/views.json",
      "/feed.xml",
      "/promise/lab-2026-parks.md",
      "/md/promise/lab-2026-parks",
      "/promise/lab-2026-parks/opengraph-image",
      "/promise/lab-2026-parks/feed.xml",
      "/supplier/veolia-es-uk-ltd/og",
      "/opengraph-image",
      "/sitemap.xml",
      "/robots.txt",
      "/llms.txt",
      "/favicon.ico",
      "/hammersmith",
      "/not-a-council",
      "/councillors",
      "/wp-login.php",
      "/.env",
      "/promise/UPPER",
      "/promise/a/b",
      `/promise/${"a".repeat(200)}`,
    ])
      expect(isCountedPage(path), path).toBe(false);
  });
});

describe("which requests count", () => {
  it("skips crawlers, link previews, AI fetchers, scripts and requests with no user agent", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
      "WhatsApp/2.23.20.0",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "TelegramBot (like TwitterBot)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "Claude-User/1.0",
      "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
      "vercel-screenshot/1.0",
      "curl/8.4.0",
      "Wget/1.21.4",
      "python-httpx/0.27.0",
      "Python-urllib/3.12",
      "node",
      "undici",
      "axios/1.7.7",
      "Go-http-client/2.0",
      "BoroughBookUK/1.0",
    ])
      expect(isNotAReader(ua), ua).toBe(true);
    expect(isNotAReader(null)).toBe(true);
    expect(isNotAReader("")).toBe(true);
  });

  it("counts the browsers readers use", () => {
    for (const ua of [
      BROWSER,
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101",
    ])
      expect(isNotAReader(ua), ua).toBe(false);
  });

  it("skips prefetches and requests for part of a page", () => {
    expect(isNotARead(navigation({ "sec-purpose": "prefetch" }))).toBe(true);
    expect(isNotARead(navigation({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isNotARead(navigation({ purpose: "prefetch" }))).toBe(true);
    expect(isNotARead(navigation({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isNotARead(navigation({ "sec-fetch-dest": "image" }))).toBe(true);
    expect(isNotARead(navigation({ "sec-fetch-dest": "empty" }))).toBe(true);
    expect(isNotARead(navigation({ "sec-fetch-dest": "iframe" }))).toBe(true);
    expect(isNotARead(navigation())).toBe(false);
  });

  it("counts a page opened in Chrome, Safari or Firefox", () => {
    for (const ua of [CHROME, SAFARI, FIREFOX, BROWSER]) expect(counts("GET", "/supplier/acme-ltd", navigation({ "user-agent": ua })), ua).toBe(true);
    // Following a link from another page of the site, rather than typing the address.
    expect(counts("GET", "/supplier/acme-ltd", navigation({ "user-agent": CHROME, "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("skips a script that borrows a current browser's name but sends none of a browser's fetch headers", () => {
    for (const ua of [
      CHROME,
      SAFARI,
      FIREFOX,
      BROWSER,
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
    ]) {
      expect(isNotARead(new Headers({ "user-agent": ua })), ua).toBe(true);
      expect(counts("GET", "/supplier/acme-ltd", new Headers({ "user-agent": ua, accept: "text/html" })), ua).toBe(false);
    }
  });

  it("skips a document request that is not a browser opening the page", () => {
    expect(isNotARead(navigation({ "sec-fetch-mode": "no-cors" }))).toBe(true);
    const noMode = navigation();
    noMode.delete("sec-fetch-mode");
    expect(isNotARead(noMode)).toBe(true);
  });

  it("still counts browsers too old to send fetch headers, told apart by version", () => {
    for (const ua of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.83 Mobile/15E148 Safari/604.1",
    ]) {
      expect(claimsFetchMetadataBrowser(ua), ua).toBe(false);
      expect(isNotARead(new Headers({ "user-agent": ua })), ua).toBe(false);
    }
    // The first versions that send them.
    expect(claimsFetchMetadataBrowser("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.0.0 Safari/537.36")).toBe(true);
    expect(claimsFetchMetadataBrowser("Mozilla/5.0 (Windows NT 10.0; rv:90.0) Gecko/20100101 Firefox/90.0")).toBe(true);
    expect(claimsFetchMetadataBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15")).toBe(true);
    expect(claimsFetchMetadataBrowser("Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")).toBe(true);
  });

  it("counts a move within the app (the postcode finders, the decoder's links), but not Next.js fetching ahead", () => {
    const rsc = (extra: Record<string, string> = {}) => new Headers({ "user-agent": BROWSER, "sec-fetch-dest": "empty", rsc: "1", "next-router-state-tree": "%5B%5D", ...extra });
    expect(isNotARead(rsc())).toBe(false);
    expect(isNotARead(rsc({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isNotARead(rsc({ "next-router-prefetch": "1", "next-router-segment-prefetch": "/_tree" }))).toBe(true);
    expect(isNotARead(rsc({ rsc: "0" }))).toBe(true);
    expect(counts("GET", "/supplier/acme-ltd", rsc())).toBe(true);
  });

  it("counts only a reader's GET of a page", () => {
    expect(counts("GET", "/promises", navigation())).toBe(true);
    expect(counts("HEAD", "/promises", navigation())).toBe(false);
    expect(counts("POST", "/promises", navigation())).toBe(false);
    expect(counts("GET", "/api/postcode", navigation())).toBe(false);
    expect(counts("GET", "/follow/manage", navigation())).toBe(false);
    expect(counts("GET", "/promises", new Headers({ "user-agent": "Googlebot/2.1" }))).toBe(false);
  });
});

describe("what is stored and read", () => {
  const fakeStore = (answer: (body: string[][]) => unknown, status = 200) => {
    const sent: { url: string; body: string[][]; auth: string }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as string[][];
      // "no-store" would make Next.js refuse to refresh /most-read every ten minutes.
      expect(init.cache).toBeUndefined();
      sent.push({ url, body, auth: (init.headers as Record<string, string>).Authorization! });
      return new Response(JSON.stringify(answer(body)), { status });
    }) as unknown as typeof fetch;
    return { sent, f };
  };

  it("sends only the day and the path, never anything about the reader", async () => {
    const { sent, f } = fakeStore(() => [{ result: 1 }]);
    await countView(counter, "/promises", new Date("2026-10-13T09:30:00Z"), f);
    expect(sent).toEqual([{ url: "https://example.upstash.io/pipeline", body: [["HINCRBY", "boroughbook:views:2026-10-13", "/promises", "1"]], auth: "Bearer write" }]);
  });

  it("keys each day by its UTC date, apart from other sites", () => {
    expect(dayKey(new Date("2026-10-25T23:30:00Z"))).toBe("boroughbook:views:2026-10-25");
    expect(dayKey(new Date("2026-10-26T00:30:00+01:00"))).toBe("boroughbook:views:2026-10-25");
  });

  it("reads the last 30 days with the read-only token and leaves out days with no views", async () => {
    const { sent, f } = fakeStore((body) => body.map((_, i) => ({ result: i === 0 ? ["/", "5", "/promises", "2"] : i === 1 ? ["/", "1"] : [] })));
    const file = await readViews(counter, new Date("2026-10-13T12:00:00Z"), f);
    expect(sent[0]!.body).toHaveLength(VIEWS_DAYS);
    expect(sent[0]!.body[0]).toEqual(["HGETALL", "boroughbook:views:2026-10-13"]);
    expect(sent[0]!.body.at(-1)).toEqual(["HGETALL", "boroughbook:views:2026-09-14"]);
    expect(sent[0]!.auth).toBe("Bearer read");
    expect(file).toEqual({
      generated_at: "2026-10-13T12:00:00.000Z",
      days: [
        { date: "2026-10-13", pages: { "/": 5, "/promises": 2 } },
        { date: "2026-10-12", pages: { "/": 1 } },
      ],
    });
  });

  it("throws when the counter answers with an error or something else, so callers can say it is unavailable", async () => {
    await expect(readViews(counter, new Date(), fakeStore(() => "no", 500).f)).rejects.toThrow("500");
    await expect(readViews(counter, new Date(), fakeStore(() => [{ result: [] }]).f)).rejects.toThrow();
  });

  it("is off without the Upstash variables, and falls back to the write token for reading", () => {
    expect(counterFromEnv({})).toBeNull();
    expect(counterFromEnv({ KV_REST_API_URL: "https://x.upstash.io" })).toBeNull();
    expect(counterFromEnv({ KV_REST_API_TOKEN: "w" })).toBeNull();
    expect(counterFromEnv({ KV_REST_API_URL: "https://x.upstash.io/", KV_REST_API_TOKEN: "w" })).toEqual({ url: "https://x.upstash.io", writeToken: "w", readToken: "w" });
    expect(counterFromEnv({ KV_REST_API_URL: "https://x.upstash.io", KV_REST_API_TOKEN: "w", KV_REST_API_READ_ONLY_TOKEN: "r" })?.readToken).toBe("r");
  });
});

describe("/views.json", () => {
  const getViewsJson = async () => (await import("@/app/views.json/route")).GET();

  it("answers in the shared format: generated_at, then the days newest first, each a UTC date and its pages", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://example.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "write");
    vi.stubEnv("KV_REST_API_READ_ONLY_TOKEN", "read");
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as string[][];
      return new Response(JSON.stringify(body.map((_, i) => ({ result: i === 0 ? ["/", "3", "/ward/addison", "1"] : i === 2 ? ["/promises", "4"] : [] }))));
    });
    const res = await getViewsJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=600, s-maxage=600");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const file = (await res.json()) as ViewsFile;
    expect(Object.keys(file)).toEqual(["generated_at", "days"]);
    expect(new Date(file.generated_at).toISOString()).toBe(file.generated_at);
    expect(file.days).toHaveLength(2);
    for (const d of file.days) {
      expect(Object.keys(d)).toEqual(["date", "pages"]);
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const n of Object.values(d.pages)) expect(Number.isInteger(n)).toBe(true);
    }
    expect(file.days[0]!.date > file.days[1]!.date).toBe(true);
    expect(file.days[0]!.pages).toEqual({ "/": 3, "/ward/addison": 1 });
    expect(file.days[0]!.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("is an empty list of days, and says why, before the counter is connected", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    const res = await getViewsJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-views-counter")).toMatch(/not connected/);
    const file = (await res.json()) as ViewsFile;
    expect(Object.keys(file)).toEqual(["generated_at", "days"]);
    expect(file.days).toEqual([]);
  });

  it("answers 503 with a short error, never cached, when the counter cannot be read", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://example.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "write");
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    const res = await getViewsJson();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "the counter cannot be read now" });
  });
});

describe("the proxy", () => {
  const event = () => {
    const waited: Promise<unknown>[] = [];
    return { waited, ev: { waitUntil: (p: Promise<unknown>) => waited.push(p) } as unknown as NextFetchEvent };
  };
  const loadProxy = async (connected: boolean) => {
    vi.stubEnv("KV_REST_API_URL", connected ? "https://example.upstash.io" : "");
    vi.stubEnv("KV_REST_API_TOKEN", connected ? "write" : "");
    return (await import("@/proxy")).proxy;
  };
  const isNext = (res: Response) => res.headers.get("x-middleware-next") === "1";

  it("counts a reader's page after it is sent, and serves the page even when the counter fails", async () => {
    const sent: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent.push(String(init.body));
      throw new Error("counter down");
    });
    const proxy = await loadProxy(true);
    const { waited, ev } = event();
    const res = proxy(new NextRequest("https://boroughbook.uk/promises?from=home", { headers: navigation() }), ev);
    expect(isNext(res)).toBe(true);
    expect(waited).toHaveLength(1);
    await expect(waited[0]).resolves.toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('"/promises"');
    expect(sent[0]).not.toContain("from=home");
  });

  it("counts nothing for a crawler, a prefetch or a page that does not count", async () => {
    vi.stubGlobal("fetch", async () => new Response("[]"));
    const proxy = await loadProxy(true);
    const { waited, ev } = event();
    for (const [path, headers] of [
      ["/promises", new Headers({ "user-agent": "Googlebot/2.1" })],
      ["/promises", navigation({ "next-router-prefetch": "1" })],
      ["/follow/manage", navigation()],
    ] as const)
      expect(isNext(proxy(new NextRequest(`https://boroughbook.uk${path}`, { headers }), ev))).toBe(true);
    expect(waited).toEqual([]);
  });

  it("counts nothing and serves every page without the Upstash variables", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    const proxy = await loadProxy(false);
    const { waited, ev } = event();
    expect(isNext(proxy(new NextRequest("https://boroughbook.uk/promises", { headers: navigation() }), ev))).toBe(true);
    expect(waited).toEqual([]);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("serves the page even if counting throws before it starts", async () => {
    const proxy = await loadProxy(true);
    const ev = {
      waitUntil: () => {
        throw new Error("no waitUntil here");
      },
    } as unknown as NextFetchEvent;
    vi.stubGlobal("fetch", async () => new Response("[]"));
    expect(isNext(proxy(new NextRequest("https://boroughbook.uk/promises", { headers: navigation() }), ev))).toBe(true);
  });
});

describe("the most read pages", () => {
  const file: ViewsFile = {
    generated_at: "2026-10-13T12:00:00Z",
    days: [
      { date: "2026-10-01", pages: { "/payments": 100 } },
      { date: "2026-10-13", pages: { "/": 5, "/promises": 2 } },
      { date: "2026-10-12", pages: { "/promises": 4, "/wards": 2 } },
    ],
  };

  it("adds up the last days by calendar date, most read first, ties by address", () => {
    expect(topPages(file, 2)).toEqual([
      { path: "/promises", views: 6 },
      { path: "/", views: 5 },
      { path: "/wards", views: 2 },
    ]);
    expect(topPages(file, 30)[0]).toEqual({ path: "/payments", views: 100 });
    expect(totalViews(file, 2)).toBe(13);
  });

  it("leaves out a day older than the window even when the quiet days in between are missing from the file", () => {
    // 1 October is 12 days before the 13th: among the file's newest seven days, but not in the last seven.
    expect(topPages(file, 7).map((p) => p.path)).toEqual(["/promises", "/", "/wards"]);
    expect(totalViews(file, 7)).toBe(13);
    expect(totalViews(file, 12)).toBe(13);
    expect(totalViews(file, 13)).toBe(113);
    expect(topPages(file, 1)).toEqual([
      { path: "/", views: 5 },
      { path: "/promises", views: 2 },
    ]);
  });
});
