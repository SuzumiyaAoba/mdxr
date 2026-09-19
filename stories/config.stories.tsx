import type { Meta, StoryObj } from "@storybook/react-vite";

import { EnvVar, EnvVars } from "../src/ui/envvars.js";
import { DbField, DbTable, Schema } from "../src/ui/schema.js";

const meta = {
  component: Schema,
  title: "Components/Config",
} satisfies Meta<typeof Schema>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DataModel: Story = {
  render: () => (
    <Schema engine="postgres 16" title="Data model">
      <DbTable name="users" note="core accounts">
        <DbField name="id" pk type="uuid" />
        <DbField name="email" type="text" unique />
        <DbField fk="orgs.id" name="org_id" null type="uuid" />
        <DbField default="now()" name="created_at" type="timestamptz" />
      </DbTable>
      <DbTable name="orgs" note="tenant boundary">
        <DbField name="id" pk type="uuid" />
        <DbField name="slug" type="text" unique>
          Lowercase URL segment.
        </DbField>
      </DbTable>
    </Schema>
  ),
};

export const RuntimeConfig: Story = {
  render: () => (
    <EnvVars title="Runtime config">
      <EnvVar name="DATABASE_URL" required secret>
        Primary Postgres connection string.
      </EnvVar>
      <EnvVar default="info" name="LOG_LEVEL" />
      <EnvVar name="PORT" value="3000" />
      <EnvVar name="API_TOKEN" secret />
    </EnvVars>
  ),
};
