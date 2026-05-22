import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";

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

async function seedIssue(auditId: string, title: string, severity: "critical" | "high" | "medium" | "low" | "info" = "high") {
  const issueId = crypto.randomUUID();
  await dbModule.db.insert(dbModule.auditIssuesTable).values({
    id: issueId,
    auditId,
    url: "https://allowed.example/",
    category: "meta",
    severity,
    status: "open",
    title,
    description: `${title} description`,
    recommendation: `${title} recommendation`,
    priorityScore: severity === "critical" ? 95 : 80,
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

  run("corepack", ["pnpm", "--filter", "@workspace/db", "run", "push-force"], {
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
  });

  it("reports GSC as unavailable before OAuth tokens are connected", async () => {
    const orgId = await seedOrg("gsc-org");

    const res = await request(app)
      .get(`/api/integrations/gsc/properties?orgId=${orgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: false, properties: [] });
  });

  it("rejects integration access for organizations outside membership", async () => {
    const blockedOrgId = await seedOrg("private-org", OTHER_USER_ID);

    const res = await request(app)
      .get(`/api/integrations/webhooks?orgId=${blockedOrgId}`)
      .set("x-test-user-id", TEST_USER_ID);

    expect(res.status).toBe(403);
  });
});
