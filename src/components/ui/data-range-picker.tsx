import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

/* DataRangePicker — the spec's "Oct 08, 2022 - Oct 08, 2023" toolbar pill. */

export function DataRangePicker() {
  const [date, setDate] = React.useState<Date>()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            className={cn(
              "w-70 justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, "PPP") : <span>Pick a date</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
