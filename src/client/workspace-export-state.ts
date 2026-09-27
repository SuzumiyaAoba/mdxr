import type { AnnotationAnchor, AnnotationStore } from "../annotations.js";

export interface WorkspaceBrowserState {
  annotations: AnnotationStore;
  annotationDraft?: {
    anchor: AnnotationAnchor;
    id?: string;
    comment: string;
  };
  detachedAnnotationIds: string[];
  sectionReviews: {
    id: string;
    revision: string;
    title: string;
    reviewed: boolean;
  }[];
  chatDraft: string;
  fields: { label: string; value: string }[];
}

export const WORKSPACE_EXPORT_STATE_EVENT = "mdxr:export-state" as const;

declare global {
  interface DocumentEventMap {
    "mdxr:export-state": CustomEvent<WorkspaceBrowserState>;
  }
}

type AnswerControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isAnswerControl = (control: Element): control is AnswerControl =>
  control instanceof HTMLInputElement ||
  control instanceof HTMLSelectElement ||
  control instanceof HTMLTextAreaElement;

const questionControls = (question: HTMLElement): AnswerControl[] =>
  [...question.querySelectorAll("input, select, textarea")].filter(
    isAnswerControl
  );

const normalizeLabel = (value: string | null | undefined): string =>
  value?.replaceAll(/\s+/gu, " ").trim() ?? "";

const choiceText = (control: HTMLInputElement | HTMLOptionElement): string => {
  if (control instanceof HTMLOptionElement) {
    return normalizeLabel(control.textContent) || control.value;
  }
  const body = control.closest("label")?.querySelector(".mdxr-choice-text");
  if (!(body instanceof HTMLElement)) {
    return control.value;
  }
  let text = "";
  for (const node of body.childNodes) {
    if (
      node instanceof HTMLElement &&
      node.classList.contains("mdxr-choice-desc")
    ) {
      continue;
    }
    text += node.textContent ?? "";
  }
  return normalizeLabel(text) || control.value;
};

const questionAnswer = (question: HTMLElement): string => {
  const controls = questionControls(question);
  const type = question.dataset.qType;
  if (type === "multi") {
    return controls
      .filter(
        (control): control is HTMLInputElement =>
          control instanceof HTMLInputElement && control.checked
      )
      .map(choiceText)
      .join(", ");
  }
  if (type === "choice") {
    const selected = controls.find(
      (control): control is HTMLInputElement =>
        control instanceof HTMLInputElement && control.checked
    );
    return selected === undefined ? "" : choiceText(selected);
  }
  if (type === "select") {
    const select = controls.find(
      (control): control is HTMLSelectElement =>
        control instanceof HTMLSelectElement
    );
    const [option] = select?.selectedOptions ?? [];
    return option === undefined ? "" : choiceText(option);
  }
  const [field] = controls;
  if (field instanceof HTMLInputElement && field.type === "checkbox") {
    return field.checked ? "yes" : "no";
  }
  return field?.value.trim() ?? "";
};

const controlLabel = (control: AnswerControl): string => {
  const label = normalizeLabel(
    [...(control.labels ?? [])]
      .map((element) => element.textContent ?? "")
      .join(" ")
  );
  if (label !== "") {
    return label;
  }
  return (
    normalizeLabel(control.getAttribute("aria-label")) ||
    normalizeLabel(control.getAttribute("name")) ||
    normalizeLabel(control.getAttribute("placeholder")) ||
    normalizeLabel(control.id) ||
    "Field"
  );
};

const controlValue = (control: AnswerControl): string => {
  if (control instanceof HTMLInputElement) {
    if (control.type === "file" || control.type === "hidden") {
      return "";
    }
    if (control.type === "checkbox") {
      return control.checked ? "yes" : "no";
    }
    if (control.type === "radio") {
      return control.checked ? choiceText(control) : "";
    }
    return control.value;
  }
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.selectedOptions, choiceText).join(", ");
  }
  return control.value;
};

const collectQuestionFields = (
  fields: { label: string; value: string }[],
  answeredControls: Set<AnswerControl>
): void => {
  for (const question of document.querySelectorAll<HTMLElement>(
    "#mdxr-root [data-mdxr-q]"
  )) {
    for (const control of questionControls(question)) {
      answeredControls.add(control);
    }
    fields.push({
      label:
        normalizeLabel(question.dataset.qLabel) ||
        normalizeLabel(question.dataset.qName) ||
        "Answer",
      value: questionAnswer(question),
    });
  }
};

const isExportableControl = (control: Element): control is AnswerControl => {
  if (
    !isAnswerControl(control) ||
    control.closest("[data-comment-tpl]") !== null
  ) {
    return false;
  }
  if (!(control instanceof HTMLInputElement)) {
    return true;
  }
  return !["button", "file", "hidden", "image", "reset", "submit"].includes(
    control.type
  );
};

const collectOtherFields = (
  fields: { label: string; value: string }[],
  answeredControls: Set<AnswerControl>
): void => {
  for (const control of document.querySelectorAll(
    "#mdxr-root input, #mdxr-root select, #mdxr-root textarea"
  )) {
    if (!isExportableControl(control) || answeredControls.has(control)) {
      continue;
    }
    fields.push({ label: controlLabel(control), value: controlValue(control) });
  }
};

const collectFields = (): { label: string; value: string }[] => {
  const fields: { label: string; value: string }[] = [];
  const answeredControls = new Set<AnswerControl>();
  collectQuestionFields(fields, answeredControls);
  collectOtherFields(fields, answeredControls);
  return fields;
};

/** Collect live browser-only state synchronously from the document controllers. */
export const collectWorkspaceBrowserState = (): WorkspaceBrowserState => {
  const composer = document.querySelector<HTMLTextAreaElement>(
    "#mdxr-workspace-chat textarea"
  );
  const state: WorkspaceBrowserState = {
    annotations: { annotations: [], history: [] },
    chatDraft: composer?.value ?? "",
    detachedAnnotationIds: [],
    fields: collectFields(),
    sectionReviews: [],
  };
  document.dispatchEvent(
    new CustomEvent<WorkspaceBrowserState>(WORKSPACE_EXPORT_STATE_EVENT, {
      detail: state,
    })
  );
  return state;
};
