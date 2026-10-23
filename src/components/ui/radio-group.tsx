"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"

import { cn } from "@/lib/utils"

/*
 * RadioGroup — items are recessed wells like the unchecked checkbox.
 * The checked item fills with the exact cobalt button material; the
 * indicator dot is the white top-highlight color so it reads as a lit pip.
 */

// Base UI className can be a state function; the wrapper feeds it to cn(), so
// narrow it to a plain string (same treatment as the other ported files).
type WithClassName<P> = Omit<P, "className"> & { className?: string }

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  WithClassName<RadioGroupPrimitive.Props>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive
    data-slot="radio-group"
    ref={ref}
    className={cn("grid gap-2.5", className)}
    {...props}
  />
))
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  HTMLButtonElement,
  WithClassName<RadioPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <RadioPrimitive.Root
    data-slot="radio-group-item"
    ref={ref}
    className={cn(
      "aspect-square h-4.5 w-4.5 rounded-full border border-border",
      "bg-input [box-shadow:var(--shadow-inset)]",
      "transition-[background-color,box-shadow,border-color] duration-150",
      "hover:border-ring/30",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "data-disabled:cursor-not-allowed data-disabled:opacity-50",
      "data-checked:border-transparent",
      "data-checked:[background-image:var(--cobalt)]",
      "data-checked:[box-shadow:var(--shadow-primary)]",
      className
    )}
    {...props}
  >
    <RadioPrimitive.Indicator data-slot="radio-group-indicator" className="size-full flex items-center justify-center">
      <span className="block h-1.5 w-1.5 rounded-full bg-primary-foreground [box-shadow:0_1px_2px_oklch(0_0_0_/_0.35)]" />
    </RadioPrimitive.Indicator>
  </RadioPrimitive.Root>
))
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
