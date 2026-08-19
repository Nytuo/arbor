import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

const Calendar = ({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) => (
  <DayPicker
    showOutsideDays={showOutsideDays}
    className={cn("p-3", className)}
    classNames={{
      months: "flex flex-col gap-2",
      month: "flex flex-col gap-3",
      nav: "flex items-center justify-between absolute inset-x-0 top-0 px-1",
      button_previous: cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "h-7 w-7 p-0",
      ),
      button_next: cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "h-7 w-7 p-0",
      ),
      month_caption: "flex justify-center items-center h-7 text-sm font-bold text-foreground",
      dropdowns: "flex items-center gap-1 text-sm font-bold",
      dropdown_root: "relative",
      dropdown: "absolute inset-0 opacity-0 cursor-pointer",
      caption_label: "text-sm font-bold",
      month_grid: "w-full border-collapse",
      weekdays: "flex",
      weekday: "text-muted-foreground w-8 font-normal text-[0.7rem]",
      week: "flex w-full mt-1",
      day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
      day_button: cn(
        buttonVariants({ variant: "ghost" }),
        "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
      ),
      range_start: "day-range-start",
      range_end: "day-range-end",
      selected:
        "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
      today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
      outside: "text-muted-foreground opacity-50",
      disabled: "text-muted-foreground opacity-30",
      hidden: "invisible",
      ...classNames,
    }}
    components={{
      Chevron: ({ orientation }) =>
        orientation === "left" ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        ),
    }}
    {...props}
  />
);
Calendar.displayName = "Calendar";

export { Calendar };
