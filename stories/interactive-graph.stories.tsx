import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { Edge, Node } from "../src/ui/graph.js";
import {
  GraphGroup,
  GraphView,
  InteractiveGraph,
} from "../src/ui/interactive-graph.js";

const meta = {
  component: InteractiveGraph,
  parameters: { docDocument: true, layout: "fullscreen" },
  title: "Components/InteractiveGraph",
} satisfies Meta<typeof InteractiveGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

const WorkspaceGraph = ({
  defaultView = "all",
  height = "520",
  minimap = "false",
  viewsCollapsed = "false",
}: {
  defaultView?: string;
  height?: string;
  minimap?: string;
  viewsCollapsed?: string;
}) => (
  <InteractiveGraph
    defaultView={defaultView}
    height={height}
    minimap={minimap}
    title="Workspace の構成"
    viewsCollapsed={viewsCollapsed}
  >
    <GraphGroup id="clients" label="クライアント">
      <Node
        id="browser"
        icon="lucide:globe"
        label="Browser"
        note="作成・編集・共有"
      >
        <p>
          文書を作成し、更新を WebSocket
          で受け取ります。共有リンクから読み取り専用でアクセスすることもできます。
        </p>
      </Node>
      <Node
        id="agent"
        icon="lucide:bot"
        label="Agent / CLI"
        note="文書生成と編集"
      >
        <p>エージェントが文書を生成し、API を通じて Workspace に反映します。</p>
      </Node>
    </GraphGroup>
    <GraphGroup id="application" label="アプリケーション">
      <Node
        id="auth"
        icon="lucide:shield-check"
        label="認証・アクセス判定"
        note="セッションと文書の権限"
      >
        <p>
          ユーザーの認証と文書のアクセス権を確認します。編集には書き込み権限が必要です。
        </p>
      </Node>
      <Node
        id="api"
        icon="lucide:route"
        label="API routes"
        note="文書の作成・更新"
      >
        <p>
          認証済みのリクエストを受け取り、文書データの保存とライブ更新を調整します。
        </p>
      </Node>
      <Node
        id="socket"
        icon="lucide:radio"
        label="WebSocket"
        note="ライブ更新の配信"
      >
        <p>文書の変更を接続中のクライアントに配信します。</p>
      </Node>
    </GraphGroup>
    <GraphGroup id="backend" label="バックエンド">
      <Node
        id="identity"
        external="true"
        icon="lucide:key-round"
        label="Identity provider"
        note="外部認証サービス"
        href="https://example.com/identity"
      >
        <p>セッションの検証とユーザー情報の取得を担当する外部サービスです。</p>
      </Node>
      <Node
        id="database"
        icon="lucide:database"
        label="Database"
        note="文書とアクセス権"
      >
        <p>
          文書データとアクセス権を永続化します。作成と編集の両方の経路で使われます。
        </p>
      </Node>
    </GraphGroup>
    <Edge id="browser-auth" from="browser" to="auth" label="リクエスト" />
    <Edge id="agent-auth" from="agent" to="auth" />
    <Edge id="auth-identity" from="auth" to="identity" label="セッション検証" />
    <Edge id="auth-api" from="auth" to="api" label="許可" />
    <Edge id="api-database" from="api" to="database" label="保存" />
    <Edge id="api-socket" from="api" to="socket" label="変更通知" />
    <Edge id="browser-socket" from="browser" to="socket" label="接続" />
    <GraphView
      id="create"
      icon="lucide:file-plus"
      label="作成"
      edges="browser-auth auth-api api-database"
    >
      <p>
        Browser から認証・アクセス判定を経て API を呼び、文書を Database
        に保存します。
      </p>
    </GraphView>
    <GraphView
      id="live"
      icon="lucide:radio"
      label="ライブ編集"
      edges="browser-socket api-socket api-database"
    >
      <p>
        API で保存した変更を WebSocket で配信し、接続中の Browser に反映します。
      </p>
    </GraphView>
    <GraphView
      id="authentication"
      icon="lucide:shield-check"
      label="認証"
      edges="browser-auth agent-auth auth-identity"
    >
      <p>
        Browser と Agent / CLI のセッションを Identity provider で検証します。
      </p>
    </GraphView>
  </InteractiveGraph>
);

