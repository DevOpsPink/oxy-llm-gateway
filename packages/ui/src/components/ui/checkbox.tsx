import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, defaultChecked, ...props }, ref) => (
    <span className="inline-flex items-center relative">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer h-4 w-4 shrink-0 rounded border border-slate-300 bg-white transition-colors",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "checked:border-[#0066FF] checked:bg-[#0066FF]",
          className
        )}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(e) => {
          onCheckedChange?.(e.target.checked)
          props.onChange?.(e)
        }}
        {...props}
      />
      <Check className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" aria-hidden="true" />
    </span>
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

