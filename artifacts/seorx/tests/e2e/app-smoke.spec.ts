import { expect, test } from "@playwright/test";

test("@auth-config production build shows a clear auth configuration state", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.goto("/");

  await expect(page).toHaveTitle("SEORx");
  await expect(
    page.getByRole("heading", { name: "Authentication is not configured" }),
  ).toBeVisible();
  await expect(
    page.getByText("Set the Clerk publishable key for this environment, then rebuild the app."),
  ).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test("@signed-in dashboard renders live metric surfaces with mocked API data", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.route("**/api/dashboard/stats", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        totalClients: 7,
        totalAudits: 19,
        criticalIssues: 3,
        avgSeoScore: 82,
        pendingApprovals: 4,
        resolvedIssues: 41,
        auditsThisMonth: 9,
        totalIssues: 57,
      }),
    });
  });
  await page.route("**/api/dashboard/recent-audits?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "audit-1",
          clientId: "client-1",
          clientName: "Acme Dental",
          url: "https://acme.example",
          status: "completed",
          seoScore: 82,
          issueCount: 5,
          createdAt: "2026-05-10T12:00:00.000Z",
          completedAt: "2026-05-10T12:04:00.000Z",
        },
      ]),
    });
  });
  await page.route("**/api/dashboard/issue-breakdown", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bySeverity: [
          { severity: "critical", count: 3 },
          { severity: "high", count: 8 },
        ],
        byCategory: [
          { category: "technical_seo", count: 6 },
          { category: "content", count: 5 },
        ],
      }),
    });
  });
  await page.route("**/api/dashboard/score-trends?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        { date: "2026-05-08", avgScore: 74, auditCount: 2 },
        { date: "2026-05-09", avgScore: 79, auditCount: 3 },
        { date: "2026-05-10", avgScore: 82, auditCount: 4 },
      ]),
    });
  });

  await page.goto("/dashboard");

  await expect(page).toHaveTitle("SEORx");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByTestId("stat-total-clients")).toHaveText("7");
  await expect(page.getByTestId("stat-total-audits")).toHaveText("19");
  await expect(page.getByTestId("stat-critical-issues")).toHaveText("3");
  await expect(page.getByTestId("stat-avg-seo-score")).toHaveText("82");
  await expect(page.getByTestId("nav-dashboard")).toBeVisible();
  await expect(page.getByTestId("new-audit-button")).toBeVisible();
  await expect(page.getByTestId("audit-row-audit-1")).toContainText("Acme Dental");
  await expect(page.getByTestId("user-menu-trigger")).toContainText("E2E");

  expect(browserErrors).toEqual([]);
});

