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

test("@signed-in AI providers page creates, updates, and deletes providers", async ({ page }) => {
  const browserErrors: string[] = [];
  const providers = [
    {
      id: "provider-existing",
      orgId: "org-1",
      name: "Existing Gemini",
      provider: "gemini",
      model: "gemini-1.5-flash",
      baseUrl: null,
      isActive: false,
      isDefault: false,
      createdAt: "2026-05-10T12:00:00.000Z",
      updatedAt: "2026-05-10T12:00:00.000Z",
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
  await page.route("**/api/ai-providers**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.pathname.match(/\/api\/ai-providers\/([^/]+)$/)?.[1];

    if (request.method() === "GET" && url.pathname === "/api/ai-providers") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(providers) });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/api/ai-providers") {
      const data = request.postDataJSON() as {
        orgId: string;
        name: string;
        provider: string;
        model: string;
        baseUrl?: string;
        isDefault?: boolean;
      };
      const created = {
        id: "provider-created",
        orgId: data.orgId,
        name: data.name,
        provider: data.provider,
        model: data.model,
        baseUrl: data.baseUrl || null,
        isActive: true,
        isDefault: !!data.isDefault,
        createdAt: "2026-05-12T12:00:00.000Z",
        updatedAt: "2026-05-12T12:00:00.000Z",
      };
      providers.push(created);
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
      return;
    }

    if (request.method() === "PUT" && id) {
      const provider = providers.find((item) => item.id === id);
      if (!provider) {
        await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
        return;
      }
      const data = request.postDataJSON() as Partial<typeof provider>;
      if (data.isDefault) {
        providers.forEach((item) => {
          item.isDefault = false;
        });
      }
      Object.assign(provider, data, { updatedAt: "2026-05-12T12:00:01.000Z" });
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(provider) });
      return;
    }

    if (request.method() === "DELETE" && id) {
      const index = providers.findIndex((item) => item.id === id);
      if (index >= 0) {
        providers.splice(index, 1);
      }
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });

  await page.goto("/ai-providers");

  await expect(page.getByRole("heading", { name: "AI Providers" })).toBeVisible();
  await expect(page.getByTestId("provider-card-provider-existing")).toContainText("Existing Gemini");
  await expect(page.getByTestId("provider-card-provider-existing")).toContainText("Inactive");

  await page.getByTestId("add-provider-button").click();
  await page.getByTestId("input-provider-name").fill("Primary OpenAI");
  await page.getByTestId("input-api-key").fill("sk-test-provider-key");
  await page.getByTestId("submit-provider").click();

  await expect(page.getByTestId("provider-card-provider-created")).toContainText("Primary OpenAI");
  await expect(page.getByTestId("provider-card-provider-created")).toContainText("openai");
  await expect(page.getByTestId("provider-card-provider-created")).toContainText("gpt-4o");

  await page.getByTestId("set-default-provider-provider-created").click();
  await expect(page.getByTestId("provider-card-provider-created")).toContainText("Default");
  await expect(page.getByTestId("provider-card-provider-created")).not.toContainText("Inactive");

  await page.getByTestId("toggle-provider-provider-created").click();
  await expect(page.getByTestId("provider-card-provider-created")).toContainText("Inactive");
  await expect(page.getByTestId("toggle-provider-provider-created")).toHaveText("Activate");

  await page.getByTestId("delete-provider-provider-created").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("provider-card-provider-created")).toHaveCount(0);
  await expect(page.getByTestId("provider-card-provider-existing")).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test("@signed-in organizations page creates organizations and invites members", async ({ page }) => {
  const browserErrors: string[] = [];
  const organizations = [
    {
      id: "org-1",
      name: "SEORx Test Org",
      slug: "seorx-test-org",
      plan: "starter",
      memberCount: 1,
      clientCount: 2,
      auditCount: 4,
      myRole: "admin",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
    },
  ];
  const membersByOrg: Record<string, any[]> = {
    "org-1": [
      {
        id: "member-1",
        orgId: "org-1",
        userId: "user-1",
        email: "owner@seorx.example",
        role: "admin",
        createdAt: "2026-05-01T12:00:00.000Z",
      },
    ],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.route("**/api/organizations**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const memberMatch = url.pathname.match(/\/api\/organizations\/([^/]+)\/members$/);

    if (request.method() === "GET" && url.pathname === "/api/organizations") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(organizations) });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/api/organizations") {
      const data = request.postDataJSON() as { name: string; slug: string };
      const created = {
        id: "org-2",
        name: data.name,
        slug: data.slug,
        plan: "free",
        memberCount: 1,
        clientCount: 0,
        auditCount: 0,
        myRole: "admin",
        createdAt: "2026-05-12T12:00:00.000Z",
        updatedAt: "2026-05-12T12:00:00.000Z",
      };
      organizations.push(created);
      membersByOrg[created.id] = [
        {
          id: "member-2",
          orgId: created.id,
          userId: "user-2",
          email: "founder@northstar.example",
          role: "admin",
          createdAt: "2026-05-12T12:00:00.000Z",
        },
      ];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
      return;
    }

    if (memberMatch && request.method() === "GET") {
      const orgId = memberMatch[1];
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(membersByOrg[orgId] ?? []) });
      return;
    }

    if (memberMatch && request.method() === "POST") {
      const orgId = memberMatch[1];
      const data = request.postDataJSON() as { email: string; role: string };
      const invited = {
        id: "member-invited",
        orgId,
        userId: "member-invited",
        email: data.email,
        role: data.role,
        createdAt: "2026-05-12T12:05:00.000Z",
      };
      membersByOrg[orgId] = [...(membersByOrg[orgId] ?? []), invited];
      const org = organizations.find((item) => item.id === orgId);
      if (org) {
        org.memberCount = membersByOrg[orgId].length;
      }
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(invited) });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });

  await page.goto("/organizations");

  await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible();
  await expect(page.getByTestId("org-card-org-1")).toContainText("SEORx Test Org");
  await expect(page.getByTestId("org-card-org-1")).toContainText("1 members");

  await page.getByTestId("add-org-button").click();
  await page.getByTestId("input-org-name").fill("Northstar Growth");
  await page.getByTestId("input-org-slug").fill("northstar-growth");
  await page.getByTestId("submit-org").click();

  await expect(page.getByTestId("org-card-org-2")).toContainText("Northstar Growth");
  await expect(page.getByTestId("org-card-org-2")).toContainText("northstar-growth");

  await page.getByTestId("manage-members-org-2").click();
  await expect(page.getByRole("dialog")).toContainText("Northstar Growth Members");
  await expect(page.getByTestId("org-member-member-2")).toContainText("founder@northstar.example");

  await page.getByTestId("input-member-email").fill("strategist@northstar.example");
  await page.getByTestId("select-member-role").click();
  await page.getByRole("option", { name: "Agency" }).click();
  await page.getByTestId("submit-member-invite").click();

  await expect(page.getByTestId("org-member-member-invited")).toContainText("strategist@northstar.example");
  await expect(page.getByTestId("org-member-member-invited")).toContainText("agency");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("org-card-org-2")).toContainText("2 members");

  expect(browserErrors).toEqual([]);
});

