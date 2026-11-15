import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Security Utilities

/**
 * Sanitize user input to prevent XSS attacks
 * React automatically escapes content, but this provides an extra layer of protection
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .slice(0, 10000) // Limit length to prevent DoS
}

/**
 * Validate and sanitize project name
 */
export function validateProjectName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim()
  
  if (trimmed.length < 1) {
    return { valid: false, error: 'Project name cannot be empty' }
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Project name must be 100 characters or less' }
  }
  
  // Check for potentially dangerous patterns
  if (/[<>\"']/.test(trimmed)) {
    return { valid: false, error: 'Project name contains invalid characters' }
  }
  
  return { valid: true }
}

/**
 * Validate email address
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim()
  
  if (!trimmed) {
    return { valid: false, error: 'Email cannot be empty' }
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address' }
  }
  
  if (trimmed.length > 254) { // RFC 5321 limit
    return { valid: false, error: 'Email address is too long' }
  }
  
  return { valid: true }
}

/**
 * Validate OpenAI API key format
 */
export function validateOpenAIKey(key: string): { valid: boolean; error?: string } {
  const trimmed = key.trim()
  
  if (!trimmed) {
    return { valid: false, error: 'API key cannot be empty' }
  }
  
  const keyRegex = /^(sk-|sk-proj-)[A-Za-z0-9_-]{40,}$/
  if (!keyRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid format. Key should start with "sk-" or "sk-proj-".' }
  }
  
  return { valid: true }
}

/**
 * Validate budget amount
 */
export function validateBudget(budget: string): { valid: boolean; error?: string; value?: number } {
  const trimmed = budget.trim()
  
  if (!trimmed) {
    return { valid: true, value: 0 } // 0 means unlimited
  }
  
  const num = parseFloat(trimmed)
  
  if (isNaN(num)) {
    return { valid: false, error: 'Budget must be a valid number' }
  }
  
  if (num < 0) {
    return { valid: false, error: 'Budget cannot be negative' }
  }
  
  if (num > 999999999.99) { // Max 999M
    return { valid: false, error: 'Budget is too large' }
  }
  
  // Check decimal places
  const decimalPlaces = (trimmed.split('.')[1] || '').length
  if (decimalPlaces > 2) {
    return { valid: false, error: 'Budget can have at most 2 decimal places' }
  }
  
  return { valid: true, value: num }
}

/**
 * Safely escape HTML entities (extra protection layer)
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Safe error message extraction (prevents XSS in error messages)
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only return the message, not the full error object
    return escapeHtml(error.message.slice(0, 500)) // Limit length
  }
  
  if (typeof error === 'string') {
    return escapeHtml(error.slice(0, 500))
  }
  
  return 'An unknown error occurred'
}

/**
 * Validate password strength
 * Minimum: 12 characters, 3+ complexity types
 */
export function validatePassword(password: string): { 
  valid: boolean; 
  error?: string; 
  strength?: 'weak' | 'medium' | 'strong' 
} {
  if (!password) {
    return { valid: false, error: 'Password cannot be empty', strength: 'weak' }
  }
  
  if (password.length < 12) {
    return { 
      valid: false, 
      error: 'Password must be at least 12 characters', 
      strength: 'weak' 
    }
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long (max 128 characters)' }
  }
  
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  
  const complexityScore = [hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length
  
  if (complexityScore < 3) {
    return { 
      valid: false, 
      error: 'Password must include at least 3 of: uppercase, lowercase, number, special character',
      strength: 'weak'
    }
  }
  
  // Check for common passwords (simplified list)
  const commonPasswords = [
    'password', '12345678', 'qwerty', 'letmein', 'admin', 
    'welcome', 'monkey', 'dragon', 'master', 'sunshine'
  ]
  const lowerPass = password.toLowerCase()
  if (commonPasswords.some(common => lowerPass.includes(common))) {
    return { 
      valid: false, 
      error: 'Password is too common. Please choose a more unique password.',
      strength: 'weak'
    }
  }
  
  // Check for sequential characters
  if (/012|123|234|345|456|567|678|789|890|abc|bcd|cde|def/i.test(password)) {
    return {
      valid: false,
      error: 'Password contains sequential characters. Please avoid patterns.',
      strength: 'weak'
    }
  }
  
  // Determine strength
  const strength = password.length >= 16 && complexityScore === 4 ? 'strong' : 'medium'
  
  return { valid: true, strength }
}

/**
 * Debounce function for rate limiting client-side requests
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}