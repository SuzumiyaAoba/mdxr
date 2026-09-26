// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import { useId } from "react";
("use client");

import { LockClosedIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

import { Button } from "../ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card.js";
import { Checkbox } from "../ui/checkbox.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { Separator } from "../ui/separator.js";
import { Text } from "../ui/text.js";

export function LoginForm() {
  const instanceId = useId();
  return (
    <div className="flex min-h-[600px] w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle>
            <Text width="md" emphasis="primary" />
          </CardTitle>
          <CardDescription>
            <Text width="lg" color="muted" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${instanceId}-email`}>
              <span className="sr-only">Email</span>
              <Text width="xs" />
            </Label>
            <Input
              id={`${instanceId}-email`}
              variant="wireframe"
              skeletonIcon={<EnvelopeIcon className="text-muted-foreground" />}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${instanceId}-password`}>
              <span className="sr-only">Password</span>
              <Text width="xs" />
            </Label>
            <Input
              id={`${instanceId}-password`}
              variant="wireframe"
              skeletonIcon={
                <LockClosedIcon className="text-muted-foreground" />
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox id={`${instanceId}-remember`} />
              <Label
                htmlFor={`${instanceId}-remember`}
                className="cursor-pointer"
              >
                <span className="sr-only">Remember</span>
                <Text width="sm" size="sm" />
              </Label>
            </div>
            <Button variant="link" className="h-auto p-0">
              <Text width="xs" size="sm" />
            </Button>
          </div>
          <Button className="w-full">
            <Text width="sm" />
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline">
              <Text width="xs" />
            </Button>
            <Button variant="outline">
              <Text width="xs" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
