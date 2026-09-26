// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
"use client";

import { CheckIcon, PlayIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Heading } from "../ui/heading.js";
import { Media } from "../ui/media.js";
import { Stack } from "../ui/stack.js";
import { Text } from "../ui/text.js";

export function HeroSection() {
  return (
    <div className="container mx-auto px-4 py-16 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col justify-center space-y-6">
          <Badge className="w-fit">
            <SparklesIcon className="text-muted-foreground size-3" />
            <Text width="sm" />
          </Badge>
          <div className="space-y-4">
            <Heading level={1} />
            <Stack direction="vertical" spacing="sm">
              <Text width="full" color="muted" size="lg" />
              <Text width="xl" color="muted" size="lg" />
            </Stack>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg">
              <Text width="sm" />
            </Button>
            <Button size="lg" variant="outline">
              <PlayIcon className="text-muted-foreground size-4" />
              <Text width="sm" />
            </Button>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2">
              <CheckIcon className="text-muted-foreground size-4" />
              <Text width="lg" size="sm" />
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="text-muted-foreground size-4" />
              <Text width="md" size="sm" />
            </div>
            <div className="flex items-center gap-2">
              <CheckIcon className="text-muted-foreground size-4" />
              <Text width="xl" size="sm" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <Media type="image" className="aspect-video w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
