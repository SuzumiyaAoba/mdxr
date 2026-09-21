import type { Meta, StoryObj } from "@storybook/react-vite";

import { AudioTranscript } from "../../src/ui/document-media.js";

const meta = {
  args: {
    captions: "assets/captions.vtt",
    data: JSON.stringify([
      {
        text: "An example tone starts here.",
        time: 0,
      },
      {
        text: "The example ends.",
        time: 0.5,
      },
    ]),
    src: "assets/tone.wav",
  },
  component: AudioTranscript,
  parameters: {
    docs: {
      description: {
        component: AudioTranscript.__mdxr?.description,
      },
    },
  },
  title: "Components/AudioTranscript",
} satisfies Meta<typeof AudioTranscript>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
