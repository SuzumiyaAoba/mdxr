import type { Meta, StoryObj } from "@storybook/react-vite";

import { EntityRelations } from "../../src/ui/semantic-diagrams.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "id",
        table: "users",
        type: "uuid",
      },
      {
        name: "id",
        table: "orders",
        type: "uuid",
      },
      {
        fk: "users.id",
        name: "user_id",
        relation: "many-to-one",
        table: "orders",
        type: "uuid",
      },
    ]),
  },
  component: EntityRelations,
  parameters: {
    docs: {
      description: {
        component: EntityRelations.__mdxr?.description,
      },
    },
  },
  title: "Components/EntityRelations",
} satisfies Meta<typeof EntityRelations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
