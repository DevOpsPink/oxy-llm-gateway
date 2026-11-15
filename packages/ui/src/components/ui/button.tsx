import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * UNIFIED BUTTON SYSTEM - Standard
 * ==============================================
 * 
 * Design tokens:
 * - Border radius: xl (1rem / 16px) for all buttons
 * - Transition: 200ms ease-out
 * - Shadow: brand-specific glow effects
 * - Hover: -translate-y-0.5 + shadow increase
 * 
 * Variants:
 * - default: Primary CTA (violet gradient - AI aesthetic)
 * - oxy: BRAND CTA (#0066FF - Oxy Blue)
 * - outline: Secondary action
 * - secondary: Subtle background
 * - ghost: Minimal
 * - destructive: Danger actions
 * - link: Text link
 */

const buttonVariants = cva(
  // Base styles - UNIFIED across all variants
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 ease-out cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 rounded-xl",
  {
    variants: {
      variant: {
        // Primary CTA - Imperial Gradient (AI aesthetic)
        default: "bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/35 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg",
        
        // 🎨 OXY BRAND CTA - #0066FF
        oxy: "bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-lg shadow-[#0066FF]/25 hover:shadow-xl hover:shadow-[#0066FF]/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg",
        
        // Outline - Secondary
        outline: "border-2 border-slate-200 bg-white text-slate-700 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        
        // Secondary - Subtle bg
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 hover:-translate-y-0.5 active:translate-y-0",
        
        // Ghost - Minimal
        ghost: "text-slate-600 hover:text-violet-600 hover:bg-violet-50 active:bg-violet-100",
        
        // Destructive - Danger
        destructive: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 hover:-translate-y-0.5 active:translate-y-0",
        
        // Link - Text only
        link: "text-violet-600 underline-offset-4 hover:underline hover:text-violet-700 p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "h-10 w-10 p-0",
        "icon-sm": "h-8 w-8 p-0 rounded-lg",
        "icon-lg": "h-12 w-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }