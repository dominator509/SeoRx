import { execFileSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  AuthorizeDeveloperApiKeyResponse,
  GetDashboardStatsResponse,
  GetGoogleSearchConsoleAnalyticsResponse,
  GetIssueBreakdownResponse,
  GetPageSpeedResultsResponse,
  GetRecentAuditsResponse,
  GetReportResponse,
  GetScoreTrendsResponse,
  ListApiKeysResponse,
  ListGoogleSearchConsolePropertiesResponse,
  ListReportsResponse,
  ListReportsResponseItem,
  ListWebhooksResponse,
  TestWebhookResponse,
  UpdateApiKeyResponse,
} from "@workspace/api-zod";
import { encryptSecret } from "../lib/crypto";

const TEST_USER_ID = "test-user-1";
const OTHER_USER_ID = "test-user-2";

vi.mock("@clerk/express", () => ({
  clerkClient: {
    users: {
      getUser: vi.fn(async (userId: string) => ({
        firstName: userId === TEST_USER_ID ? "Test" : "Other",
        lastName: "User",
        emailAddresses: [{ emailAddress: `${userId}@example.com` }],
      })),
    },
  },
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers?: Record<string, string | string[] | undefined> }) => {
    const header = req.headers?.["x-test-user-id"];
    const userId = Array.isArray(header) ? header[0] : header;
    return userId
      ? { userId, sessionClaims: { email: `${userId}@example.com` } }
      : { userId: null };
  },
}));

vi.mock("../lib/crawler", () => ({
  crawlSite: vi.fn(async (url: string) => ({
    pages: [
      {
        url,
        title: "Test Page",
        metaDescription: "A deterministic test page for API contract tests.",
        headings: { h1: ["Test Page"], h2: [] },
        links: { internal: [], external: [] },
        images: [],
        statusCode: 200,
        loadTimeMs: 25,
      },
    ],
    errors: [],
  })),
}));

vi.mock("../lib/seo-analyzer", () => ({
  analyzeCrawlResult: vi.fn(() => ({
    seoScore: 88,
    issues: [
      {
        url: "https://allowed.example/",
        category: "meta",
        severity: "high",
        title: "Missing meta description",
        description: "The page is missing a unique meta description.",
        recommendation: "Add a concise meta description.",
        priorityScore: 82,
      },
    ],
  })),
}));

let containerName: string | null = null;
let app: Awaited<typeof import("../app")>["default"];
let dbModule: typeof import("@workspace/db");

function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  const executable = process.platform === "win32" && command === "corepack" ? "cmd.exe" : command;
  const finalArgs = process.platform === "win32" && command === "corepack"
    ? ["/d", "/s", "/c", ["corepack", ...args].join(" ")]
    : args;
  execFileSync(executable, finalArgs, {
    cwd: new URL("../../../..", import.meta.url),
    env: { ...process.env, ...env },
    stdio: "pipe",
  });
}

async function seedOrg(slug: string, userId = TEST_USER_ID) {
  const orgId = crypto.randomUUID();
  await dbModule.db.insert(dbModule.organizationsTable).values({
    id: orgId,
    name: slug,
    slug,
  });
  await dbModule.db.insert(dbModule.orgMembersTable).values({
    id: crypto.randomUUID(),
    orgId,
    userId,
    email: `${userId}@example.com`,
    role: "admin",
  });
  return orgId;
}

async function seedClient(slug: string, userId = TEST_USER_ID) {
  const orgId = await seedOrg(`${slug}-org`, userId);
  const clientId = crypto.randomUUID();
  await dbModule.db.insert(dbModule.clientsTable).values({
    id: clientId,
    orgId,
    name: `${slug} Client`,
    domain: `${slug}.example`,
  });
  return { orgId, clientId };
}

async function seedAudit(slug: string, userId = TEST_USER_ID, status: "pending" | "running" | "completed" | "failed" = "completed") {
  const seeded = await seedClient(slug, userId);
  const auditId = crypto.randomUUID();
  await dbModule.db.insert(dbModule.auditsTable).values({
    id: auditId,
    clientId: seeded.clientId,
    url: `https://${slug}.example/`,
    status,
    seoScore: status === "completed" ? 86 : null,
    crawledPages: status === "completed" ? 3 : 0,
    completedAt: status === "completed" ? new Date() : null,
  });
  return { ...seeded, auditId };
}

async function seedIssue(
  auditId: string,
  title: string,
  severity: "critical" | "high" | "medium" | "low" | "info" = "high",
  status: "open" | "approved" | "dismissed" | "fixed" = "open",
  category: "meta" | "content" | "performance" | "links" | "structured_data" | "mobile" | "security" | "crawlability" = "meta",
) {
  const issueId = crypto.randomUUID();
  await dbModule.db.insert(dbModule.auditIssuesTable).values({
    id: issueId,
    auditId,
    url: "https://allowed.example/",
    category,
    severity,
    status,
    title,
    description: `${title} description`,
    recommendation: `${title} recommendation`,
    priorityScore: severity === "critical" ? 95 : 80,
    approvedBy: status === "approved" ? TEST_USER_ID : null,
    approvedAt: status === "approved" ? new Date() : null,
  });
  return issueId;
}

async function seedReport(auditId: string, clientId: string, title: string, status: "generating" | "ready" | "failed" = "ready") {
  const reportId = crypto.randomUUID();
  await dbModule.db.insert(dbModule.reportsTable).values({
    id: reportId,
    auditId,
    clientId,
    title,
    format: "pdf",
    status,
    summary: status === "ready" ? `${title} summary` : null,
    downloadUrl: status === "ready" ? `/api/reports/${reportId}/download` : null,
  });
  return reportId;
}

async function seedGscIntegration(orgId: string, options: { accessToken?: string; refreshToken?: string; expiresAt?: Date } = {}) {
  const integrationId = crypto.randomUUID();
  await dbModule.db.insert(dbModule.orgIntegrationsTable).values({
    id: integrationId,
    orgId,
    provider: "google_search_console",
    encryptedAccessToken: encryptSecret(options.accessToken ?? "gsc-access-token"),
    encryptedRefreshToken: options.refreshToken ? encryptSecret(options.refreshToken) : null,
    tokenExpiresAt: options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    scopes: "https://www.googleapis.com/auth/webmasters.readonly",
    metadata: { tokenType: "Bearer" },
    isActive: true,
  });
  return integrationId;
}

