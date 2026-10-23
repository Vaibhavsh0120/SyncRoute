"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"

// Base UI className can be a state function; the wrapper feeds it to cn(), so
// narrow it to a plain string (same treatment as the other ported files).
type WithClassName<P> = Omit<P, "className"> & { className?: string }

const Avatar = React.forwardRef<
  HTMLSpanElement,
  WithClassName<AvatarPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full",
      "[box-shadow:inset_0_1px_0_oklch(1_0_0_/_0.08),0_1px_2px_oklch(0_0_0_/_0.4)]",
      className
    )}
    {...props}
  />
))
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  WithClassName<AvatarPrimitive.Image.Props>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
))
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  WithClassName<AvatarPrimitive.Fallback.Props>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full",
      "border border-border [background-image:var(--bezel)]",
      "text-xs font-medium text-muted-foreground",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
