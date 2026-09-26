// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import { useId } from "react";
("use client");

import { Bars3Icon, EnvelopeIcon } from "@heroicons/react/24/outline";

import { Button } from "../ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
import { Text } from "../ui/text.js";
import { Textarea } from "../ui/textarea.js";

export function ContactForm() {
  const instanceId = useId();
  return (
    <div className="container mx-auto flex min-h-[700px] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>
            <Text width="lg" emphasis="primary" />
          </CardTitle>
          <CardDescription>
            <Text width="full" color="muted" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${instanceId}-contact-name`}>
                <span className="sr-only">Name</span>
                <Text width="xs" />
              </Label>
              <Input
                id={`${instanceId}-contact-name`}
                variant="wireframe"
                skeletonIcon={<Bars3Icon className="text-muted-foreground" />}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${instanceId}-contact-email`}>
                <span className="sr-only">Email</span>
                <Text width="xs" />
              </Label>
              <Input
                id={`${instanceId}-contact-email`}
                variant="wireframe"
                skeletonIcon={
                  <EnvelopeIcon className="text-muted-foreground" />
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${instanceId}-subject`}>
              <span className="sr-only">Subject</span>
              <Text width="xs" />
            </Label>
            <Select>
              <SelectTrigger id={`${instanceId}-subject`}>
                <SelectValue>
                  <Text width="md" />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">
                  <Text width="sm" />
                </SelectItem>
                <SelectItem value="support">
                  <Text width="sm" />
                </SelectItem>
                <SelectItem value="sales">
                  <Text width="sm" />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${instanceId}-message`}>
              <span className="sr-only">Message</span>
              <Text width="xs" />
            </Label>
            <Textarea
              id={`${instanceId}-message`}
              variant="wireframe"
              skeletonLines={5}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline">
              <Text width="xs" />
            </Button>
            <Button>
              <Text width="sm" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
