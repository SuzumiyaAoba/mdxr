import type { Meta, StoryObj } from "@storybook/react-vite";

import { Ask, Choice, Question } from "../src/ui/ask.js";

const meta = {
  component: Ask,
  title: "Components/Ask",
} satisfies Meta<typeof Ask>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Native controls — every field is interactive without client JS. */
export const Default: Story = {
  render: () => (
    <Ask description="プランに反映するため回答してください" title="確認事項">
      <Question label="実装方針" name="approach" required type="choice">
        <Choice checked value="gradual">
          段階的移行
          <span className="text-neutral-500"> — 既存パスを残す</span>
        </Choice>
        <Choice value="rewrite">一括書き換え</Choice>
      </Question>
      <Question label="含める範囲" name="scope" type="multi">
        <Choice checked value="api">
          API
        </Choice>
        <Choice value="ui">UI</Choice>
        <Choice value="docs">ドキュメント</Choice>
      </Question>
      <Question
        label="優先度"
        name="priority"
        placeholder="選択してください"
        type="select"
      >
        <Choice value="high">高</Choice>
        <Choice value="mid">中</Choice>
        <Choice value="low">低</Choice>
      </Question>
      <Question
        label="期限"
        name="deadline"
        placeholder="2026-10-01"
        type="text"
      />
      <Question label="補足" name="notes" rows="2" type="textarea" />
      <Question
        checked
        description="ステージングに先行デプロイする"
        label="プレビュー環境を作る"
        name="preview"
        type="toggle"
      />
    </Ask>
  ),
};
