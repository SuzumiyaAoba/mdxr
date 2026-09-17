import type { Meta, StoryObj } from "@storybook/react-vite";

import { Fieldset, FieldsetLegend } from "../src/components/ui/fieldset.js";
import { Input } from "../src/components/ui/input.js";
import { Label } from "../src/components/ui/label.js";

const meta = {
  component: Fieldset,
  title: "Components/UI/Fieldset",
} satisfies Meta<typeof Fieldset>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Fieldset className="flex w-80 flex-col gap-4">
      <FieldsetLegend>Contact</FieldsetLegend>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fieldset-name">Name</Label>
        <Input id="fieldset-name" placeholder="Ada Lovelace" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fieldset-email">Email</Label>
        <Input id="fieldset-email" placeholder="ada@example.com" type="email" />
      </div>
    </Fieldset>
  ),
};
