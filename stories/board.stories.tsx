import type { Meta, StoryObj } from "@storybook/react-vite";

import { Board, BoardCard, Lane } from "../src/ui/board.js";

const meta = {
  component: Board,
  title: "Components/Board",
} satisfies Meta<typeof Board>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sprint: Story = {
  render: () => (
    <Board title="Sprint 12">
      <Lane status="todo" title="Todo">
        <BoardCard owner="aoba" priority="p1" title="Write migration guide" />
        <BoardCard effort="s" title="Bump deps" />
      </Lane>
      <Lane status="doing" title="In progress">
        <BoardCard due="2025-01-20" status="doing" title="Graph component">
          dagre layout + svg edges
        </BoardCard>
      </Lane>
      <Lane status="blocked" title="Blocked">
        <BoardCard priority="p0" status="blocked" title="CDN review">
          waiting on security sign-off
        </BoardCard>
      </Lane>
      <Lane status="done" title="Done">
        <BoardCard status="done" title="Ship v0.1" />
      </Lane>
    </Board>
  ),
};
