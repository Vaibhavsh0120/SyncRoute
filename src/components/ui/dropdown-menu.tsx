import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

/*
 * DropdownMenu — a floating carved panel (bg-popover, --shadow-pop) like the
 * spec's date-range and "This month" menus. Items highlight with the quiet
 * accent wash, never a heavy fill.
 */

const DropdownMenu = MenuPrimitive.Root
const DropdownMenuTrigger = MenuPrimitive.Trigger
const DropdownMenuGroup = MenuPrimitive.Group
const DropdownMenuPortal = MenuPrimitive.Portal
const DropdownMenuSub = MenuPrimitive.SubmenuRoot
const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
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
    </MenuPrimitive.SubmenuTrigger>
  )
}
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger"

function DropdownMenuSubContent({
  className,
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "z-50 min-w-32 overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground",
            "[box-shadow:var(--shadow-pop)]",
            "transition-[transform,translate,scale,opacity] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=top]:data-starting-style:translate-y-2",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}
DropdownMenuSubContent.displayName = "DropdownMenuSubContent"

function DropdownMenuContent({
  className,
  align,
  alignOffset,
  side,
  sideOffset = 6,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            "z-50 min-w-32 overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground",
            "[box-shadow:var(--shadow-pop)]",
            "transition-[transform,translate,scale,opacity] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=top]:data-starting-style:translate-y-2",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}
DropdownMenuContent.displayName = "DropdownMenuContent"

function DropdownMenuItem({
  className,
  inset,
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.Item
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
DropdownMenuItem.displayName = "DropdownMenuItem"

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
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
        <MenuPrimitive.CheckboxItemIndicator>
          <Check className="h-4 w-4 text-primary" />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-foreground outline-none",
        "transition-colors focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <Circle className="h-2 w-2 fill-primary text-primary" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}
DropdownMenuLabel.displayName = "DropdownMenuLabel"

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      className={cn("-mx-1.5 my-1.5 h-px bg-border", className)}
      {...props}
    />
  )
}
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuShortcut = ({
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
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
