import type { Meta, StoryObj } from "@storybook/react-vite";

import { ObjectSchema } from "../../src/ui/object-schema.js";

const meta = {
  args: {
    schema: JSON.stringify({
      properties: {
        details: {
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
          ],
        },
        id: {
          description: "Stable identifier",
          type: "string",
        },
        tags: {
          items: {
            type: "string",
          },
          type: "array",
        },
      },
      required: ["id"],
      type: "object",
    }),
  },
  component: ObjectSchema,
  parameters: {
    docs: {
      description: {
        component: ObjectSchema.__mdxr?.description,
      },
    },
  },
  title: "Components/ObjectSchema",
} satisfies Meta<typeof ObjectSchema>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
