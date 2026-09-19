import type { Meta, StoryObj } from "@storybook/react-vite";

import { Incident } from "../src/ui/incident.js";
import { Pathway, Stop } from "../src/ui/pathway.js";
import { Entry, Release } from "../src/ui/release.js";
import { Day, Service, StatusPage, Uptime } from "../src/ui/statuspage.js";

const meta = {
  component: StatusPage,
  title: "Components/Ops",
} satisfies Meta<typeof StatusPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Services: Story = {
  render: () => (
    <StatusPage title="System status" updated="2m ago">
      <Service name="API" status="operational" uptime="99.98%" />
      <Service name="Dashboard" status="degraded">
        Elevated p95 latency since the 14:00 deploy.
      </Service>
      <Service name="Batch workers" status="maintenance" uptime="99.9%" />
    </StatusPage>
  ),
};

export const UptimeBar: Story = {
  render: () => (
    <Uptime from="Sep 12" pct="99.9" title="API — last 7 days" to="today">
      <Day date="Sep 12" status="up" />
      <Day date="Sep 13" status="up" />
      <Day date="Sep 14" note="deploy" status="degraded" />
      <Day status="up" />
      <Day date="Sep 16" note="INC-12" status="down" />
      <Day status="up" />
      <Day status="up" />
    </Uptime>
  ),
};

export const Changelog: Story = {
  render: () => (
    <Release
      date="2026-09-19"
      href="https://github.com/acme/app/compare/v0.1.0...v0.2.0"
      version="v0.2.0"
    >
      <Entry kind="breaking" scope="cli">
        Renamed <code>--html</code> to <code>--format</code>.
      </Entry>
      <Entry kind="added">New report components for agent output.</Entry>
      <Entry kind="added">Spark inline trend lines.</Entry>
      <Entry kind="fixed" scope="cli">
        Stdin piping no longer hangs on empty input.
      </Entry>
      <Entry kind="security">Patched minimatch to 3.1.2.</Entry>
    </Release>
  ),
};

export const MigrationPath: Story = {
  render: () => (
    <Pathway title="Upgrade path">
      <Stop label="v17" note="current" status="done" />
      <Stop current label="v18" note="codemod running" status="doing" />
      <Stop label="v19" status="todo" />
      <Stop label="v20" note="beta" status="blocked" />
    </Pathway>
  ),
};

export const Postmortem: Story = {
  render: () => (
    <Incident
      duration="34m"
      impact="production DB + backups deleted"
      resolved="09:46 UTC"
      severity="critical"
      started="09:12 UTC"
      status="resolved"
      title="Production database wiped"
    >
      <p>
        An unscoped API token used by the nightly cleanup job had delete
        permissions on the production project.
      </p>
    </Incident>
  ),
};
