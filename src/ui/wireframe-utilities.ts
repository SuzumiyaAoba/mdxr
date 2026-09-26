/* oxlint-disable unicorn/prefer-export-from -- Hydration imports these aliases by name from this leaf; direct re-exports would resolve to a module without the alias binding. */
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { badgeVariants } from "../components/wireframe/ui/badge.js";
import { buttonGroupVariants } from "../components/wireframe/ui/button-group.js";
import { buttonVariants } from "../components/wireframe/ui/button.js";
import { useFormField } from "../components/wireframe/ui/form.js";
import { useSidebar } from "../components/wireframe/ui/sidebar.js";
import { textVariants } from "../components/wireframe/ui/text.js";
import { toggleVariants } from "../components/wireframe/ui/toggle.js";

export const useWireframeForm = useForm;
export const useWireframeFormField = useFormField;
export const useWireframeSidebar = useSidebar;
export const wireframeToast: typeof toast = toast;
export const wireframeBadgeVariants = badgeVariants;
export const wireframeButtonGroupVariants = buttonGroupVariants;
export const wireframeButtonVariants = buttonVariants;
export const wireframeTextVariants = textVariants;
export const wireframeToggleVariants = toggleVariants;

export type { ChartConfig as WireframeChartConfig } from "../components/wireframe/ui/chart.js";
export type { CarouselApi as WireframeCarouselApi } from "../components/wireframe/ui/carousel.js";