test("@signed-in onboarding creates tenant, first client, and first audit", async ({ page }) => {
  const browserErrors: string[] = [];
  const createdRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.route("**/api/organizations", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
      return;
    }

    const data = request.postDataJSON() as { name: string; slug: string };
    createdRequests.push(`org:${data.slug}`);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "onboarding-org",
        name: data.name,
        slug: data.slug,
        plan: "free",
        memberCount: 1,
        clientCount: 0,
        auditCount: 0,
        createdAt: "2026-05-12T12:00:00.000Z",
        updatedAt: "2026-05-12T12:00:00.000Z",
      }),
    });
  });
  await page.route("**/api/clients*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify([]) });
      return;
    }

    const data = request.postDataJSON() as { orgId: string; name: string; domain: string };
    createdRequests.push(`client:${data.orgId}:${data.domain}`);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "onboarding-client",
        orgId: data.orgId,
        name: data.name,
        domain: data.domain,
        seoScore: null,
        auditCount: 0,
        issueCount: 0,
        lastAuditAt: null,
        createdAt: "2026-05-12T12:01:00.000Z",
        updatedAt: "2026-05-12T12:01:00.000Z",
      }),
    });
  });
  await page.route("**/api/audits", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [], total: 0 }) });
      return;
    }

    const data = request.postDataJSON() as { clientId: string; url: string; maxPages: number; includePageSpeed: boolean };
    createdRequests.push(`audit:${data.clientId}:${data.url}:${data.maxPages}:${data.includePageSpeed}`);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "onboarding-audit",
        clientId: data.clientId,
        clientName: "Northstar Dental",
        url: data.url,
        status: "pending",
        maxPages: data.maxPages,
        includePageSpeed: data.includePageSpeed,
        createdAt: "2026-05-12T12:02:00.000Z",
      }),
    });
  });

  await page.goto("/onboarding");

  await expect(page.getByText("Create your organization")).toBeVisible();
  await page.getByTestId("input-org-name").fill("Northstar Growth");
  await page.getByTestId("input-org-slug").fill("northstar-growth");
  await page.getByTestId("next-org").click();

  await expect(page.getByText("Add your first client")).toBeVisible();
  await page.getByTestId("input-client-name").fill("Northstar Dental");
  await page.getByTestId("input-client-domain").fill("northstar.example");
  await page.getByTestId("next-client").click();

  await expect(page.getByText("Run your first audit")).toBeVisible();
  await page.getByTestId("input-audit-url").fill("https://northstar.example");
  await page.getByTestId("start-audit").click();

  await expect(page.getByRole("heading", { name: "You're all set!" })).toBeVisible();
  await page.getByTestId("go-to-dashboard").click();
  await expect(page).toHaveURL(/\/audits\/onboarding-audit$/);
  expect(createdRequests).toEqual([
    "org:northstar-growth",
    "client:onboarding-org:northstar.example",
    "audit:onboarding-client:https://northstar.example:50:false",
  ]);
  expect(browserErrors).toEqual([]);
});

