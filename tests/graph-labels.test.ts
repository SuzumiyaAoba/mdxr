import { describe, expect, it } from "vitest";

import { renderDoc } from "./helpers.js";

interface Box {
  h: number;
  w: number;
  x: number;
  y: number;
}
interface Chip {
  text: string;
  x: number;
  y: number;
}

const NODE_RE =
  /class="absolute" style="height:(?<h>[\d.]+)px;left:(?<x>[\d.]+)px;top:(?<y>[\d.]+)px;width:(?<w>[\d.]+)px"/gu;
const CHIP_RE =
  /whitespace-nowrap shadow-sm" style="left:(?<x>[\d.]+)px;top:(?<y>[\d.]+)px">(?<text>[^<]+)/gu;

// Extract absolute-positioned chips/nodes from rendered Graph markup.
const positions = (body: string): { chips: Chip[]; nodes: Box[] } => {
  const nodes = [...body.matchAll(NODE_RE)].map((m) => ({
    h: Number(m.groups?.h),
    w: Number(m.groups?.w),
    x: Number(m.groups?.x),
    y: Number(m.groups?.y),
  }));
  const chips = [...body.matchAll(CHIP_RE)].map((m) => ({
    text: m.groups?.text ?? "",
    x: Number(m.groups?.x),
    y: Number(m.groups?.y),
  }));
  return { chips, nodes };
};

// Approximate chip box: ~6.5px per glyph plus padding, 20px tall.
const overlaps = (nodes: Box[], chips: Chip[]): string[] => {
  const out: string[] = [];
  for (const c of chips) {
    const w = c.text.length * 6.5 + 14;
    const h = 20;
    for (const n of nodes) {
      const hitX = c.x + w / 2 > n.x && c.x - w / 2 < n.x + n.w;
      const hitY = c.y + h / 2 > n.y && c.y - h / 2 < n.y + n.h;
      if (hitX && hitY) {
        out.push(`chip "${c.text}" overlaps node at ${n.x},${n.y}`);
      }
    }
  }
  return out;
};

describe("graph edge labels", () => {
  it("TB: labels clear nodes", async () => {
    const { body } = await renderDoc(
      `<Graph direction="down">
  <Node id="a" label="alpha" />
  <Node id="b" label="beta" note="some longer note text" />
  <Node id="c" label="gamma" />
  <Edge from="a" to="b" label="calls into" />
  <Edge from="b" to="c" label="produces" />
</Graph>`
    );
    const { chips, nodes } = positions(body);
    expect(overlaps(nodes, chips)).toStrictEqual([]);
  });

  it("parallel edges get separate labels", async () => {
    const { body } = await renderDoc(
      `<Graph direction="right">
  <Node id="a" label="alpha" />
  <Node id="b" label="beta" />
  <Edge from="a" to="b" label="first" />
  <Edge from="a" to="b" label="second" />
</Graph>`
    );
    const { chips } = positions(body);
    expect(chips).toHaveLength(2);
    const sameSpot = chips[0].x === chips[1].x && chips[0].y === chips[1].y;
    expect(sameSpot).toBeFalsy();
  });

  it("Japanese labels are sized for wide glyphs", async () => {
    const { body } = await renderDoc(
      `<Graph direction="right">
  <Node id="a" label="開始" />
  <Node id="b" label="終了" />
  <Edge from="a" to="b" label="依存関係" />
</Graph>`
    );
    const { chips, nodes } = positions(body);
    expect(chips).toHaveLength(1);
    expect(overlaps(nodes, chips)).toStrictEqual([]);
  });
});
