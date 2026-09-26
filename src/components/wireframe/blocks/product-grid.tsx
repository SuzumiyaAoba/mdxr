// Adapted from wireframe-ui, commit 30ba352497760d13e26993928bd90a60ac34640e. MIT: src/wireframe-ui.LICENSE.md.
"use client";

import {
  HeartIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card.js";
import { Heading } from "../ui/heading.js";
import { Input } from "../ui/input.js";
import { Media } from "../ui/media.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select.js";
import { Text } from "../ui/text.js";

export function ProductGrid() {
  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Heading level={2} />
          <Text width="lg" color="muted" size="sm" />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Input
              variant="wireframe"
              skeletonIcon={
                <MagnifyingGlassIcon className="text-muted-foreground" />
              }
            />
          </div>
          <Select>
            <SelectTrigger className="w-[140px]">
              <SelectValue>
                <Text width="xs" />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">
                <Text width="sm" />
              </SelectItem>
              <SelectItem value="newest">
                <Text width="sm" />
              </SelectItem>
              <SelectItem value="price">
                <Text width="sm" />
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="group overflow-hidden">
            <div className="relative">
              <Media type="image" className="aspect-square w-full" />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <HeartIcon className="text-muted-foreground" />
                </Button>
              </div>
              {i % 3 === 0 && (
                <Badge className="absolute top-2 left-2">
                  <Text width="xs" />
                </Badge>
              )}
            </div>
            <CardHeader className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="line-clamp-2">
                  <Text width="md" truncate />
                </CardTitle>
              </div>
              <CardDescription>
                <Text width="sm" color="muted" size="sm" truncate />
              </CardDescription>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <SparklesIcon
                    key={star}
                    className={
                      star <= 4
                        ? "size-3.5 fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground size-3.5"
                    }
                  />
                ))}
                <Text width="xs" color="muted" size="xs" className="ml-1" />
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between p-4 pt-0">
              <Text width="sm" emphasis="primary" size="lg" />
              <Button size="sm">
                <ShoppingCartIcon className="text-muted-foreground" />
                <Text width="xs" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
