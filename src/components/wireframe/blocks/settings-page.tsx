// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
import { useId } from "react";
("use client");

import {
  Bars3Icon,
  BellIcon,
  UserIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

import { Avatar, AvatarFallback } from "../ui/avatar.js";
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
import { Separator } from "../ui/separator.js";
import { Switch } from "../ui/switch.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.js";
import { Text } from "../ui/text.js";
import { Textarea } from "../ui/textarea.js";

export function SettingsPage() {
  const instanceId = useId();
  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4 lg:space-y-6 lg:p-6">
      <div className="space-y-1">
        <Text width="lg" emphasis="primary" size="lg" />
        <Text width="xl" color="muted" size="sm" />
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="gap-2">
            <UserIcon className="text-muted-foreground shrink-0" />
            <span className="hidden sm:inline">
              <Text width="xs" />
            </span>
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <LockClosedIcon className="text-muted-foreground shrink-0" />
            <span className="hidden sm:inline">
              <Text width="xs" />
            </span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <BellIcon className="text-muted-foreground shrink-0" />
            <span className="hidden sm:inline">
              <Text width="sm" />
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>
                <Text width="md" />
              </CardTitle>
              <CardDescription>
                <Text width="lg" color="muted" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 shrink-0 lg:h-20 lg:w-20">
                  <AvatarFallback />
                </Avatar>
                <div className="min-w-0 space-y-2">
                  <Button variant="outline" size="sm">
                    <Text width="xs" />
                  </Button>
                  <Text width="md" color="muted" size="xs" className="block" />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${instanceId}-firstname`}>
                    <span className="sr-only">Firstname</span>
                    <Text width="xs" />
                  </Label>
                  <Input
                    id={`${instanceId}-firstname`}
                    variant="wireframe"
                    skeletonIcon={
                      <Bars3Icon className="text-muted-foreground" />
                    }
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
                    skeletonIcon={
                      <Bars3Icon className="text-muted-foreground" />
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-bio`}>
                  <span className="sr-only">Bio</span>
                  <Text width="xs" />
                </Label>
                <Textarea
                  id={`${instanceId}-bio`}
                  variant="wireframe"
                  skeletonLines={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-language`}>
                  <span className="sr-only">Language</span>
                  <Text width="xs" />
                </Label>
                <Select>
                  <SelectTrigger id={`${instanceId}-language`}>
                    <SelectValue>
                      <Text width="sm" />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">
                      <Text width="sm" />
                    </SelectItem>
                    <SelectItem value="es">
                      <Text width="sm" />
                    </SelectItem>
                    <SelectItem value="fr">
                      <Text width="sm" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>
                <Text width="md" />
              </CardTitle>
              <CardDescription>
                <Text width="xl" color="muted" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-current-password`}>
                  <span className="sr-only">Current password</span>
                  <Text width="sm" />
                </Label>
                <Input
                  id={`${instanceId}-current-password`}
                  variant="wireframe"
                  skeletonIcon={
                    <LockClosedIcon className="text-muted-foreground" />
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-new-password`}>
                  <span className="sr-only">New password</span>
                  <Text width="sm" />
                </Label>
                <Input
                  id={`${instanceId}-new-password`}
                  variant="wireframe"
                  skeletonIcon={
                    <LockClosedIcon className="text-muted-foreground" />
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${instanceId}-confirm-new-password`}>
                  <span className="sr-only">Confirm new password</span>
                  <Text width="md" />
                </Label>
                <Input
                  id={`${instanceId}-confirm-new-password`}
                  variant="wireframe"
                  skeletonIcon={
                    <LockClosedIcon className="text-muted-foreground" />
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive overflow-hidden">
            <CardHeader>
              <CardTitle>
                <Text width="md" />
              </CardTitle>
              <CardDescription>
                <Text width="full" color="muted" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" size="sm">
                <Text width="sm" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>
                <Text width="md" />
              </CardTitle>
              <CardDescription>
                <Text width="lg" color="muted" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Text width="md" emphasis="primary" size="sm" />
                  <Text width="xl" color="muted" size="xs" />
                </div>
                <Switch defaultChecked className="shrink-0" />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Text width="sm" emphasis="primary" size="sm" />
                  <Text width="lg" color="muted" size="xs" />
                </div>
                <Switch className="shrink-0" />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Text width="lg" emphasis="primary" size="sm" />
                  <Text width="full" color="muted" size="xs" />
                </div>
                <Switch defaultChecked className="shrink-0" />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Text width="md" emphasis="primary" size="sm" />
                  <Text width="xl" color="muted" size="xs" />
                </div>
                <Switch className="shrink-0" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm">
          <Text width="xs" />
        </Button>
        <Button size="sm">
          <Text width="sm" />
        </Button>
      </div>
    </div>
  );
}