async function seedAiProvider(
  orgId: string,
  options: { provider?: "openai" | "anthropic" | "gemini" | "ollama" | "custom"; model?: string; apiKey?: string; baseUrl?: string; isDefault?: boolean } = {},
) {
  const providerId = crypto.randomUUID();
  await dbModule.db.insert(dbModule.aiProvidersTable).values({
    id: providerId,
    orgId,
    name: `${options.provider ?? "ollama"} test provider`,
    provider: options.provider ?? "ollama",
    model: options.model ?? "llama3",
    encryptedApiKey: options.apiKey ? encryptSecret(options.apiKey) : null,
    baseUrl: options.baseUrl ?? "http://localhost:11434",
    isActive: true,
    isDefault: options.isDefault ?? true,
  });
  return providerId;
}

async function waitForAuditCompleted(auditId: string, userId = TEST_USER_ID) {
  const deadline = Date.now() + 5000;
  let lastRes: request.Response | null = null;

  while (Date.now() < deadline) {
    lastRes = await request(app)
      .get(`/api/audits/${auditId}`)
      .set("x-test-user-id", userId);

    if (lastRes.status === 200 && ["completed", "failed"].includes(lastRes.body.status)) {
      return lastRes;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Audit ${auditId} did not finish. Last response: ${JSON.stringify(lastRes?.body)}`);
}

async function waitForReportReady(reportId: string, userId = TEST_USER_ID) {
  const deadline = Date.now() + 5000;
  let lastRes: request.Response | null = null;

  while (Date.now() < deadline) {
    lastRes = await request(app)
      .get(`/api/reports/${reportId}`)
      .set("x-test-user-id", userId);

    if (lastRes.status === 200 && lastRes.body.status === "ready") {
      return lastRes;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Report ${reportId} did not become ready. Last response: ${JSON.stringify(lastRes?.body)}`);
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.CLERK_PUBLISHABLE_KEY = "pk_test_local";
  process.env.ENCRYPTION_KEY = "test-encryption-key";
  process.env.API_BASE_URL = "http://localhost:18080";

  if (!process.env.DATABASE_URL) {
    containerName = `seorx-api-test-${Date.now()}`;
    run("docker", [
      "run",
      "--name",
      containerName,
      "-e",
      "POSTGRES_USER=seorx",
      "-e",
      "POSTGRES_PASSWORD=seorx",
      "-e",
      "POSTGRES_DB=seorx",
      "-p",
      "55433:5432",
      "-d",
      "postgres:16",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    process.env.DATABASE_URL = "postgres://seorx:seorx@localhost:55433/seorx";
  }

  run("corepack", ["pnpm", "--filter", "@workspace/db", "run", "migrate"], {
    DATABASE_URL: process.env.DATABASE_URL,
  });

  dbModule = await import("@workspace/db");
  app = (await import("../app")).default;
}, 60_000);

afterAll(async () => {
  if (dbModule?.pool) {
    await dbModule.pool.end();
  }
  if (containerName) {
    run("docker", ["rm", "-f", containerName]);
  }
}, 30_000);

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.PAGESPEED_API_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("production-critical API behavior", () => {
  it("requires auth for protected client routes", async () => {
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
  });

  it("creates and updates the authenticated user profile", async () => {
    const getRes = await request(app)
      .get("/api/auth/me")
      .set("x-test-user-id", TEST_USER_ID);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({
      clerkId: TEST_USER_ID,
      email: "test-user-1@example.com",
      firstName: "Test",
      lastName: "User",
    });

    const updateRes = await request(app)
      .put("/api/auth/me")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ firstName: "Dana", lastName: "North" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({
      clerkId: TEST_USER_ID,
      email: "test-user-1@example.com",
      firstName: "Dana",
      lastName: "North",
    });
  });

  it("manages developer API keys without exposing hashes and authorizes active keys", async () => {
    const orgId = await seedOrg("api-key-org");
    const blockedOrgId = await seedOrg("api-key-private-org", OTHER_USER_ID);

    const blockedListRes = await request(app)
      .get(`/api/api-keys?orgId=${blockedOrgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(blockedListRes.status).toBe(403);

    const createRes = await request(app)
      .post("/api/api-keys")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ orgId, name: "Production automation" });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      orgId,
      name: "Production automation",
      message: "Store this key securely — it will not be shown again.",
    });
    expect(createRes.body.key).toMatch(/^srx_/);
    expect(createRes.body.prefix).toBe(createRes.body.key.slice(0, 12));

    const listRes = await request(app)
      .get(`/api/api-keys?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(listRes.status).toBe(200);
    const listedKeys = ListApiKeysResponse.parse(listRes.body);
    expect(listedKeys).toHaveLength(1);
    expect(listedKeys[0]).toMatchObject({
      orgId,
      name: "Production automation",
      keyPrefix: createRes.body.prefix,
      isActive: true,
    });
    expect(listRes.body[0]).not.toHaveProperty("keyHash");
    expect(listRes.body[0]).not.toHaveProperty("key");

    const authorizeRes = await request(app)
      .get("/api/developer/authorize")
      .set("Authorization", `Bearer ${createRes.body.key}`);

    expect(authorizeRes.status).toBe(200);
    expect(AuthorizeDeveloperApiKeyResponse.parse(authorizeRes.body)).toMatchObject({
      ok: true,
      orgId,
      orgName: "api-key-org",
      keyPrefix: createRes.body.prefix,
      role: "developer",
    });

    const updatedListRes = await request(app)
      .get(`/api/api-keys?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);
    const keyId = ListApiKeysResponse.parse(updatedListRes.body)[0]?.id;
    expect(keyId).toBeTruthy();

    const deactivateRes = await request(app)
      .patch(`/api/api-keys/${keyId}`)
      .set("x-test-user-id", TEST_USER_ID)
      .send({ isActive: false });

    expect(deactivateRes.status).toBe(200);
    expect(UpdateApiKeyResponse.parse(deactivateRes.body)).toMatchObject({
      id: keyId,
      orgId,
      isActive: false,
    });
    expect(deactivateRes.body).not.toHaveProperty("keyHash");

    const inactiveAuthorizeRes = await request(app)
      .get("/api/developer/authorize")
      .set("Authorization", `Bearer ${createRes.body.key}`);

    expect(inactiveAuthorizeRes.status).toBe(401);
    expect(inactiveAuthorizeRes.body).toMatchObject({
      error: "Unauthorized",
      message: "Invalid or inactive API key",
    });
  });

  it("allows superadmins to manage API keys across organizations without membership rows", async () => {
    const superadminUserId = `superadmin-${crypto.randomUUID()}`;
    await dbModule.db.insert(dbModule.usersTable).values({
      id: crypto.randomUUID(),
      clerkId: superadminUserId,
      email: `${superadminUserId}@example.com`,
      role: "superadmin",
    });

    const orgId = await seedOrg(`superadmin-api-key-org-${crypto.randomUUID()}`, OTHER_USER_ID);

    const createRes = await request(app)
      .post("/api/api-keys")
      .set("x-test-user-id", superadminUserId)
      .send({ orgId, name: "Superadmin automation key" });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      orgId,
      name: "Superadmin automation key",
    });
    expect(createRes.body.key).toMatch(/^srx_/);

    const scopedListRes = await request(app)
      .get(`/api/api-keys?orgId=${orgId}`)
      .set("x-test-user-id", superadminUserId);

    expect(scopedListRes.status).toBe(200);
    const scopedKeys = ListApiKeysResponse.parse(scopedListRes.body);
    expect(scopedKeys.some((key) => key.orgId === orgId && key.name === "Superadmin automation key")).toBe(true);

    const globalListRes = await request(app)
      .get("/api/api-keys")
      .set("x-test-user-id", superadminUserId);

    expect(globalListRes.status).toBe(200);
    const globalKeys = ListApiKeysResponse.parse(globalListRes.body);
    expect(globalKeys.some((key) => key.orgId === orgId && key.name === "Superadmin automation key")).toBe(true);
  });

  it("scopes clients to the authenticated user's organizations", async () => {
    const allowedOrgId = await seedOrg("allowed-org");
    const blockedOrgId = await seedOrg("blocked-org", OTHER_USER_ID);

    await dbModule.db.insert(dbModule.clientsTable).values({
      id: crypto.randomUUID(),
      orgId: allowedOrgId,
      name: "Allowed Client",
      domain: "allowed.example",
    });
    await dbModule.db.insert(dbModule.clientsTable).values({
      id: crypto.randomUUID(),
      orgId: blockedOrgId,
      name: "Blocked Client",
      domain: "blocked.example",
    });

    const res = await request(app)
      .get("/api/clients")
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.map((client: { name: string }) => client.name)).toContain("Allowed Client");
    expect(res.body.map((client: { name: string }) => client.name)).not.toContain("Blocked Client");
  });

  it("creates organizations, assigns the creator as admin, and invites members", async () => {
    const slug = `created-org-${crypto.randomUUID()}`;

    const createRes = await request(app)
      .post("/api/organizations")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ name: "Created Org", slug });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      name: "Created Org",
      slug,
      memberCount: 1,
      clientCount: 0,
      auditCount: 0,
    });

    const listRes = await request(app)
      .get("/api/organizations")
      .set("x-test-user-id", TEST_USER_ID);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((org: { id: string; myRole?: string }) => org.id === createRes.body.id && org.myRole === "admin")).toBe(true);

    const inviteRes = await request(app)
      .post(`/api/organizations/${createRes.body.id}/members`)
      .set("x-test-user-id", TEST_USER_ID)
      .send({ email: "teammate@example.com", role: "agency" });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body).toMatchObject({
      email: "teammate@example.com",
      role: "agency",
    });
    expect(inviteRes.body.joinedAt).toBeTruthy();

    const membersRes = await request(app)
      .get(`/api/organizations/${createRes.body.id}/members`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(membersRes.status).toBe(200);
    expect(membersRes.body.map((member: { email: string }) => member.email)).toEqual(
      expect.arrayContaining(["test-user-1@example.com", "teammate@example.com"]),
    );
  });

  it("rejects organization member access outside membership", async () => {
    const blockedOrgId = await seedOrg(`member-private-${crypto.randomUUID()}`, OTHER_USER_ID);

    const listRes = await request(app)
      .get(`/api/organizations/${blockedOrgId}/members`)
      .set("x-test-user-id", TEST_USER_ID);
    const inviteRes = await request(app)
      .post(`/api/organizations/${blockedOrgId}/members`)
      .set("x-test-user-id", TEST_USER_ID)
      .send({ email: "blocked@example.com", role: "viewer" });

    expect(listRes.status).toBe(403);
    expect(inviteRes.status).toBe(403);
  });

  it("creates audits only for accessible clients and returns the UI audit shape", async () => {
    const { clientId } = await seedClient(`audit-allowed-${crypto.randomUUID()}`);
    const blocked = await seedClient(`audit-blocked-${crypto.randomUUID()}`, OTHER_USER_ID);

    const blockedRes = await request(app)
      .post("/api/audits")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ clientId: blocked.clientId, url: "https://blocked.example" });

    expect(blockedRes.status).toBe(403);

    const createRes = await request(app)
      .post("/api/audits")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ clientId, url: "allowed.example", maxPages: 7, includePageSpeed: false });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      clientId,
      clientName: expect.any(String),
      url: "https://allowed.example/",
      status: "pending",
      issueCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    });
    expect(createRes.body.id).toBeTruthy();

    const invalidRes = await request(app)
      .post("/api/audits")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ clientId, url: "not a real url" });

    expect(invalidRes.status).toBe(400);
  });

  it("lists audits with issue counts and excludes other organizations", async () => {
    const allowed = await seedAudit(`audit-list-allowed-${crypto.randomUUID()}`);
    const blocked = await seedAudit(`audit-list-blocked-${crypto.randomUUID()}`, OTHER_USER_ID);
    await seedIssue(allowed.auditId, "Allowed critical issue", "critical");
    await seedIssue(allowed.auditId, "Allowed high issue", "high");
    await seedIssue(blocked.auditId, "Blocked critical issue", "critical");

    const res = await request(app)
      .get("/api/audits")
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      limit: 20,
      offset: 0,
    });
    const allowedAudit = res.body.items.find((audit: { id: string }) => audit.id === allowed.auditId);
    expect(allowedAudit).toMatchObject({
      id: allowed.auditId,
      clientId: allowed.clientId,
      clientName: expect.any(String),
      issueCount: 2,
      criticalCount: 1,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
    });
    expect(res.body.items.some((audit: { id: string }) => audit.id === blocked.auditId)).toBe(false);
  });

  it("approves and dismisses issues only when the user can access the audit", async () => {
    const allowed = await seedAudit(`issue-allowed-${crypto.randomUUID()}`);
    const blocked = await seedAudit(`issue-blocked-${crypto.randomUUID()}`, OTHER_USER_ID);
    const allowedIssueId = await seedIssue(allowed.auditId, "Allowed issue", "high");
    const blockedIssueId = await seedIssue(blocked.auditId, "Blocked issue", "critical");

    const approveRes = await request(app)
      .put(`/api/issues/${allowedIssueId}/approve`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body).toMatchObject({
      id: allowedIssueId,
      status: "approved",
      approvedBy: TEST_USER_ID,
    });
    expect(approveRes.body.approvedAt).toBeTruthy();

    const dismissBlockedRes = await request(app)
      .put(`/api/issues/${blockedIssueId}/dismiss`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(dismissBlockedRes.status).toBe(403);

    const dismissRes = await request(app)
      .put(`/api/issues/${allowedIssueId}/dismiss`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(dismissRes.status).toBe(200);
    expect(dismissRes.body).toMatchObject({
      id: allowedIssueId,
      status: "dismissed",
    });
  });

  it("returns report list/detail/download contracts only for accessible audits", async () => {
    const allowed = await seedAudit(`report-allowed-${crypto.randomUUID()}`);
    const blocked = await seedAudit(`report-blocked-${crypto.randomUUID()}`, OTHER_USER_ID);
    await seedIssue(allowed.auditId, "Top report issue", "critical");
    await seedIssue(allowed.auditId, "Second report issue", "high");
    const allowedReportId = await seedReport(allowed.auditId, allowed.clientId, "Allowed Report");
    const blockedReportId = await seedReport(blocked.auditId, blocked.clientId, "Blocked Report");

    const listRes = await request(app)
      .get("/api/reports")
      .set("x-test-user-id", TEST_USER_ID);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((report: { id: string }) => report.id === allowedReportId)).toBe(true);
    expect(listRes.body.some((report: { id: string }) => report.id === blockedReportId)).toBe(false);
    const listed = listRes.body.find((report: { id: string }) => report.id === allowedReportId);
    expect(listed).toMatchObject({
      id: allowedReportId,
      auditId: allowed.auditId,
      clientId: allowed.clientId,
      clientName: expect.any(String),
      title: "Allowed Report",
      format: "pdf",
      status: "ready",
      downloadUrl: `/api/reports/${allowedReportId}/download`,
    });

    const detailRes = await request(app)
      .get(`/api/reports/${allowedReportId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body).toMatchObject({
      id: allowedReportId,
      summary: "Allowed Report summary",
      issueCount: 2,
      topIssues: expect.any(Array),
    });
    expect(detailRes.body.topIssues[0]).toMatchObject({ title: "Top report issue", severity: "critical" });

    const blockedDetailRes = await request(app)
      .get(`/api/reports/${blockedReportId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(blockedDetailRes.status).toBe(403);

    const downloadRes = await request(app)
      .get(`/api/reports/${allowedReportId}/download`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers["content-type"]).toContain("application/pdf");
    expect(downloadRes.headers["content-disposition"]).toContain("Allowed-Report.pdf");
  });

  it("creates reports with generating-to-ready transitions matching the generated contract", async () => {
    const { auditId, clientId } = await seedAudit(`report-create-${crypto.randomUUID()}`);
    await seedIssue(auditId, "Critical report finding", "critical");
    await seedIssue(auditId, "Approved report finding", "high", "approved");

    const createRes = await request(app)
      .post("/api/reports")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        auditId,
        title: "Async Report Contract",
        format: "pdf",
        includeAiSummary: false,
      });

    expect(createRes.status).toBe(201);
    const created = ListReportsResponseItem.parse(createRes.body);
    expect(created).toMatchObject({
      auditId,
      clientId,
      clientName: expect.any(String),
      title: "Async Report Contract",
      format: "pdf",
      status: "generating",
      downloadUrl: null,
    });

    const notReadyDownloadRes = await request(app)
      .get(`/api/reports/${created.id}/download`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(notReadyDownloadRes.status).toBe(409);
    expect(notReadyDownloadRes.body).toEqual({ error: "Report not ready yet" });

    const generatingListRes = await request(app)
      .get(`/api/reports?auditId=${auditId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(generatingListRes.status).toBe(200);
    const generatingReports = ListReportsResponse.parse(generatingListRes.body);
    expect(generatingReports).toHaveLength(1);
    expect(generatingReports[0]).toMatchObject({ id: created.id, status: "generating", downloadUrl: null });

    const readyDetailRes = await waitForReportReady(created.id);
    const readyDetail = GetReportResponse.parse(readyDetailRes.body);
    expect(readyDetail).toMatchObject({
      id: created.id,
      auditId,
      clientId,
      clientName: expect.any(String),
      title: "Async Report Contract",
      format: "pdf",
      status: "ready",
      downloadUrl: `/api/reports/${created.id}/download`,
      issueCount: 2,
      topIssues: expect.any(Array),
    });
    expect(readyDetail.summary).toContain("2 total issues");
    expect(readyDetail.summary).toContain("1 critical");
    expect(readyDetail.summary).toContain("1 issue has been approved");
    expect(readyDetail.topIssues?.[0]).toMatchObject({ title: "Critical report finding", severity: "critical" });

    const readyDownloadRes = await request(app)
      .get(`/api/reports/${created.id}/download`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(readyDownloadRes.status).toBe(200);
    expect(readyDownloadRes.headers["content-type"]).toContain("application/pdf");
  });

  it("returns empty dashboard aggregate shapes for users with no organizations", async () => {
    const emptyUserId = `dashboard-empty-${crypto.randomUUID()}`;

    const [statsRes, recentRes, breakdownRes, trendsRes] = await Promise.all([
      request(app).get("/api/dashboard/stats").set("x-test-user-id", emptyUserId),
      request(app).get("/api/dashboard/recent-audits?limit=3").set("x-test-user-id", emptyUserId),
      request(app).get("/api/dashboard/issue-breakdown").set("x-test-user-id", emptyUserId),
      request(app).get("/api/dashboard/score-trends?days=7").set("x-test-user-id", emptyUserId),
    ]);

    expect(statsRes.status).toBe(200);
    expect(GetDashboardStatsResponse.parse(statsRes.body)).toEqual({
      totalClients: 0,
      totalAudits: 0,
      totalIssues: 0,
      criticalIssues: 0,
      resolvedIssues: 0,
      avgSeoScore: 0,
      auditsThisMonth: 0,
      pendingApprovals: 0,
    });
    expect(recentRes.status).toBe(200);
    expect(GetRecentAuditsResponse.parse(recentRes.body)).toEqual([]);
    expect(breakdownRes.status).toBe(200);
    expect(GetIssueBreakdownResponse.parse(breakdownRes.body)).toEqual({ bySeverity: [], byCategory: [] });
    expect(trendsRes.status).toBe(200);
    expect(GetScoreTrendsResponse.parse(trendsRes.body)).toEqual([]);
  });

  it("returns dashboard aggregate response shapes scoped to the user's organizations", async () => {
    const dashboardUserId = `dashboard-user-${crypto.randomUUID()}`;
    const blockedUserId = `dashboard-blocked-${crypto.randomUUID()}`;
    const allowedOne = await seedAudit(`dashboard-allowed-one-${crypto.randomUUID()}`, dashboardUserId);
    const allowedTwo = await seedAudit(`dashboard-allowed-two-${crypto.randomUUID()}`, dashboardUserId);
    const blocked = await seedAudit(`dashboard-blocked-${crypto.randomUUID()}`, blockedUserId);

    await dbModule.db.update(dbModule.clientsTable).set({ seoScore: 80 }).where(eq(dbModule.clientsTable.id, allowedOne.clientId));
    await dbModule.db.update(dbModule.clientsTable).set({ seoScore: 90 }).where(eq(dbModule.clientsTable.id, allowedTwo.clientId));
    await dbModule.db.update(dbModule.clientsTable).set({ seoScore: 10 }).where(eq(dbModule.clientsTable.id, blocked.clientId));
    await dbModule.db.update(dbModule.auditsTable).set({ createdAt: new Date(), completedAt: new Date(), seoScore: 80 }).where(eq(dbModule.auditsTable.id, allowedOne.auditId));
    await dbModule.db.update(dbModule.auditsTable).set({ createdAt: new Date(), completedAt: new Date(), seoScore: 90 }).where(eq(dbModule.auditsTable.id, allowedTwo.auditId));
    await dbModule.db.update(dbModule.auditsTable).set({ createdAt: new Date(), completedAt: new Date(), seoScore: 10 }).where(eq(dbModule.auditsTable.id, blocked.auditId));

    await seedIssue(allowedOne.auditId, "Dashboard critical open", "critical", "open", "meta");
    await seedIssue(allowedOne.auditId, "Dashboard high approved", "high", "approved", "content");
    await seedIssue(allowedTwo.auditId, "Dashboard medium fixed", "medium", "fixed", "performance");
    await seedIssue(allowedTwo.auditId, "Dashboard low dismissed", "low", "dismissed", "links");
    await seedIssue(blocked.auditId, "Blocked dashboard critical", "critical", "open", "security");

    const statsRes = await request(app)
      .get("/api/dashboard/stats")
      .set("x-test-user-id", dashboardUserId);

    expect(statsRes.status).toBe(200);
    const stats = GetDashboardStatsResponse.parse(statsRes.body);
    expect(stats).toEqual({
      totalClients: 2,
      totalAudits: 2,
      totalIssues: 4,
      criticalIssues: 1,
      resolvedIssues: 3,
      avgSeoScore: 85,
      auditsThisMonth: 2,
      pendingApprovals: 1,
    });

    const recentRes = await request(app)
      .get("/api/dashboard/recent-audits?limit=1")
      .set("x-test-user-id", dashboardUserId);

    expect(recentRes.status).toBe(200);
    const recentAudits = GetRecentAuditsResponse.parse(recentRes.body);
    expect(recentAudits).toHaveLength(1);
    expect([allowedOne.auditId, allowedTwo.auditId]).toContain(recentAudits[0].id);
    expect(recentAudits[0]).toMatchObject({
      clientName: expect.any(String),
      issueCount: expect.any(Number),
      criticalCount: expect.any(Number),
      highCount: expect.any(Number),
      mediumCount: expect.any(Number),
      lowCount: expect.any(Number),
    });
    expect(recentAudits.some((audit) => audit.id === blocked.auditId)).toBe(false);

    const breakdownRes = await request(app)
      .get("/api/dashboard/issue-breakdown")
      .set("x-test-user-id", dashboardUserId);

    expect(breakdownRes.status).toBe(200);
    const issueBreakdown = GetIssueBreakdownResponse.parse(breakdownRes.body);
    expect(Object.fromEntries(issueBreakdown.bySeverity.map((item) => [item.severity, item.count]))).toMatchObject({
      critical: 1,
      high: 1,
      medium: 1,
      low: 1,
    });
    expect(Object.fromEntries(issueBreakdown.byCategory.map((item) => [item.category, item.count]))).toMatchObject({
      meta: 1,
      content: 1,
      performance: 1,
      links: 1,
    });
    expect(issueBreakdown.byCategory.some((item) => item.category === "security")).toBe(false);

    const trendsRes = await request(app)
      .get("/api/dashboard/score-trends?days=30")
      .set("x-test-user-id", dashboardUserId);

    expect(trendsRes.status).toBe(200);
    expect(trendsRes.body[0]).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      avgScore: 85,
      auditCount: 2,
    });
    const scoreTrends = GetScoreTrendsResponse.parse(trendsRes.body);
    expect(scoreTrends).toHaveLength(1);
    expect(scoreTrends[0]).toMatchObject({
      date: expect.any(Date),
      avgScore: 85,
      auditCount: 2,
    });
  });

  it("returns cached or synthetic PageSpeed shapes without a live API key", async () => {
    const { auditId } = await seedAudit(`pagespeed-fallback-${crypto.randomUUID()}`);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const res = await request(app)
      .get(`/api/pagespeed/${auditId}?device=mobile`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      auditId,
      url: expect.stringMatching(/^https:\/\//),
      isReal: false,
      performanceScore: expect.any(Number),
      accessibilityScore: expect.any(Number),
      bestPracticesScore: expect.any(Number),
      seoScore: expect.any(Number),
    });
    expect(GetPageSpeedResultsResponse.parse(res.body)).toMatchObject({
      auditId,
      fetchedAt: expect.any(Date),
    });
    expect(fetchMock).not.toHaveBeenCalled();

    const cachedRes = await request(app)
      .get(`/api/pagespeed/${auditId}?device=mobile`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(cachedRes.status).toBe(200);
    expect(cachedRes.body.id).toBe(res.body.id);
    expect(cachedRes.body.isReal).toBe(false);
    expect(GetPageSpeedResultsResponse.parse(cachedRes.body)).toMatchObject({ auditId });
  });

  it("fetches live PageSpeed metrics when a key is configured and preserves contract shape", async () => {
    const { auditId } = await seedAudit(`pagespeed-live-${crypto.randomUUID()}`);
    process.env.PAGESPEED_API_KEY = "pagespeed-test-key";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
      expect(url.searchParams.get("strategy")).toBe("desktop");
      expect(url.searchParams.get("key")).toBe("pagespeed-test-key");
      expect(url.searchParams.getAll("category")).toEqual(["performance", "accessibility", "best-practices", "seo"]);

      return new Response(JSON.stringify({
        lighthouseResult: {
          categories: {
            performance: { score: 0.91 },
            accessibility: { score: 0.98 },
            "best-practices": { score: 0.87 },
            seo: { score: 0.93 },
          },
          audits: {
            "first-contentful-paint": { numericValue: 1100 },
            "largest-contentful-paint": { numericValue: 2400 },
            "cumulative-layout-shift": { numericValue: 0.08 },
            "total-blocking-time": { numericValue: 130 },
            "speed-index": { numericValue: 1800 },
          },
        },
        loadingExperience: {
          metrics: {
            FIRST_CONTENTFUL_PAINT_MS: { percentile: 1000 },
            LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2200 },
            FIRST_INPUT_DELAY_MS: { percentile: 20 },
            CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 7 },
            EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 450 },
          },
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const res = await request(app)
      .get(`/api/pagespeed/${auditId}?device=desktop`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      auditId,
      isReal: true,
      performanceScore: 91,
      accessibilityScore: 98,
      bestPracticesScore: 87,
      seoScore: 93,
      fcp: 1,
      lcp: 2.2,
      cls: 0.07,
      tbt: 130,
      ttfb: 0.45,
    });
    expect(GetPageSpeedResultsResponse.parse(res.body)).toMatchObject({
      auditId,
      performanceScore: 91,
      fetchedAt: expect.any(Date),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cachedRes = await request(app)
      .get(`/api/pagespeed/${auditId}?device=desktop`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(cachedRes.status).toBe(200);
    expect(cachedRes.body.id).toBe(res.body.id);
    expect(cachedRes.body.isReal).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to synthetic PageSpeed metrics when the live API fails", async () => {
    const { auditId } = await seedAudit(`pagespeed-api-fail-${crypto.randomUUID()}`);
    process.env.PAGESPEED_API_KEY = "pagespeed-test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await request(app)
      .get(`/api/pagespeed/${auditId}?device=mobile`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      auditId,
      isReal: false,
      performanceScore: expect.any(Number),
      seoScore: expect.any(Number),
    });
    expect(GetPageSpeedResultsResponse.parse(res.body)).toMatchObject({ auditId });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds AI recommendations during audits when an active provider succeeds", async () => {
    const { orgId, clientId } = await seedClient(`ai-live-${crypto.randomUUID()}`);
    await seedAiProvider(orgId, { provider: "ollama", model: "llama3", baseUrl: "http://ollama.test" });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      expect(String(input)).toBe("http://ollama.test/api/chat");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ model: "llama3", stream: false });
      expect(body.messages[1].content).toContain("Missing meta description");

      return new Response(JSON.stringify({
        message: {
          content: "Add a unique, keyword-aligned meta description and validate it in the next crawl.",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const createRes = await request(app)
      .post("/api/audits")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ clientId, url: "ai-live.example", maxPages: 3, includePageSpeed: false });

    expect(createRes.status).toBe(201);
    const detailRes = await waitForAuditCompleted(createRes.body.id);
    expect(detailRes.body.status).toBe("completed");
    expect(detailRes.body.aiProviderUsed).toBe("ollama/llama3");
    expect(detailRes.body.issues[0]).toMatchObject({
      title: "Missing meta description",
      aiRecommendation: "Add a unique, keyword-aligned meta description and validate it in the next crawl.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("completes audits without AI recommendations when provider calls fail", async () => {
    const { orgId, clientId } = await seedClient(`ai-fallback-${crypto.randomUUID()}`);
    await seedAiProvider(orgId, { provider: "ollama", model: "llama3", baseUrl: "http://ollama.test" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "model unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const createRes = await request(app)
      .post("/api/audits")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ clientId, url: "ai-fallback.example", maxPages: 3, includePageSpeed: false });

    expect(createRes.status).toBe(201);
    const detailRes = await waitForAuditCompleted(createRes.body.id);
    expect(detailRes.body.status).toBe("completed");
    expect(detailRes.body.aiProviderUsed).toBe("ollama/llama3");
    expect(detailRes.body.issues[0]).toMatchObject({
      title: "Missing meta description",
      aiRecommendation: null,
      recommendation: "Add a concise meta description.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("persists outbound webhooks and hides encrypted secrets", async () => {
    const orgId = await seedOrg("webhook-org");

    const createRes = await request(app)
      .post("/api/integrations/webhooks")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        url: "https://example.com/webhook",
        events: ["audit.completed", "report.ready"],
        secret: "super-secret",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();
    expect(createRes.body.encryptedSecret).toBeUndefined();

    const stored = await dbModule.db.query.orgWebhooksTable.findFirst({
      where: eq(dbModule.orgWebhooksTable.id, createRes.body.id),
    });
    expect(stored?.encryptedSecret).toMatch(/^gcm:/);

    const listRes = await request(app)
      .get(`/api/integrations/webhooks?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].encryptedSecret).toBeUndefined();
    expect(ListWebhooksResponse.parse(listRes.body)[0]).toMatchObject({
      id: createRes.body.id,
      orgId,
      url: "https://example.com/webhook",
      events: ["audit.completed", "report.ready"],
      isActive: true,
    });
  });

  it("sends test webhooks and persists delivery status for registered targets", async () => {
    const orgId = await seedOrg("webhook-test-org");
    const createRes = await request(app)
      .post("/api/integrations/webhooks")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        url: "https://example.com/receive",
        events: ["audit.completed"],
      });

    expect(createRes.status).toBe(201);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      expect(String(input)).toBe("https://example.com/receive");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
        "X-SEORx-Event": "audit.completed",
        "X-SEORx-Test": "true",
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        event: "audit.completed",
        data: { auditId: "test-audit-id", clientName: "Test Client" },
      });
      return new Response("accepted", { status: 202 });
    });

    const testRes = await request(app)
      .post("/api/integrations/webhooks/test")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ webhookId: createRes.body.id });

    expect(testRes.status).toBe(200);
    expect(TestWebhookResponse.parse(testRes.body)).toMatchObject({
      success: true,
      statusCode: 202,
      orgId,
      message: "Webhook delivered successfully",
    });

    const listRes = await request(app)
      .get(`/api/integrations/webhooks?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(listRes.status).toBe(200);
    expect(ListWebhooksResponse.parse(listRes.body)[0]).toMatchObject({
      id: createRes.body.id,
      lastStatusCode: 202,
      lastDeliveredAt: expect.any(Date),
      lastError: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("records failed test webhook delivery without exposing secrets", async () => {
    const orgId = await seedOrg("webhook-fail-org");
    const createRes = await request(app)
      .post("/api/integrations/webhooks")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        url: "https://example.com/fail",
        events: ["audit.completed"],
        secret: "delivery-secret",
      });

    expect(createRes.status).toBe(201);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));

    const testRes = await request(app)
      .post("/api/integrations/webhooks/test")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ webhookId: createRes.body.id });

    expect(testRes.status).toBe(200);
    expect(TestWebhookResponse.parse(testRes.body)).toMatchObject({
      success: false,
      statusCode: 500,
      orgId,
      message: "Target returned 500",
    });

    const listRes = await request(app)
      .get(`/api/integrations/webhooks?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(listRes.status).toBe(200);
    expect(listRes.body[0].encryptedSecret).toBeUndefined();
    expect(ListWebhooksResponse.parse(listRes.body)[0]).toMatchObject({
      lastStatusCode: 500,
      lastDeliveredAt: expect.any(Date),
      lastError: "Target returned 500",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports GSC as unavailable before OAuth tokens are connected", async () => {
    const orgId = await seedOrg("gsc-org");

    const propertiesRes = await request(app)
      .get(`/api/integrations/gsc/properties?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(propertiesRes.status).toBe(200);
    expect(ListGoogleSearchConsolePropertiesResponse.parse(propertiesRes.body)).toMatchObject({
      available: false,
      properties: [],
    });

    const analyticsRes = await request(app)
      .post("/api/integrations/gsc/analytics")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        siteUrl: "https://example.com/",
        startDate: "2026-05-01",
        endDate: "2026-05-22",
      });

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body).toMatchObject({
      available: false,
      siteUrl: "https://example.com/",
      startDate: "2026-05-01",
      endDate: "2026-05-22",
      rows: [],
    });
    expect(GetGoogleSearchConsoleAnalyticsResponse.parse(analyticsRes.body)).toMatchObject({
      available: false,
      siteUrl: "https://example.com/",
      startDate: expect.any(Date),
      endDate: expect.any(Date),
      rows: [],
    });
  });

  it("builds GSC OAuth redirects only for configured and accessible organizations", async () => {
    const orgId = await seedOrg("gsc-connect-org");

    const unavailableRes = await request(app)
      .get(`/api/integrations/gsc/connect?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(unavailableRes.status).toBe(503);
    expect(unavailableRes.body).toMatchObject({ error: "Not configured" });

    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";

    const redirectRes = await request(app)
      .get(`/api/integrations/gsc/connect?orgId=${orgId}&returnUrl=${encodeURIComponent("/integrations")}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(redirectRes.status).toBe(302);
    const location = new URL(redirectRes.headers.location);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("client_id")).toBe("google-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:18080/api/integrations/gsc/callback");
    expect(location.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/webmasters.readonly");
    expect(JSON.parse(location.searchParams.get("state") ?? "{}")).toEqual({ orgId, returnUrl: "/integrations" });

    const blockedOrgId = await seedOrg("gsc-connect-private", OTHER_USER_ID);
    const blockedRes = await request(app)
      .get(`/api/integrations/gsc/connect?orgId=${blockedOrgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(blockedRes.status).toBe(403);
  });

  it("returns connected GSC properties and analytics through generated response schemas", async () => {
    const orgId = await seedOrg("gsc-connected-org");
    await seedGscIntegration(orgId, { accessToken: "connected-gsc-token" });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect(init?.headers).toMatchObject({ Authorization: "Bearer connected-gsc-token" });

      if (url === "https://www.googleapis.com/webmasters/v3/sites") {
        return new Response(JSON.stringify({
          siteEntry: [
            { siteUrl: "https://example.com/", permissionLevel: "siteFullUser" },
            { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.includes("/searchAnalytics/query")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          startDate: "2026-05-01",
          endDate: "2026-05-22",
          dimensions: ["query"],
        });
        return new Response(JSON.stringify({
          rows: [
            { keys: ["seo audit"], clicks: 42, impressions: 1200, ctr: 0.035, position: 4.2 },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const propertiesRes = await request(app)
      .get(`/api/integrations/gsc/properties?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(propertiesRes.status).toBe(200);
    expect(ListGoogleSearchConsolePropertiesResponse.parse(propertiesRes.body)).toEqual({
      available: true,
      properties: [
        { siteUrl: "https://example.com/", permissionLevel: "siteFullUser" },
        { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
      ],
    });

    const analyticsRes = await request(app)
      .post("/api/integrations/gsc/analytics")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        siteUrl: "https://example.com/",
        startDate: "2026-05-01",
        endDate: "2026-05-22",
        dimensions: ["query"],
      });

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body).toMatchObject({
      available: true,
      siteUrl: "https://example.com/",
      startDate: "2026-05-01",
      endDate: "2026-05-22",
      rows: [{ keys: ["seo audit"], clicks: 42, impressions: 1200, ctr: 0.035, position: 4.2 }],
    });
    expect(GetGoogleSearchConsoleAnalyticsResponse.parse(analyticsRes.body)).toMatchObject({
      available: true,
      siteUrl: "https://example.com/",
      startDate: expect.any(Date),
      endDate: expect.any(Date),
      rows: [{ keys: ["seo audit"], clicks: 42, impressions: 1200, ctr: 0.035, position: 4.2 }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes expired GSC tokens before requesting properties", async () => {
    const orgId = await seedOrg("gsc-refresh-org");
    await seedGscIntegration(orgId, {
      accessToken: "expired-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() - 60_000),
    });
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        expect(String(init?.body)).toContain("refresh_token=refresh-token");
        return new Response(JSON.stringify({
          access_token: "refreshed-token",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/webmasters.readonly",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url === "https://www.googleapis.com/webmasters/v3/sites") {
        expect(init?.headers).toMatchObject({ Authorization: "Bearer refreshed-token" });
        return new Response(JSON.stringify({
          siteEntry: [{ siteUrl: "https://refreshed.example/", permissionLevel: "siteFullUser" }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const res = await request(app)
      .get(`/api/integrations/gsc/properties?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(ListGoogleSearchConsolePropertiesResponse.parse(res.body)).toMatchObject({
      available: true,
      properties: [{ siteUrl: "https://refreshed.example/", permissionLevel: "siteFullUser" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns 502 when GSC analytics upstream responds with a failure status", async () => {
    const orgId = await seedOrg("gsc-upstream-fail-org");
    await seedGscIntegration(orgId, { accessToken: "failing-gsc-token" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "quota exceeded" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const analyticsRes = await request(app)
      .post("/api/integrations/gsc/analytics")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        siteUrl: "https://example.com/",
        startDate: "2026-05-01",
        endDate: "2026-05-22",
        dimensions: ["query"],
      });

    expect(analyticsRes.status).toBe(502);
    expect(analyticsRes.body).toMatchObject({
      error: "Google Search Console analytics request failed",
      statusCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on internal database query failure while preserving API contract shape", async () => {
    const { clientId } = await seedClient(`client-db-failure-${crypto.randomUUID()}`);
    const findFirstSpy = vi
      .spyOn(dbModule.db.query.clientsTable, "findFirst")
      .mockRejectedValueOnce(new Error("synthetic db timeout"));

    const res = await request(app)
      .get(`/api/clients/${clientId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(findFirstSpy).toHaveBeenCalled();
  });

  it("rejects malformed webhook registration payloads with deterministic 400 responses", async () => {
    const orgId = await seedOrg("webhook-validation-org");
    const res = await request(app)
      .post("/api/integrations/webhooks")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        url: "https://example.com/webhook",
        events: ["audit.completed", "not-a-real-event"],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid events:");
  });

  it("rejects integration access for organizations outside membership", async () => {
    const blockedOrgId = await seedOrg("private-org", OTHER_USER_ID);

    const res = await request(app)
      .get(`/api/integrations/webhooks?orgId=${blockedOrgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(403);
  });

  it("returns billing plans and safe disabled checkout states", async () => {
    const orgId = await seedOrg("billing-org");
    const blockedOrgId = await seedOrg("billing-private-org", OTHER_USER_ID);

    const plansRes = await request(app).get("/api/billing/plans");
    expect(plansRes.status).toBe(200);
    expect(plansRes.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ plan: "free", auditsPerMonth: 3, clientsMax: 2 }),
      expect.objectContaining({ plan: "enterprise", auditsPerMonth: null, clientsMax: null }),
    ]));

    const invalidPlanRes = await request(app)
      .post("/api/billing/checkout")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        plan: "free",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

    expect(invalidPlanRes.status).toBe(400);
    expect(invalidPlanRes.body).toEqual({ error: "Invalid plan" });

    const blockedCheckoutRes = await request(app)
      .post("/api/billing/checkout")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId: blockedOrgId,
        plan: "starter",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

    expect(blockedCheckoutRes.status).toBe(403);

    const disabledCheckoutRes = await request(app)
      .post("/api/billing/checkout")
      .set("x-test-user-id", TEST_USER_ID)
      .send({
        orgId,
        plan: "starter",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

    expect(disabledCheckoutRes.status).toBe(503);
    expect(disabledCheckoutRes.body).toMatchObject({
      error: "Stripe not configured",
      message: "Set STRIPE_SECRET_KEY to enable billing",
    });
  });

  it("guards billing portal and Stripe webhook signature handling", async () => {
    const orgId = await seedOrg("billing-portal-org");
    const blockedOrgId = await seedOrg("billing-portal-private-org", OTHER_USER_ID);

    const blockedPortalRes = await request(app)
      .post("/api/billing/portal")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ orgId: blockedOrgId, returnUrl: "https://example.com/billing" });

    expect(blockedPortalRes.status).toBe(403);

    const noCustomerRes = await request(app)
      .post("/api/billing/portal")
      .set("x-test-user-id", TEST_USER_ID)
      .send({ orgId, returnUrl: "https://example.com/billing" });

    expect(noCustomerRes.status).toBe(400);
    expect(noCustomerRes.body).toEqual({ error: "No Stripe customer linked to this organization" });

    const unconfiguredWebhookRes = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", "t=1,v1=bad")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed" }));

    expect(unconfiguredWebhookRes.status).toBe(400);
    expect(unconfiguredWebhookRes.body).toEqual({ error: "Webhook secret not configured" });

    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const invalidSignatureRes = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", "t=1,v1=bad")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed" }));

    expect(invalidSignatureRes.status).toBe(400);
    expect(invalidSignatureRes.body).toEqual({ error: "Invalid webhook signature" });
  });

});
