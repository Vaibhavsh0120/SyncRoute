import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

/*
 * Progress — a recessed track (the well material) filled with the cobalt
 * button material, so the bar reads as liquid sitting inside a carved groove.
 */

const Progress = React.forwardRef<
  HTMLDivElement,
  Omit<ProgressPrimitive.Root.Props, "value"> & {
    value?: ProgressPrimitive.Root.Props["value"]
  }
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value ?? null}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full border border-border",
      "bg-input [box-shadow:var(--shadow-inset)]",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Track className="h-full w-full">
      <ProgressPrimitive.Indicator className="h-full w-full flex-1 rounded-full [background-image:var(--cobalt)] [box-shadow:var(--shadow-primary)] transition-all duration-300" />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>
))
Progress.displayName = "Progress"

export { Progress }