test("@signed-in reports page generates a report and opens ready detail", async ({ page }) => {
  const browserErrors: string[] = [];
  const reports: any[] = [];
  const completedAudit = {
    id: "audit-1",
    clientId: "client-1",
    clientName: "Acme Dental",
    url: "https://acme.example",
    status: "completed",
    seoScore: 82,
    issueCount: 2,
    createdAt: "2026-05-10T12:00:00.000Z",
    completedAt: "2026-05-10T12:04:00.000Z",
  };
  const reportDetail = {
    id: "report-1",
    auditId: "audit-1",
    clientId: "client-1",
    clientName: "Acme Dental",
    title: "Acme May SEO Report",
    format: "pdf",
    status: "ready",
    summary: "Two high-priority fixes are ready for client delivery.",
    downloadUrl: "/api/reports/report-1/download",
    issueCount: 2,
    createdAt: "2026-05-12T12:00:00.000Z",
    updatedAt: "2026-05-12T12:00:01.000Z",
    topIssues: [
      {
        id: "issue-1",
        title: "Missing title tag",
        severity: "critical",
        recommendation: "Add a concise title tag.",
        priorityScore: 95,
      },
      {
        id: "issue-2",
        title: "Thin service page",
        severity: "high",
        recommendation: "Expand the service page content.",
        priorityScore: 82,
      },
    ],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await page.route("**/api/audits?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [completedAudit], total: 1 }),
    });
  });
  await page.route("**/api/reports**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "POST" && url.pathname === "/api/reports") {
      const data = request.postDataJSON() as { auditId: string; title: string; format: string };
      const created = {
        ...reportDetail,
        auditId: data.auditId,
        title: data.title,
        format: data.format,
        topIssues: undefined,
      };
      reports.splice(0, reports.length, created);
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/api/reports/report-1") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(reportDetail) });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/api/reports") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(reports) });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });

  await page.goto("/reports");

  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("No reports yet.")).toBeVisible();

  await page.getByTestId("generate-report-button").click();
  await page.getByTestId("select-audit").click();
  await page.getByRole("option", { name: "Acme Dental - https://acme.example" }).click();
  await page.getByTestId("input-report-title").fill("Acme May SEO Report");
  await page.getByTestId("submit-report").click();

  await expect(page.getByTestId("report-row-report-1")).toContainText("Acme May SEO Report");
  await expect(page.getByTestId("report-row-report-1")).toContainText("ready");
  await expect(page.getByTestId("download-report-report-1")).toHaveAttribute("href", "/api/reports/report-1/download");

  await page.getByTestId("report-row-report-1").click();
  await expect(page).toHaveURL(/\/reports\/report-1$/);
  await expect(page.getByRole("heading", { name: "Acme May SEO Report" })).toBeVisible();
  await expect(page.getByText("Executive Summary")).toBeVisible();
  await expect(page.getByText("Two high-priority fixes are ready for client delivery.")).toBeVisible();
  await expect(page.getByText("Missing title tag")).toBeVisible();
  await expect(page.getByTestId("download-report")).toHaveAttribute("href", "/api/reports/report-1/download");

  expect(browserErrors).toEqual([]);
});

