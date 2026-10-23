"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * Checkbox — unchecked: a recessed well sunk into the panel (the inverse of
 * a raised control). Checked: the exact cobalt button material, scaled down:
 * blue vertical gradient, white top highlight, cyan rim, blue outer bloom.
 */

// Base UI className can be a state function; the wrapper feeds it to cn(), so
// narrow it to a plain string (same treatment as the other ported files).
type WithClassName<P> = Omit<P, "className"> & { className?: string }

const Checkbox = React.forwardRef<
  HTMLButtonElement,
  WithClassName<CheckboxPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    data-slot="checkbox"
    ref={ref}
    className={cn(
      "peer h-4.5 w-4.5 shrink-0 rounded-sm border border-border",
      "bg-input [box-shadow:var(--shadow-inset)]",
      "transition-[background-color,box-shadow,border-color] duration-150",
      "hover:border-ring/30",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "data-disabled:cursor-not-allowed data-disabled:opacity-50",
      "data-checked:border-transparent data-checked:bg-transparent",
      "data-checked:[background-image:var(--cobalt)]",
      "data-checked:[box-shadow:var(--shadow-primary)]",
      "data-checked:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="size-full flex items-center justify-center text-current">
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
