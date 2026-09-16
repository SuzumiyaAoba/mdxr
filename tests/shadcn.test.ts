import { describe, expect, it } from "vitest";

import { mdxToHtml } from "../src/mdx.js";
import { buildCss } from "../src/tailwind.js";
import { builtinComponents } from "../src/ui/index.js";

const render = async (src: string) => await mdxToHtml(src, builtinComponents);

describe("shadcn/ui components in documents", () => {
  it("renders Button with variant classes", async () => {
    const { body } = await render('<Button variant="outline">Click</Button>');
    expect(body).toContain("Click");
    expect(body).toContain("border-border");
  });

  it("renders compound Card structure", async () => {
    const { body } = await render(
      "<Card><CardHeader><CardTitle>T</CardTitle></CardHeader><CardContent>C</CardContent></Card>"
    );
    expect(body).toContain(">T</div>");
    expect(body).toContain("C");
  });

  it("renders Badge", async () => {
    const { body } = await render('<Badge variant="secondary">beta</Badge>');
    expect(body).toContain("beta");
  });

  it("renders Tabs in initial state", async () => {
    const { body } = await render(
      '<Tabs defaultValue="a"><TabsList><TabsTrigger value="a">A</TabsTrigger><TabsTrigger value="b">B</TabsTrigger></TabsList><TabsContent value="a">panel-a</TabsContent><TabsContent value="b">panel-b</TabsContent></Tabs>'
    );
    expect(body).toContain("panel-a");
  });

  it("compiles theme tokens and shadcn utilities into the document CSS", async () => {
    const { css } = await buildCss([
      {
        content: '<div class="bg-primary text-primary-foreground"></div>',
        extension: "html",
      },
    ]);
    expect(css).toContain("--primary:");
    expect(css).toContain(".dark");
    expect(css).toContain("bg-primary");
  });

  it("compiles icon-[set--name] classes into mask/background CSS", async () => {
    const { css } = await buildCss([
      {
        content: '<span class="icon-[lucide--check]"></span>',
        extension: "html",
      },
    ]);
    expect(css).toContain(".icon-\\[lucide--check\\]");
    expect(css).toContain("data:image/svg+xml");
  });
});