test("@signed-in audit detail filters issues, triages them, and renders PageSpeed", async ({ page }) => {
  const browserErrors: string[] = [];
  const issues = [
    {
      id: "issue-1",
      auditId: "audit-1",
      url: "https://acme.example",
      category: "technical_seo",
      severity: "critical",
      status: "open",
      title: "Missing title tag",
      description: "The homepage is missing a title tag.",
      recommendation: "Add a concise title tag.",
      aiRecommendation: "Prioritize the homepage title because it affects every result impression.",
      priorityScore: 95,
      createdAt: "2026-05-10T12:00:00.000Z",
    },
    {
      id: "issue-2",
      auditId: "audit-1",
      url: "https://acme.example/services",
      category: "content",
      severity: "high",
      status: "open",
      title: "Thin service page",
      description: "The service page has very little useful content.",
      recommendation: "Expand the service page content.",
      aiRecommendation: "Add FAQs and internal links from related services.",
      priorityScore: 82,
      createdAt: "2026-05-10T12:01:00.000Z",
    },
    {
      id: "issue-3",
      auditId: "audit-1",
      url: "https://acme.example/contact",
      category: "technical_seo",
      severity: "high",
      status: "open",
      title: "Slow contact page",
      description: "The contact page is slower than expected.",
      recommendation: "Compress images and reduce render-blocking scripts.",
      aiRecommendation: "Prioritize the form page because it affects lead conversion.",
      priorityScore: 78,
      createdAt: "2026-05-10T12:02:00.000Z",
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

  await page.route("**/api/audits/audit-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "audit-1",
        clientId: "client-1",
        clientName: "Acme Dental",
        url: "https://acme.example",
        status: "completed",
        seoScore: 82,
        issueCount: 3,
        criticalCount: 1,
        highCount: 2,
        mediumCount: 0,
        lowCount: 0,
        crawledPages: 12,
        scanDurationMs: 4200,
        createdAt: "2026-05-10T12:00:00.000Z",
        completedAt: "2026-05-10T12:04:00.000Z",
      }),
    });
  });
  await page.route("**/api/audits/audit-1/issues*", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");
    const filtered = issues.filter((issue) => {
      return (!status || issue.status === status) && (!severity || issue.severity === severity);
    });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(filtered) });
  });
  await page.route("**/api/pagespeed/audit-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "pagespeed-1",
        auditId: "audit-1",
        performanceScore: 91,
        accessibilityScore: 87,
        bestPracticesScore: 94,
        seoScore: 98,
        fcp: 1.2,
        lcp: 2.4,
        cls: 0.045,
        totalBlockingTime: 120,
        ttfb: 0.35,
        isReal: false,
        createdAt: "2026-05-10T12:05:00.000Z",
      }),
    });
  });
  await page.route("**/api/issues/*/approve", async (route) => {
    const id = route.request().url().match(/\/api\/issues\/([^/]+)\/approve$/)?.[1];
    const issue = issues.find((item) => item.id === id);
    if (!issue) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      return;
    }
    issue.status = "approved";
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(issue) });
  });
  await page.route("**/api/issues/*/dismiss", async (route) => {
    const id = route.request().url().match(/\/api\/issues\/([^/]+)\/dismiss$/)?.[1];
    const issue = issues.find((item) => item.id === id);
    if (!issue) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      return;
    }
    issue.status = "dismissed";
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(issue) });
  });

  await page.goto("/audits/audit-1");

  await expect(page.getByRole("heading", { name: "Acme Dental" })).toBeVisible();
  await expect(page.getByTestId("issue-card-issue-1")).toContainText("Missing title tag");
  await expect(page.getByTestId("issue-card-issue-2")).toContainText("Thin service page");

  await page.getByTestId("audit-severity-filter").click();
  await page.getByRole("option", { name: "High" }).click();
  await expect(page.getByTestId("issue-card-issue-1")).toHaveCount(0);
  await expect(page.getByTestId("issue-card-issue-2")).toBeVisible();
  await expect(page.getByTestId("issue-card-issue-3")).toBeVisible();

  await page.getByTestId("audit-status-filter").click();
  await page.getByRole("option", { name: "Open" }).click();
  await page.getByTestId("approve-issue-issue-2").click();
  await page.getByTestId("confirm-approve").click();
  await expect(page.getByTestId("issue-card-issue-2")).toHaveCount(0);
  await expect(page.getByTestId("issue-card-issue-3")).toBeVisible();

  await page.getByTestId("dismiss-issue-issue-3").click();
  await page.getByTestId("confirm-dismiss").click();
  await expect(page.getByText("No issues found.")).toBeVisible();

  await page.getByTestId("pagespeed-tab").click();
  await expect(page.getByText("These metrics are estimated because live PageSpeed data wasn't available for this run.")).toBeVisible();
  await expect(page.getByText("Performance")).toBeVisible();
  await expect(page.getByText("91")).toBeVisible();
  await expect(page.getByText("Core Web Vitals")).toBeVisible();
  await expect(page.getByText("1.20s")).toBeVisible();
  await expect(page.getByText("0.045")).toBeVisible();
  await expect(page.getByText("120ms")).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test("@signed-in issues page approves and dismisses issues with refreshed live data", async ({ page }) => {
  const browserErrors: string[] = [];
  const issues = [
    {
      id: "issue-1",
      auditId: "audit-1",
      url: "https://acme.example",
      category: "technical_seo",
      severity: "critical",
      status: "open",
      title: "Missing title tag",
      description: "The homepage is missing a title tag.",
      recommendation: "Add a concise, keyword-focused title tag.",
      aiRecommendation: "Prioritize this because it affects every search result impression.",
      priorityScore: 95,
      createdAt: "2026-05-10T12:00:00.000Z",
    },
    {
      id: "issue-2",
      auditId: "audit-1",
      url: "https://acme.example/services",
      category: "content",
      severity: "high",
      status: "open",
      title: "Thin service page",
      description: "The service page has very little useful content.",
      recommendation: "Expand the page with treatment details and local trust signals.",
      aiRecommendation: "Add FAQs and internal links from related services.",
      priorityScore: 82,
      createdAt: "2026-05-10T12:01:00.000Z",
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

  await page.route("**/api/audits?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "audit-1",
            clientId: "client-1",
            clientName: "Acme Dental",
            url: "https://acme.example",
            status: "completed",
            seoScore: 82,
            issueCount: 2,
            createdAt: "2026-05-10T12:00:00.000Z",
            completedAt: "2026-05-10T12:04:00.000Z",
          },
        ],
        total: 1,
      }),
    });
  });
  await page.route("**/api/audits/audit-1/issues*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");
    const filtered = issues.filter((issue) => {
      return (!status || issue.status === status) && (!severity || issue.severity === severity);
    });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(filtered) });
  });
  await page.route("**/api/issues/*/approve", async (route) => {
    const id = route.request().url().match(/\/api\/issues\/([^/]+)\/approve$/)?.[1];
    const issue = issues.find((item) => item.id === id);
    if (!issue) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      return;
    }
    issue.status = "approved";
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(issue) });
  });
  await page.route("**/api/issues/*/dismiss", async (route) => {
    const id = route.request().url().match(/\/api\/issues\/([^/]+)\/dismiss$/)?.[1];
    const issue = issues.find((item) => item.id === id);
    if (!issue) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
      return;
    }
    issue.status = "dismissed";
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(issue) });
  });

  await page.goto("/issues");

  await expect(page.getByRole("heading", { name: "Issues" })).toBeVisible();
  await expect(page.getByTestId("issue-card-issue-1")).toContainText("Missing title tag");
  await expect(page.getByTestId("issue-card-issue-2")).toContainText("Thin service page");

  await page.getByTestId("approve-issue-1").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("issue-card-issue-1")).toHaveCount(0);
  await expect(page.getByTestId("issue-card-issue-2")).toBeVisible();

  await page.getByTestId("dismiss-issue-2").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("No completed audits yet.")).toHaveCount(0);
  await expect(page.getByTestId("issue-card-issue-2")).toHaveCount(0);

  expect(browserErrors).toEqual([]);
});
