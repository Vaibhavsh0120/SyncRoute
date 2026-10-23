import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Toggle — idle: a flat ghost. Pressed on: the raised bezel material with a
 * cyan-tinted text so the active state matches the toolbar pills.
 */

const toggleVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium",
    "text-muted-foreground transition-[color,box-shadow,background-color] duration-150",
    "hover:bg-accent hover:text-accent-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:opacity-50",
    "data-pressed:text-foreground data-pressed:border data-pressed:border-border",
    "data-pressed:[background-image:var(--bezel)]",
    "data-pressed:[box-shadow:var(--shadow-raised)]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border bg-transparent",
      },
      size: {
        sm: "h-8 px-2.5 min-w-8",
        default: "h-9 px-3 min-w-9",
        lg: "h-10 px-4 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  HTMLButtonElement,
  TogglePrimitive.Props & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))
Toggle.displayName = "Toggle"

export { Toggle, toggleVariants }
