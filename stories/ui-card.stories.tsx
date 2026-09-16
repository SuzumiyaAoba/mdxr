import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../src/components/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/components/ui/card.js";

const meta = {
  component: Card,
  title: "Components/UI/Card",
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Release notes</CardTitle>
        <CardDescription>v0.2.0 highlights</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost">
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>Static card layout composed from primitives.</CardContent>
      <CardFooter>
        <Button size="sm">Publish</Button>
      </CardFooter>
    </Card>
  ),
};
