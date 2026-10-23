import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "./toggle"

/* ToggleGroup — toggles inside a shared recessed well, like the Tabs track. */

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

const ToggleGroup = React.forwardRef<
  HTMLDivElement,
  ToggleGroupPrimitive.Props & VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-md p-1",
      "border border-border bg-input [box-shadow:var(--shadow-inset)]",
      className
    )}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive>
))
ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef<
  HTMLButtonElement,
  TogglePrimitive.Props & VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "rounded-sm",
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
})
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
