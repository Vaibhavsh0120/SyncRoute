export const formFieldBase =
  "w-full px-3 text-sm " +
  "bg-input text-foreground " +
  "border border-border " +
  "placeholder:text-muted-foreground " +
  "transition-[color,box-shadow,border-color] duration-150 " +
  "[box-shadow:var(--shadow-inset)] " +
  "hover:border-ring/30 " +
  "focus-visible:outline-none focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/35 " +
  "disabled:cursor-not-allowed disabled:opacity-50"

export const formFieldSingleLine = "flex h-9 py-1.5 rounded-md"
export const formFieldMultiLine = "flex min-h-20 py-2 resize-y rounded-lg"