export const Architecture: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const views = within(canvas.getByRole("tablist", { name: "表示する経路" }));
    await expect(
      canvas.queryByRole("region", { name: "ノードの詳細" })
    ).not.toBeInTheDocument();
    const live = views.getByRole("tab", { name: "ライブ編集" });
    await userEvent.click(live);
    await expect(live).toHaveAttribute("aria-selected", "true");
    await expect(
      canvasElement.querySelectorAll(".doc-graph-node-card[data-dimmed]")
    ).toHaveLength(3);
    await userEvent.click(canvas.getByRole("button", { name: "Database" }));
    await expect(
      within(canvas.getByRole("region", { name: "ノードの詳細" })).getByText(
        "文書データとアクセス権を永続化します。作成と編集の両方の経路で使われます。"
      )
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "詳細を閉じる" }));
    await expect(
      canvas.queryByRole("region", { name: "ノードの詳細" })
    ).not.toBeInTheDocument();
    await userEvent.click(views.getByRole("tab", { name: "全体" }));
    await expect(
      canvasElement.querySelectorAll(".doc-graph-node-card[data-dimmed]")
    ).toHaveLength(0);
  },
  render: () => (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 text-neutral-900 dark:text-neutral-100">
      <WorkspaceGraph />
    </main>
  ),
};

export const Authentication: Story = {
  globals: { theme: "dark" },
  render: () => (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 text-neutral-900 dark:text-neutral-100">
      <WorkspaceGraph defaultView="authentication" />
    </main>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 text-neutral-900 dark:text-neutral-100">
      <WorkspaceGraph viewsCollapsed="true" />
    </main>
  ),
};

export const EdgeColors: Story = {
  argTypes: {
    edgeColor: { control: "color", name: "既定の線色" },
    publishColor: { control: "color", name: "通知の線色" },
    saveColor: { control: "color", name: "保存の線色" },
  },
  args: {
    edgeColor: "#64748b",
    publishColor: "#8b5cf6",
    saveColor: "#0d9488",
  },
  render: ({ edgeColor, publishColor, saveColor }) => (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 text-neutral-900 dark:text-neutral-100">
      <InteractiveGraph
        edgeColor={edgeColor}
        height="420"
        title="文書の保存と通知"
      >
        <Node id="api" icon="lucide:route" label="API" />
        <Node id="database" icon="lucide:database" label="Database" />
        <Node id="worker" icon="lucide:cog" label="Worker" />
        <Node id="browser" icon="lucide:globe" label="Browser" />
        <Edge
          id="save"
          color={saveColor}
          from="api"
          to="database"
          label="保存"
        />
        <Edge
          id="publish"
          color={publishColor}
          from="api"
          to="worker"
          label="変更通知"
        />
        <Edge id="deliver" from="worker" to="browser" label="配信" />
        <GraphView
          id="storage"
          icon="lucide:database"
          label="保存"
          edges="save"
        />
        <GraphView
          id="notification"
          icon="lucide:radio"
          label="通知"
          edges="publish deliver"
        />
      </InteractiveGraph>
    </main>
  ),
};

export const Pipeline: Story = {
  render: () => (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10 text-neutral-900 dark:text-neutral-100">
      <InteractiveGraph
        direction="down"
        height="500"
        minimap="false"
        title="MDX → HTML"
      >
        <Node
          id="source"
          icon="lucide:file-text"
          label="MDX source"
          note="宣言的な文書"
        >
          <p>Markdown と JSX コンポーネントで構成を定義します。</p>
        </Node>
        <Node id="compile" icon="lucide:cog" label="Compile" path="src/mdx.ts">
          <p>
            コンポーネントの属性を検証し、文書を React のツリーに変換します。
          </p>
        </Node>
        <Node
          id="render"
          icon="lucide:layers"
          label="Render"
          path="src/render.ts"
        >
          <p>静的 HTML と操作に必要な JavaScript を生成します。</p>
        </Node>
        <Node id="html" icon="lucide:globe" label="Standalone HTML">
          <p>外部のサービスに接続せずに図を操作できます。</p>
        </Node>
        <Edge from="source" to="compile" />
        <Edge from="compile" to="render" />
        <Edge from="render" to="html" />
        <GraphView id="output" label="HTML 出力" nodes="render html">
          <p>HTML の生成と表示の経路です。</p>
        </GraphView>
      </InteractiveGraph>
    </main>
  ),
};

export const Narrow: Story = {
  render: () => (
    <main className="mx-auto min-h-screen w-full max-w-[390px] p-3 text-neutral-900 dark:text-neutral-100">
      <WorkspaceGraph height="400" minimap="false" viewsCollapsed="true" />
    </main>
  ),
};
