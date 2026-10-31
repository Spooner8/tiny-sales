import * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { de } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * shadcn-style calendar on top of react-day-picker, styled entirely via
 * classNames (no react-day-picker stylesheet) so it follows the theme tokens.
 */
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      locale={de}
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4", defaults.months),
        month: cn("flex w-full flex-col gap-3", defaults.month),
        nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", defaults.nav),
        button_previous: cn(buttonVariants({ variant: "ghost" }), "size-8 p-0", defaults.button_previous),
        button_next: cn(buttonVariants({ variant: "ghost" }), "size-8 p-0", defaults.button_next),
        month_caption: cn("flex h-8 items-center justify-center px-10", defaults.month_caption),
        caption_label: cn("text-sm font-semibold capitalize", defaults.caption_label),
        month_grid: cn("w-full border-collapse", defaults.month_grid),
        weekdays: cn("flex", defaults.weekdays),
        weekday: cn("w-9 text-center text-xs font-medium text-muted-foreground", defaults.weekday),
        week: cn("mt-1 flex w-full", defaults.week),
        day: cn("size-9 p-0 text-center text-sm", defaults.day),
        day_button: cn(
          "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          defaults.day_button,
        ),
        selected: cn(
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
          defaults.selected,
        ),
        today: cn("[&>button]:font-bold [&>button]:ring-1 [&>button]:ring-primary/50", defaults.today),
        outside: cn("[&>button]:text-muted-foreground [&>button]:opacity-50", defaults.outside),
        disabled: cn("[&>button]:pointer-events-none [&>button]:opacity-40", defaults.disabled),
        hidden: cn("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />,
      }}
      {...props}
    />
  );
}
