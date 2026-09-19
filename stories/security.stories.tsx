import type { Meta, StoryObj } from "@storybook/react-vite";

import { Audit, Vuln } from "../src/ui/audit.js";
import { Bump, Bumps } from "../src/ui/bumps.js";
import { Package, Packages } from "../src/ui/packages.js";

const meta = {
  component: Audit,
  title: "Components/Security",
} satisfies Meta<typeof Audit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VulnerabilityAudit: Story = {
  render: () => (
    <Audit title="Dependency audit" tool="npm audit">
      <Vuln
        affected="<3.1.2"
        fix="3.1.2"
        href="https://github.com/advisories/GHSA-35jh-r3h4-6jhm"
        id="GHSA-35jh-r3h4-6jhm"
        package="minimatch"
        severity="critical"
        title="ReDoS in brace expansion"
      >
        Crafted patterns cause exponential backtracking.
      </Vuln>
      <Vuln
        affected="<2.2.0"
        fix="2.2.1"
        id="GHSA-xyz"
        package="semver"
        severity="high"
      />
      <Vuln
        affected="*"
        id="CVE-2024-0001"
        package="left-pad"
        severity="low"
        wontfix="true"
      >
        No fix planned upstream; the dep is only pulled transitively.
      </Vuln>
    </Audit>
  ),
};

export const UpgradePlan: Story = {
  render: () => (
    <Bumps title="Dependency upgrades">
      <Bump breaking from="18.3.1" name="react" to="19.3.0" />
      <Bump from="3.0.0" name="vitest" to="4.1.11" />
      <Bump cves="2" from="3.0.9" name="minimatch" note="security" to="3.1.2" />
      <Bump
        from="5.4.0"
        name="typescript"
        note="wait for vite-plus compat"
        to="5.9.2"
      >
        Hold until the toolchain supports decorators.
      </Bump>
    </Bumps>
  ),
};

export const Inventory: Story = {
  render: () => (
    <Packages title="Direct dependencies">
      <Package kind="dep" license="MIT" name="react" version="19.3.0" />
      <Package
        kind="dep"
        license="MIT"
        name="@mdx-js/mdx"
        note="document compiler"
        version="3.1.1"
      />
      <Package kind="dev" license="MIT" name="ultracite" version="7.11.1" />
      <Package kind="peer" name="typescript" version="5.9.x" />
      <Package kind="optional" name="sharp" version="0.34.x" />
    </Packages>
  ),
};
