import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

/*
 * Slider — a carved groove (recessed well track) filled with the exact
 * cobalt button material; the thumb is a raised bezel knob with the same
 * cyan rim so it reads as the control that pushes the liquid.
 */

const Slider = React.forwardRef<HTMLDivElement, SliderPrimitive.Root.Props>(
  ({ className, defaultValue, value, min = 0, max = 100, ...props }, ref) => {
    const _values = Array.isArray(value)
      ? value
      : Array.isArray(defaultValue)
        ? defaultValue
        : [min, max]

    return (
      <SliderPrimitive.Root
        data-slot="slider"
        ref={ref}
        thumbAlignment="edge"
        defaultValue={defaultValue}
        value={value}
        min={min}
        max={max}
        className={cn("relative w-full", className)}
        {...props}
      >
        <SliderPrimitive.Control className="flex w-full touch-none select-none items-center">
          <SliderPrimitive.Track
            data-slot="slider-track"
            className={cn(
              "relative h-2 w-full grow rounded-full border border-border",
              "bg-input [box-shadow:var(--shadow-inset)]"
            )}
          >
            <SliderPrimitive.Indicator data-slot="slider-range" className="absolute h-full rounded-full [background-image:var(--cobalt)] [box-shadow:var(--shadow-primary)]" />
          </SliderPrimitive.Track>
          {Array.from({ length: _values.length }, (_, index) => (
            <SliderPrimitive.Thumb
              data-slot="slider-thumb" key={index}
              className={cn(
                "block h-4.5 w-4.5 rounded-full border border-border",
                "[background-image:var(--bezel)]",
                "[box-shadow:inset_0_1px_0_oklch(1_0_0_/_0.18),inset_0_0_0_1px_oklch(0.75_0.12_235_/_0.25),0_1px_2px_oklch(0_0_0_/_0.45),0_3px_8px_oklch(0_0_0_/_0.35)]",
                "transition-[box-shadow] duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "data-disabled:pointer-events-none data-disabled:opacity-50"
              )}
            />
          ))}
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
