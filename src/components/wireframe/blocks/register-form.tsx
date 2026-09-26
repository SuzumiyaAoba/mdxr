// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import { useId } from "react";
("use client");

import {
  UserIcon,
  LockClosedIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { Text } from "../ui/text.js";

export function RegisterForm() {
  const instanceId = useId();
  return (
    <div className="flex min-h-[700px] w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle>
            <Text width="lg" emphasis="primary" />
          </CardTitle>
          <CardDescription>
            <Text width="xl" color="muted" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">
                <Text width="xs" />
              </TabsTrigger>
              <TabsTrigger value="account">
                <Text width="xs" />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-firstname`}>
                  <span className="sr-only">Firstname</span>
                  <Text width="xs" />
                </Label>
                <Input
                  id={`${instanceId}-firstname`}
                  variant="wireframe"
                  skeletonIcon={<UserIcon className="text-muted-foreground" />}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-lastname`}>
                  <span className="sr-only">Lastname</span>
                  <Text width="xs" />
                </Label>
                <Input
                  id={`${instanceId}-lastname`}
                  variant="wireframe"
                  skeletonIcon={<UserIcon className="text-muted-foreground" />}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-email-reg`}>
                  <span className="sr-only">Email</span>
                  <Text width="xs" />
                </Label>
                <Input
                  id={`${instanceId}-email-reg`}
                  variant="wireframe"
                  skeletonIcon={
                    <EnvelopeIcon className="text-muted-foreground" />
                  }
                />
              </div>
            </TabsContent>
            <TabsContent value="account" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-password-reg`}>
                  <span className="sr-only">Password</span>
                  <Text width="xs" />
                </Label>
                <Input
                  id={`${instanceId}-password-reg`}
                  variant="wireframe"
                  skeletonIcon={
                    <LockClosedIcon className="text-muted-foreground" />
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-confirm-password`}>
                  <span className="sr-only">Confirm password</span>
                  <Text width="sm" />
                </Label>
                <Input
                  id={`${instanceId}-confirm-password`}
                  variant="wireframe"
                  skeletonIcon={
                    <LockClosedIcon className="text-muted-foreground" />
                  }
                />
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id={`${instanceId}-terms`} />
                <Label
                  htmlFor={`${instanceId}-terms`}
                  className="cursor-pointer leading-none"
                >
                  <span className="sr-only">Terms</span>
                  <div className="space-y-1">
                    <Text width="full" size="sm" />
                    <Text width="lg" size="xs" color="muted" />
                  </div>
                </Label>
              </div>
            </TabsContent>
          </Tabs>
          <Button className="mt-6 w-full">
            <Text width="sm" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
