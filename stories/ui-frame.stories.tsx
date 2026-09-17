import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "../src/components/ui/frame.js";

const meta = {
  component: Frame,
  title: "Components/UI/Frame",
} satisfies Meta<typeof Frame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Frame className="w-96">
      <FrameHeader>
        <FrameTitle>Section header</FrameTitle>
        <FrameDescription>Brief description about the section</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <h2 className="text-sm font-semibold">Section title</h2>
        <p className="text-muted-foreground text-sm">Section description</p>
      </FramePanel>
      <FrameFooter>
        <p className="text-muted-foreground text-sm">Footer</p>
      </FrameFooter>
    </Frame>
  ),
};

export const SeparatedPanels: Story = {
  render: () => (
    <Frame className="w-96">
      <FrameHeader>
        <FrameTitle>Section header</FrameTitle>
        <FrameDescription>Brief description about the section</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <h2 className="text-sm font-semibold">Separated panel</h2>
        <p className="text-muted-foreground text-sm">Section description</p>
      </FramePanel>
      <FramePanel>
        <h2 className="text-sm font-semibold">Separated panel</h2>
        <p className="text-muted-foreground text-sm">Section description</p>
      </FramePanel>
    </Frame>
  ),
};