test("@signed-in clients page lists, searches, and creates clients", async ({ page }) => {
  const browserErrors: string[] = [];
  const clients = [
    {
      id: "client-1",
      orgId: "org-1",
      name: "Acme Dental",
      domain: "acme.example",
      industry: "Healthcare",
      contactEmail: "ops@acme.example",
      seoScore: 82,
      auditCount: 3,
      issueCount: 5,
      lastAuditAt: "2026-05-10T12:00:00.000Z",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-10T12:00:00.000Z",
    },
    {
      id: "client-2",
      orgId: "org-1",
      name: "Beacon HVAC",
      domain: "beacon.example",
      industry: "Home Services",
      contactEmail: "hello@beacon.example",
      seoScore: 64,
      auditCount: 1,
      issueCount: 9,
      lastAuditAt: "2026-05-08T12:00:00.000Z",
      createdAt: "2026-05-02T12:00:00.000Z",
      updatedAt: "2026-05-08T12:00:00.000Z",
    },
  ];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.route("**/api/organizations", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "org-1",
          name: "SEORx Test Org",
          slug: "seorx-test-org",
          plan: "starter",
          createdAt: "2026-05-01T12:00:00.000Z",
          updatedAt: "2026-05-01T12:00:00.000Z",
        },
      ]),
    });
  });
  await page.route("**/api/clients*", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const data = request.postDataJSON() as {
        orgId: string;
        name: string;
        domain: string;
        industry?: string;
        contactEmail?: string;
      };
      const created = {
        id: "client-3",
        orgId: data.orgId,
        name: data.name,
        domain: data.domain,
        industry: data.industry,
        contactEmail: data.contactEmail,
        seoScore: null,
        auditCount: 0,
        issueCount: 0,
        lastAuditAt: null,
        createdAt: "2026-05-11T12:00:00.000Z",
        updatedAt: "2026-05-11T12:00:00.000Z",
      };
      clients.push(created);
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
      return;
    }

    const url = new URL(request.url());
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const filtered = search
      ? clients.filter((client) =>
          [client.name, client.domain, client.industry ?? ""].some((value) =>
            value.toLowerCase().includes(search),
          ),
        )
      : clients;

    await route.fulfill({ contentType: "application/json", body: JSON.stringify(filtered) });
  });

  await page.goto("/clients");

  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
  await expect(page.getByTestId("client-row-client-1")).toContainText("Acme Dental");
  await expect(page.getByTestId("client-row-client-2")).toContainText("Beacon HVAC");

  await page.getByTestId("search-clients").fill("Beacon");
  await expect(page.getByTestId("client-row-client-2")).toBeVisible();
  await expect(page.getByTestId("client-row-client-1")).toHaveCount(0);

  await page.getByTestId("search-clients").fill("");
  await expect(page.getByTestId("client-row-client-1")).toBeVisible();

  await page.getByTestId("add-client-button").click();
  await page.getByTestId("input-client-name").fill("Cedar Legal");
  await page.getByTestId("input-client-domain").fill("cedarlegal.com");
  await page.getByTestId("submit-create-client").click();

  await expect(page.getByTestId("client-row-client-3")).toContainText("Cedar Legal");
  await expect(page.getByTestId("client-row-client-3")).toContainText("cedarlegal.com");

  expect(browserErrors).toEqual([]);
});

test("@signed-in new audit submits and redirects to the audit detail route", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.route("**/api/clients*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "client-1",
          orgId: "org-1",
          name: "Acme Dental",
          domain: "acme.example",
          industry: "Healthcare",
          contactEmail: "ops@acme.example",
          seoScore: 82,
          auditCount: 3,
          issueCount: 5,
          lastAuditAt: "2026-05-10T12:00:00.000Z",
          createdAt: "2026-05-01T12:00:00.000Z",
          updatedAt: "2026-05-10T12:00:00.000Z",
        },
      ]),
    });
  });
  await page.route("**/api/audits", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "audit-started",
          clientId: "client-1",
          clientName: "Acme Dental",
          url: "https://acme.example",
          status: "pending",
          maxPages: 25,
          includePageSpeed: false,
          createdAt: "2026-05-11T12:00:00.000Z",
        }),
      });
      return;
    }

    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [], total: 0 }) });
  });
  await page.route("**/api/audits/audit-started/issues*", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route("**/api/audits/audit-started", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "audit-started",
        clientId: "client-1",
        clientName: "Acme Dental",
        url: "https://acme.example",
        status: "pending",
        maxPages: 25,
        includePageSpeed: false,
        createdAt: "2026-05-11T12:00:00.000Z",
      }),
    });
  });

  await page.goto("/audits/new");
  await expect(page.getByText("New Audit", { exact: true })).toBeVisible();

  await page.getByTestId("select-client").click();
  await page.getByRole("option", { name: "Acme Dental (acme.example)" }).click();
  await page.getByTestId("input-audit-url").fill("https://acme.example");
  await page.getByTestId("input-max-pages").fill("25");
  await page.getByTestId("submit-audit").click();

  await expect(page).toHaveURL(/\/audits\/audit-started$/);
  expect(browserErrors).toEqual([]);
});
