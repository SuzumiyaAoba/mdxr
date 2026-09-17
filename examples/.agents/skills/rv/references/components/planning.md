# Planning & status components

Index: [../components.md](../components.md). MDX attributes are always strings; `children` is Markdown.

### `<Phase title="…" status="todo|doing|done|blocked" owner due>`

A section heading with a status badge, plus optional owner chip and deadline. Also produced by `:::phase{title="…"}`.

### `<Steps progress>` / `<Step status owner effort priority due>`

Ordered, status-aware step list. `progress` on `<Steps>` renders an automatic progress bar counting `<Step>` children. `Step` accepts `owner="…"`, `effort="xs|s|m|l|xl"`, `priority="p0|p1|p2|p3"` and `due="YYYY-MM-DD"` — each renders a chip under the step text.

```mdx
<Steps progress>
  <Step status="done">Read the existing parser</Step>
  <Step status="doing" owner="@alice" priority="p1" due="2026-09-18">
    Add directive transform
  </Step>
  <Step status="todo" effort="m">
    Update snapshots
  </Step>
</Steps>
```

### `<Timeline title="…">` / `<Event date status title>`

Chronological milestone list with a left rail. `Event` requires `date` (any string), optional `status` (todo|doing|done|blocked) and `title`. Also produced by `:::timeline{title="…"}`.

```mdx
<Timeline title="Milestones">
  <Event date="2026-09-10" status="done" title="Skeleton merged" />
  <Event date="2026-09-30" status="todo" title="v1.0 freeze" />
</Timeline>
```

### `<Decision title="…" status="…" date="…">`

Decision record (ADR-lite). `status` is `proposed|accepted|rejected|deprecated| superseded`. Children hold context and rationale. For a one-line record prefer `:::decision` (the Callout kind).

```mdx
<Decision
  title="Use renderToStaticMarkup (sync)"
  status="accepted"
  date="2026-09-12"
>
  Documents have no data fetching — a synchronous renderer keeps the CLI simple.
</Decision>
```

### `<Option title="…" status="recommended|considered|rejected">`

Alternative-comparison card. Pair with `<Columns>` for side-by-side layout.

```mdx
<Columns>
  <Option title="Template literals" status="rejected">
    Escaping bugs keep recurring.
  </Option>
  <Option title="Component pipeline" status="recommended">
    Deterministic + validated.
  </Option>
</Columns>
```

### `<Risk level="low|medium|high" title="…" mitigation="…">`

Risk block with a severity pill; `mitigation` renders a dedicated line.

```mdx
<Risk level="high" title="Ecosystem drift" mitigation="Pin @mdx-js/mdx">
  `evaluate()` semantics changed across majors before.
</Risk>
```

### `<Approvals>` / `<Approval name role status date>`

Sign-off list. `status` is `pending|approved|rejected|changes-requested`; children render as a comment next to the approver.

```mdx
<Approvals>
  <Approval name="alice" role="tech lead" status="approved" date="2026-09-14" />
  <Approval name="bob" role="security" status="pending" />
</Approvals>
```

### `<Stats>` / `<Stat value label delta>`

Metric card grid. `delta` colors by sign (`"+12"` green, `"-34%"` red).

### `<Priority level="p0|p1|p2|p3">` / `<Effort size="xs|s|m|l|xl">` / `<Due date="YYYY-MM-DD">` / `<Owner name="…" role="…">`

Inline chips: priority pill, T-shirt effort estimate (children = e.g. `3d`), deadline chip colored by urgency at render time (overdue → red, ≤3d → amber), and an initials-avatar person chip.

### `<Reqs>` / `<Req id="REQ-1" status="…">`

Requirement / acceptance-criteria rows: `id` renders a mono chip, optional `status` (todo|doing|done|blocked) a badge; children are the requirement text.

### `<Summary done="3" total="8" label="Progress" />`

Progress bar.

### `<StatusBadge status="…" />`

Standalone status pill.
