/**
 * UNIFIED DESIGN SYSTEM TOKENS v2.0
 * ==================================
 * 
 * This file contains all design tokens and utility functions
 * for maintaining consistency across the entire application.
 * 
 * Goals:
 * - Unified aesthetics across all components
 * - Consistent, predictable patterns
 * - Accessible design
 */

// ============================================================================
// SPACING TOKENS (8px base grid)
// ============================================================================

export const spacing = {
  '1': '0.25rem',   // 4px
  '2': '0.5rem',    // 8px
  '3': '0.75rem',   // 12px
  '4': '1rem',      // 16px
  '5': '1.25rem',   // 20px
  '6': '1.5rem',    // 24px
  '8': '2rem',      // 32px
  '10': '2.5rem',   // 40px
  '12': '3rem',     // 48px - sub-section
  '16': '4rem',     // 64px - section
  '20': '5rem',     // 80px - primary section
  '24': '6rem',     // 96px - hero
} as const

// Section spacing presets
export const sectionSpacing = {
  hero: 'py-16 sm:py-20',
  primary: 'py-16 sm:py-20',
  secondary: 'py-12 sm:py-16',
  compact: 'py-8 sm:py-12',
} as const

// ============================================================================
// BORDER RADIUS TOKENS
// ============================================================================

export const borderRadius = {
  sm: '0.375rem',   // 6px - small buttons, badges
  md: '0.5rem',     // 8px - inputs, small cards
  lg: '0.75rem',    // 12px - buttons, cards (DEFAULT)
  xl: '1rem',       // 16px - large cards
  '2xl': '1.25rem', // 20px - pricing cards
  '3xl': '1.5rem',  // 24px - hero cards
  full: '9999px',   // pills, badges
} as const

// ============================================================================
// ANIMATION TOKENS (UNIFIED: 150-200ms)
// ============================================================================

export const animation = {
  // Duration
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  
  // Easing
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

// Framer Motion animation presets
export const motionPresets = {
  fadeIn: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
  fadeInStagger: (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] },
  }),
  slideIn: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
} as const

// Viewport settings for whileInView animations
export const viewportSettings = {
  default: { once: true, margin: '-50px' },
  eager: { once: true, margin: '-100px' },
} as const

// ============================================================================
// COLOR TOKENS (Brand Palette)
// ============================================================================

export const colors = {
  // Primary (Violet)
  violet: {
    DEFAULT: '#8B5CF6',
    hover: '#7C3AED',
    light: '#EDE9FE',
  },
  
  // Secondary (Blue)
  blue: {
    DEFAULT: '#3B82F6',
    hover: '#2563EB',
    light: '#DBEAFE',
  },
  
  // Accent (Cyan)
  cyan: {
    DEFAULT: '#06B6D4',
    hover: '#0891B2',
    light: '#CFFAFE',
  },
  
  // Alert (Pink)
  pink: {
    DEFAULT: '#EC4899',
    light: '#FCE7F3',
  },
  
  // Success
  success: {
    DEFAULT: '#10B981',
    light: '#D1FAE5',
  },
  
  // Neutral
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
} as const

// ============================================================================
// SHADOW TOKENS
// ============================================================================

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  glow: '0 8px 30px rgba(139, 92, 246, 0.25)',
  glowHover: '0 12px 40px rgba(139, 92, 246, 0.35)',
} as const

// ============================================================================
// BUTTON STYLE PRESETS
// ============================================================================

export const buttonStyles = {
  // Primary CTA - Imperial Gradient (use as default)
  primary: 'bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/35 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg',
  
  // Secondary - Outline
  secondary: 'border-2 border-slate-200 bg-white text-slate-700 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
  
  // Ghost - Minimal
  ghost: 'text-slate-600 hover:text-violet-600 hover:bg-violet-50 active:bg-violet-100',
  
  // Base styles (always applied)
  base: 'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 ease-out cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 rounded-xl',
} as const

// ============================================================================
// ICON CONTAINER PRESETS
// ============================================================================

export const iconContainer = {
  base: 'flex items-center justify-center rounded-xl transition-all duration-200',
  sizes: {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  },
  variants: {
    default: 'bg-slate-100 hover:bg-slate-200 hover:scale-105',
    discord: 'bg-[#5865F2]/10 hover:bg-[#5865F2]/20 hover:scale-105',
    linkedin: 'bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 hover:scale-105',
    youtube: 'bg-[#FF0000]/10 hover:bg-[#FF0000]/20 hover:scale-105',
  },
} as const

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================

export const typography = {
  // Headings (use with font-display)
  h1: 'text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-tight tracking-tight',
  h2: 'text-3xl sm:text-4xl font-display font-bold leading-tight',
  h3: 'text-xl sm:text-2xl font-display font-bold',
  h4: 'text-lg font-semibold',
  
  // Body
  body: 'text-base leading-relaxed',
  bodySmall: 'text-sm leading-relaxed',
  
  // Labels
  label: 'text-sm font-medium',
  labelSmall: 'text-xs font-semibold uppercase tracking-wide',
} as const

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Combines class names, filtering out falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Creates staggered animation delays for a list of items
 */
export function staggerDelay(index: number, baseDelay: number = 0, staggerAmount: number = 0.05): number {
  return baseDelay + (index * staggerAmount)
}

