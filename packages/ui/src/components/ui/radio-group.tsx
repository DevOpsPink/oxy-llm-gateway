import * as React from "react"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

type RadioGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string
  onValueChange?: (value: string) => void
}

const RadioGroupContext = React.createContext<{
  name: string
  value?: string
  onValueChange?: (value: string) => void
} | null>(null)

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    const name = React.useId()
    return (
      <RadioGroupContext.Provider value={{ name, value, onValueChange }}>
        <div
          ref={ref}
          role="radiogroup"
          className={cn("grid gap-2", className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

type RadioGroupItemProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  value: string
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, disabled, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext)
    const checked = ctx?.value === value
    return (
      <span className="inline-flex items-center gap-2">
        <input
          ref={ref}
          id={id}
          type="radio"
          name={ctx?.name}
          value={value}
          disabled={disabled}
          checked={checked}
          onChange={(e) => {
            if (e.target.checked) {
              ctx?.onValueChange?.(value)
            }
          }}
          className={cn(
            "h-4 w-4 rounded-full border border-slate-300",
            "text-[#0066FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <span className="pointer-events-none text-[#0066FF]">
          {checked ? <Circle className="h-2.5 w-2.5 fill-current text-current" aria-hidden="true" /> : null}
        </span>
      </span>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }

