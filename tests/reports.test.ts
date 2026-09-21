import { describe, expect, it } from "vitest";

import { renderDoc } from "./helpers.js";

const render = renderDoc;

describe("report components", () => {
  it("renders a Review with severity tally and verdict", async () => {
    const { body } = await render(
      `<Review title="PR review" verdict="changes">
        <Comment severity="high" file="src/mdx.ts" lines="42-58" title="Bug">desc</Comment>
        <Comment severity="low" title="Nit">nit desc</Comment>
      </Review>`
    );
    expect(body).toContain("Changes requested");
    expect(body).toContain("2 comments");
    expect(body).toContain("1 high");
    expect(body).toContain("1 low");
    expect(body).toContain("Bug");
  });

  it("renders a Verdict banner", async () => {
    const { body } = await render(
      '<Verdict status="warn" title="Careful">rationale</Verdict>'
    );
    expect(body).toContain("Warning");
    expect(body).toContain("Careful");
    expect(body).toContain("rationale");
  });

  it("converts :::verdict directive", async () => {
    const { body } = await render(
      ':::verdict{status="approve" title="Ship it"}\nall good\n:::'
    );
    expect(body).toContain("Approved");
    expect(body).toContain("all good");
  });

  it("renders Checks with status counts and duration sum", async () => {
    const { body } = await render(
      `<Checks title="CI" context="a1b2c3d">
        <Check name="lint" status="pass" duration="30s" required />
        <Check name="test" status="fail" duration="90s">boom</Check>
      </Checks>`
    );
    expect(body).toContain("a1b2c3d");
    expect(body).toContain("1 passed");
    expect(body).toContain("1 failed");
    expect(body).toContain("Required");
    // 30s + 90s sums to 120s in the caption
    expect(body).toContain("120s");
  });

  it("renders an Audit with severity tally and fix arrow", async () => {
    const { body } = await render(
      `<Audit tool="npm audit">
        <Vuln severity="critical" id="GHSA-x" package="minimatch" affected="<3.1.2" fix="3.1.2" />
        <Vuln severity="low" package="left-pad" wontfix="true" />
      </Audit>`
    );
    expect(body).toContain("1 critical");
    expect(body).toContain("1 low");
    expect(body).toContain("minimatch");
    expect(body).toContain("3.1.2");
    expect(body).toContain("wontfix");
  });

  it("auto-detects bump kind from versions", async () => {
    const { body } = await render(
      `<Bumps>
        <Bump name="react" from="18.3.1" to="19.0.0" breaking />
        <Bump name="vitest" from="4.1.0" to="4.2.0" />
      </Bumps>`
    );
    expect(body).toContain("1 major");
    expect(body).toContain("1 minor");
    expect(body).toContain("breaking");
  });

  it("renders a Packages inventory with count", async () => {
    const { body } = await render(
      `<Packages title="Deps">
        <Package name="react" version="19.3.0" kind="dep" license="MIT" />
        <Package name="ultracite" version="7.11.1" kind="dev" />
      </Packages>`
    );
    expect(body).toContain("Deps");
    expect(body).toContain("19.3.0");
    expect(body).toContain("MIT");
  });

  it("renders Gauges with target-based coloring", async () => {
    const { body } = await render(
      `<Gauges title="Coverage" unit="lines">
        <Gauge label="src/mdx.ts" value="82" target="80" detail="412/500" />
        <Gauge label="src/cli.ts" value="45" />
      </Gauges>`
    );
    expect(body).toContain("82%");
    expect(body).toContain("412/500");
    expect(body).toContain("bg-emerald-500");
    expect(body).toContain("bg-red-500");
  });

  it("renders Score ring gauges", async () => {
    const { body } = await render(
      '<Score value="87" label="health" detail="0 errors" />'
    );
    expect(body).toContain("87");
    expect(body).toContain("health");
    expect(body).toContain("stroke-emerald-500");
  });

  it("renders a Spark sparkline and hides it without a label", async () => {
    const { body } = await render(
      '<Spark values="120,110,96,88" tone="emerald" />'
    );
    expect(body).toContain("<polyline");
    expect(body).toContain('aria-hidden="true"');
  });

  it("computes benchmark deltas honoring better=lower", async () => {
    const { body } = await render(
      `<Benchmarks better="lower" unit="ms">
        <Bench name="small" before="120" after="60" />
        <Bench name="big" before="100" after="150" />
      </Benchmarks>`
    );
    expect(body).toContain("lower is better");
    expect(body).toContain("−50%");
    expect(body).toContain("+50%");
  });

  it.each([
    ["-1", "−∞"],
    ["0", "±0%"],
    ["1", "+∞"],
  ])(
    "keeps the delta sign from a zero baseline to %s",
    async (after, delta) => {
      const { body } = await render(
        `<Bench name="change" before="0" after="${after}" />`
      );
      expect(body).toContain(delta);
    }
  );

  it("renders DiffStat inline", async () => {
    const { body } = await render(
      '<DiffStat files="12" adds="340" dels="120" />'
    );
    expect(body).toContain("12 files");
    expect(body).toContain("+340");
    expect(body).toContain("−120");
  });

  it("renders Schema tables with constraint chips", async () => {
    const { body } = await render(
      `<Schema engine="postgres 16">
        <DbTable name="users">
          <DbField name="id" type="uuid" pk />
          <DbField name="org_id" type="uuid" fk="orgs.id" null />
        </DbTable>
      </Schema>`
    );
    expect(body).toContain("postgres 16");
    expect(body).toContain("users");
    expect(body).toContain("PK");
    expect(body).toContain("FK → orgs.id");
    expect(body).toContain("uuid");
  });

  it("masks secret env vars and prefixes defaults", async () => {
    const { body } = await render(
      `<EnvVars title="Config">
        <EnvVar name="DATABASE_URL" required secret value="postgres://real" />
        <EnvVar name="LOG_LEVEL" default="info" />
      </EnvVars>`
    );
    expect(body).toContain("DATABASE_URL");
    expect(body).toContain("••••••••");
    expect(body).not.toContain("postgres://real");
    expect(body).toContain("default: info");
    expect(body).toContain("required");
  });

  it("rolls up the worst service status on StatusPage", async () => {
    const { body } = await render(
      `<StatusPage title="Status">
        <Service name="API" status="operational" uptime="99.98%" />
        <Service name="Dashboard" status="degraded" />
      </StatusPage>`
    );
    expect(body).toContain("Degraded");
    expect(body).toContain("99.98%");
  });

  it("renders an Uptime bar with day tooltips", async () => {
    const { body } = await render(
      `<Uptime title="API" pct="99.9" from="Sep 12" to="today">
        <Day status="up" date="Sep 12" />
        <Day status="down" date="Sep 13" note="INC-1" />
      </Uptime>`
    );
    expect(body).toContain("99.9%");
    expect(body).toContain("Sep 12");
    expect(body).toContain("down — INC-1");
  });

  it("groups Release entries by kind", async () => {
    const { body } = await render(
      `<Release version="v0.2.0" date="2026-09-19">
        <Entry kind="fixed">bug fix</Entry>
        <Entry kind="breaking" scope="cli">rename</Entry>
        <Entry kind="added">new thing</Entry>
      </Release>`
    );
    expect(body).toContain("v0.2.0");
    // breaking sorts before added/fixed in the rendered order
    const breaking = body.indexOf("Breaking");
    const added = body.indexOf("Added");
    const fixed = body.indexOf("Fixed");
    expect(breaking).toBeGreaterThan(-1);
    expect(breaking).toBeLessThan(added);
    expect(added).toBeLessThan(fixed);
    expect(body).toContain("cli:");
  });

  it("renders a Pathway stepper with connectors", async () => {
    const { body } = await render(
      `<Pathway title="Upgrade path">
        <Stop label="v17" status="done" />
        <Stop label="v18" status="doing" current />
        <Stop label="v19" status="todo" />
      </Pathway>`
    );
    expect(body).toContain("v17");
    expect(body).toContain("v18");
    // ring marks the current stop
    expect(body).toContain("ring-2");
  });

  it("renders an Incident header with meta rows", async () => {
    const { body } = await render(
      `<Incident title="DB wiped" severity="critical" status="resolved"
                 started="09:12" resolved="09:46" duration="34m"
                 impact="production DB deleted">summary</Incident>`
    );
    expect(body).toContain("Critical");
    expect(body).toContain("Resolved");
    expect(body).toContain("DB wiped");
    expect(body).toContain("34m");
    expect(body).toContain("production DB deleted");
  });

  it("converts container directives end-to-end", async () => {
    const { body } = await render(
      `:::checks{title="CI"}
<Check name="lint" status="pass" />
:::

:::packages
<Package name="react" version="19.3.0" />
:::`
    );
    expect(body).toContain("CI");
    expect(body).toContain("lint");
    expect(body).toContain("react");
  });
});
