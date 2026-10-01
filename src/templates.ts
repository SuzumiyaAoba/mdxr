import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DOCUMENT_TEMPLATES = ["plan", "investigation", "review"] as const;
export type DocumentTemplate = (typeof DOCUMENT_TEMPLATES)[number];

const BODIES: Record<DocumentTemplate, string> = {
  investigation: `## Question\n\nDescribe the question and the evidence needed to answer it.\n\n## Evidence\n\nRecord observations, source locations and reproduction steps.\n\n## Findings\n\nSeparate confirmed findings from hypotheses.\n\n## Next steps\n\n<Steps>\n  <Step status="todo">Validate the hypothesis and record the result.</Step>\n</Steps>\n`,
  plan: `## Objective\n\nDescribe the intended outcome and scope.\n\n## Acceptance criteria\n\n<Reqs>\n  <Req id="REQ-1" status="todo">Describe an observable acceptance criterion.</Req>\n</Reqs>\n\n## Implementation\n\n<Steps progress="true">\n  <Step status="todo">Implement the change.</Step>\n  <Step status="todo">Verify the acceptance criteria.</Step>\n</Steps>\n\n## Validation\n\n<Tests>\n  <Test name="Acceptance criteria" status="todo" />\n</Tests>\n`,
  review: `## Scope\n\nIdentify the change, revision and files under review.\n\n## Findings\n\nRecord each issue, its impact and supporting source location.\n\n## Validation\n\n<Tests>\n  <Test name="Review checks" status="todo" />\n</Tests>\n\n## Follow-up\n\n<Steps>\n  <Step status="todo">Resolve the findings and repeat relevant checks.</Step>\n</Steps>\n`,
};

export const templateSource = (
  template: DocumentTemplate,
  title: string = template,
  now = new Date()
): string =>
  `---\nid: ${JSON.stringify(randomUUID())}\ntitle: ${JSON.stringify(title)}\nstatus: todo\ndate: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}\n---\n\n${BODIES[template]}`;

export const createDocument = async (
  options: {
    template?: string;
    title?: string;
    out?: string;
    dir?: string;
    now?: Date;
  } = {}
): Promise<string> => {
  const template = DOCUMENT_TEMPLATES.find(
    (candidate) => candidate === (options.template ?? "plan")
  );
  if (template === undefined) {
    throw new Error(
      `Unknown template: ${options.template}. Choose ${DOCUMENT_TEMPLATES.join(" | ")}`
    );
  }
  if (options.out !== undefined && options.dir !== undefined) {
    throw new Error("Use either --out or --dir");
  }
  const now = options.now ?? new Date();
  const timestamp = [
    now.getFullYear(),
    ...[
      now.getMonth() + 1,
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    ].map((part) => String(part).padStart(2, "0")),
  ].join("");
  const file = path.resolve(
    options.out ??
      path.join(options.dir ?? ".mdxr", `${timestamp}-${template}`, "index.mdx")
  );
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, templateSource(template, options.title, now), {
    flag: "wx",
  });
  return file;
};
