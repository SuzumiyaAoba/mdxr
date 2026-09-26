import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  WireframeCard,
  WireframeCardContent,
  WireframeCardHeader,
  WireframeCardTitle,
} from "../src/ui/wireframe-card.js";
import {
  WireframeButton,
  WireframeInput,
  WireframeTextarea,
} from "../src/ui/wireframe-controls.js";
import {
  Wireframe,
  WireframeSection,
  WireframeStack,
} from "../src/ui/wireframe-layout.js";
import { WireframeAvatar, WireframeMedia } from "../src/ui/wireframe-media.js";
import {
  WireframeHeading,
  WireframeList,
  WireframeParagraph,
  WireframeText,
} from "../src/ui/wireframe-text.js";

const meta = {
  component: Wireframe,
  title: "Components/Wireframe",
} satisfies Meta<typeof Wireframe>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Wireframe title="Workspace">
      <WireframeStack spacing="lg">
        <WireframeStack align="center" direction="horizontal" justify="between">
          <WireframeHeading>Workspace</WireframeHeading>
          <WireframeAvatar label="Current user">AB</WireframeAvatar>
        </WireframeStack>
        <WireframeSection variant="content-two-column">
          <WireframeCard wireframe="compact">
            <WireframeCardHeader>
              <WireframeCardTitle>Projects</WireframeCardTitle>
            </WireframeCardHeader>
            <WireframeCardContent>
              <WireframeList items="3" />
            </WireframeCardContent>
          </WireframeCard>
          <WireframeMedia label="Product preview" />
        </WireframeSection>
        <WireframeTextarea label="Notes" />
      </WireframeStack>
    </Wireframe>
  ),
};

export const Mobile: Story = {
  render: () => (
    <Wireframe device="mobile" title="Sign in">
      <WireframeStack>
        <WireframeHeading>Welcome back</WireframeHeading>
        <WireframeParagraph lines="2" />
        <WireframeInput label="Email" type="email" />
        <WireframeInput label="Password" type="password" />
        <WireframeButton>Sign in</WireframeButton>
      </WireframeStack>
    </Wireframe>
  ),
};

export const Presets: Story = {
  render: () => (
    <Wireframe title="Landing page">
      <WireframeStack spacing="xl">
        <WireframeSection variant="hero" />
        <WireframeSection variant="content-two-column" />
        <WireframeSection variant="feature-grid" />
      </WireframeStack>
    </Wireframe>
  ),
};

export const Animations: Story = {
  render: () => (
    <Wireframe title="Placeholder animations">
      <WireframeStack>
        <WireframeText animate="pulse" label="Pulse" />
        <WireframeText animate="shimmer" label="Shimmer" />
        <WireframeText animate="typing" label="Typing" />
      </WireframeStack>
    </Wireframe>
  ),
};
