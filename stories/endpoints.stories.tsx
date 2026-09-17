import type { Meta, StoryObj } from "@storybook/react-vite";

import { Endpoint, Endpoints } from "../src/ui/endpoints.js";

const meta = {
  component: Endpoints,
  title: "Components/Endpoints",
} satisfies Meta<typeof Endpoints>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RestApi: Story = {
  render: () => (
    <Endpoints base="/api/v1" title="User service">
      <Endpoint method="GET" path="/users">
        List users, paginated.
      </Endpoint>
      <Endpoint auth="admin" method="POST" path="/users">
        Create a user.
      </Endpoint>
      <Endpoint method="GET" path="/users/:id" />
      <Endpoint method="PATCH" path="/users/:id" auth="admin" />
      <Endpoint method="DELETE" path="/users/:id" auth="admin" />
      <Endpoint deprecated method="GET" path="/legacy/users" />
    </Endpoints>
  ),
};
