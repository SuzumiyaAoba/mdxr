import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../src/components/ui/accordion.js";

const meta = {
  component: Accordion,
  title: "Components/UI/Accordion",
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Accordion>
      <AccordionItem value="item-1">
        <AccordionTrigger>What is mdxr?</AccordionTrigger>
        <AccordionContent>An MDX to standalone HTML renderer.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Is it interactive?</AccordionTrigger>
        <AccordionContent>
          Rendered documents are static; Storybook shows real behavior.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
