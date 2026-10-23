"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

/*
 * Tabs — the list is a recessed well track; the active trigger is a raised
 * bezel pill sitting inside the groove, like the spec's "Monthly" selector.
 */

const Tabs = TabsPrimitive.Root

// Base UI className can be a state function; the wrappers feed it to cn(), so
// narrow it to a plain string (same treatment as the other ported files).
type WithClassName<P> = Omit<P, "className"> & { className?: string }

const TabsList = React.forwardRef<
  HTMLDivElement,
  WithClassName<TabsPrimitive.List.Props>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center gap-1 rounded-md p-1",
      "border border-border bg-input [box-shadow:var(--shadow-inset)]",
      "text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  WithClassName<TabsPrimitive.Tab.Props>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Tab
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5",
      "text-sm font-medium text-muted-foreground",
      "transition-[color,box-shadow,background-color] duration-150",
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
      "data-active:text-foreground data-active:border data-active:border-border",
      "data-active:[background-image:var(--bezel)]",
      "data-active:[box-shadow:var(--shadow-raised)]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<TabsPrimitive.Panel.Props>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Panel
    ref={ref}
    className={cn(
      "mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-md",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
