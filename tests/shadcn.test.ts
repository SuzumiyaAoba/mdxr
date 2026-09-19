import { describe, expect, it } from "vitest";

import { buildCss } from "../src/tailwind.js";
import { renderDoc } from "./helpers.js";

const render = renderDoc;

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

  it("renders Meter with label and value", async () => {
    const { body } = await render(
      '<Meter value="75"><MeterLabel>Storage</MeterLabel><MeterValue /><MeterTrack><MeterIndicator /></MeterTrack></Meter>'
    );
    expect(body).toContain("Storage");
    expect(body).toContain("meter-indicator");
  });

  it("renders Frame structure", async () => {
    const { body } = await render(
      "<Frame><FrameHeader><FrameTitle>T</FrameTitle></FrameHeader><FramePanel>P</FramePanel><FrameFooter>F</FrameFooter></Frame>"
    );
    expect(body).toContain("frame-panel");
    expect(body).toContain(">T</div>");
    expect(body).toContain("P");
    expect(body).toContain("F");
  });

  it("strips scriptable href props before they reach the DOM", async () => {
    /* oxlint-disable no-script-url -- the probe is the attack */
    const { body } = await render(
      '<Pagination><PaginationContent><PaginationItem><PaginationLink href="javascript:alert(1)">1</PaginationLink></PaginationItem></PaginationContent></Pagination>'
    );
    expect(body).not.toContain("javascript:");
    /* oxlint-enable no-script-url */
  });

  it("renders Fieldset with legend", async () => {
    const { body } = await render(
      "<Fieldset><FieldsetLegend>Contact</FieldsetLegend><Input /></Fieldset>"
    );
    expect(body).toContain("<fieldset");
    expect(body).toContain("Contact");
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
