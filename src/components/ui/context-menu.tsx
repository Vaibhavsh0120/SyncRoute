import * as React from "react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

/* ContextMenu — the same floating carved panel as DropdownMenu. */

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuGroup = ContextMenuPrimitive.Group
const ContextMenuPortal = ContextMenuPrimitive.Portal
const ContextMenuSub = ContextMenuPrimitive.SubmenuRoot
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none",
        "focus:bg-accent focus:text-accent-foreground data-popup-open:bg-accent",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger"

function ContextMenuSubContent({
  className,
  align = "start",
  alignOffset = 4,
  side = "right",
  sideOffset = 0,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<
    ContextMenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          className={cn(
            "z-50 min-w-32 overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground",
            "[box-shadow:var(--shadow-pop)]",
            "transition-[transform,translate,scale,opacity] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=top]:data-starting-style:translate-y-2",
            className
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}
ContextMenuSubContent.displayName = "ContextMenuSubContent"

function ContextMenuContent({
  className,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="isolate z-50 outline-none">
        <ContextMenuPrimitive.Popup
          className={cn(
            "z-50 min-w-32 overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground",
            "[box-shadow:var(--shadow-pop)]",
            "transition-[transform,translate,scale,opacity] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95",
            className
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}
ContextMenuContent.displayName = "ContextMenuContent"

function ContextMenuItem({
  className,
  inset,
  ...props
}: ContextMenuPrimitive.Item.Props & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none",
        "transition-colors focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}
ContextMenuItem.displayName = "ContextMenuItem"

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ContextMenuPrimitive.CheckboxItem.Props) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-foreground outline-none",
        "transition-colors focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <Check className="h-4 w-4 text-primary" />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem"

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ContextMenuPrimitive.RadioItem.Props) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-foreground outline-none",
        "transition-colors focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <ContextMenuPrimitive.RadioItemIndicator>
          <Circle className="h-2 w-2 fill-primary text-primary" />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}
ContextMenuRadioItem.displayName = "ContextMenuRadioItem"

function ContextMenuLabel({
  className,
  inset,
  ...props
}: ContextMenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}
ContextMenuLabel.displayName = "ContextMenuLabel"

function ContextMenuSeparator({
  className,
  ...props
}: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("-mx-1.5 my-1.5 h-px bg-border", className)}
      {...props}
    />
  )
}
ContextMenuSeparator.displayName = "ContextMenuSeparator"

const ContextMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground/70", className)}
      {...props}
    />
  )
}
ContextMenuShortcut.displayName = "ContextMenuShortcut"

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
