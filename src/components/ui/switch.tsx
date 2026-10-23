import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/*
 * Switch — off: a recessed well track with a raised bezel thumb riding in it.
 * On: the track adopts the exact cobalt button material (gradient, cyan rim,
 * blue bloom) so the checked state and the primary button read as one metal.
 */

// Base UI className can be a state function; the wrapper feeds it to cn(), so
// narrow it to a plain string (same treatment as the other ported files).
type WithClassName<P> = Omit<P, "className"> & { className?: string }

const Switch = React.forwardRef<
  HTMLButtonElement,
  WithClassName<SwitchPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5.5 w-9.5 shrink-0 cursor-pointer items-center rounded-full border border-border p-0.5",
      "bg-input [box-shadow:var(--shadow-inset)]",
      "transition-[background-color,box-shadow,border-color] duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "data-disabled:cursor-not-allowed data-disabled:opacity-50",
      "data-checked:border-transparent",
      "data-checked:[background-image:var(--cobalt)]",
      "data-checked:[box-shadow:var(--shadow-primary)]",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full",
        "bg-foreground/90 [box-shadow:inset_0_1px_0_oklch(1_0_0_/_0.35),0_1px_2px_oklch(0_0_0_/_0.5)]",
        "transition-transform duration-150",
        "data-checked:translate-x-4 data-checked:bg-primary-foreground",
        "data-unchecked:translate-x-0"
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = "Switch"

export { Switch }
