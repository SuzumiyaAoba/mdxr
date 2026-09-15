import type { Meta, StoryObj } from "@storybook/react-vite";

const KitchenSink = () => (
  <>
    <h1>Typography</h1>
    <p>
      Body text with <strong>bold</strong>, <em>italic</em>,{" "}
      <code>inline code</code>, and{" "}
      <a href="https://example.com">an external link</a>.
    </p>
    <h2>Lists</h2>
    <ul className="contains-task-list">
      <li className="task-list-item">
        <input
          aria-label="done task"
          checked
          disabled
          readOnly
          type="checkbox"
        />{" "}
        Done task
      </li>
      <li className="task-list-item">
        <input aria-label="open task" disabled readOnly type="checkbox" /> Open
        task
      </li>
    </ul>
    <h2>Table</h2>
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Callout</td>
          <td>builtin</td>
        </tr>
        <tr>
          <td>Timeline</td>
          <td>project</td>
        </tr>
      </tbody>
    </table>
    <blockquote>
      <p>A plain blockquote (GitHub alerts become Callout instead).</p>
    </blockquote>
  </>
);

const meta = {
  component: KitchenSink,
  title: "Documents/Typography",
} satisfies Meta<typeof KitchenSink>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Plain markdown elements under the .prose styles every document gets. */
export const ProseElements: Story = {};
