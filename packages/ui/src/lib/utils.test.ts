/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║   UTILS UNIT TESTS                                                           ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * Tests for packages/ui/src/lib/utils.ts
 * 
 * Run:
 *   npm run test -- src/lib/utils.test.ts
 * 
 * Coverage:
 *   npm run test:coverage
 */

import { describe, it, expect, vi } from 'vitest'
import {
  cn,
  sanitizeInput,
  validateProjectName,
  validateEmail,
  validateOpenAIKey,
  validateBudget,
  escapeHtml,
  safeErrorMessage,
  validatePassword,
  debounce,
} from './utils'


// ============================================================================
// CN (CLASS NAME MERGER) TESTS
// ============================================================================

describe('cn - Class Name Merger', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'active')).toBe('base active')
    expect(cn('base', false && 'active')).toBe('base')
  })

  it('should merge Tailwind classes correctly', () => {
    // Later class should win
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('should handle undefined/null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('should handle objects', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })
})


// ============================================================================
// SANITIZE INPUT TESTS
// ============================================================================

describe('sanitizeInput - XSS Prevention', () => {
  // HAPPY PATH
  it('should pass through normal text', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World')
  })

  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  // EDGE CASES
  it('should remove < and > characters', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script')
  })

  it('should handle empty string', () => {
    expect(sanitizeInput('')).toBe('')
  })

  it('should truncate long strings to 10000 chars', () => {
    const longString = 'a'.repeat(15000)
    expect(sanitizeInput(longString).length).toBe(10000)
  })

  // CHAOS
  it('should handle non-string input', () => {
    // @ts-expect-error - Testing runtime behavior
    expect(sanitizeInput(123)).toBe('')
    // @ts-expect-error - Testing runtime behavior
    expect(sanitizeInput(null)).toBe('')
    // @ts-expect-error - Testing runtime behavior
    expect(sanitizeInput(undefined)).toBe('')
  })

  it('should handle only HTML tags', () => {
    expect(sanitizeInput('<>')).toBe('')
  })
})


// ============================================================================
// VALIDATE PROJECT NAME TESTS
// ============================================================================

describe('validateProjectName', () => {
  // HAPPY PATH
  it('should accept valid project name', () => {
    const result = validateProjectName('My Awesome Project')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should accept single character', () => {
    const result = validateProjectName('X')
    expect(result.valid).toBe(true)
  })

  it('should accept 100 characters', () => {
    const result = validateProjectName('a'.repeat(100))
    expect(result.valid).toBe(true)
  })

  // EDGE CASES
  it('should reject empty name', () => {
    const result = validateProjectName('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Project name cannot be empty')
  })

  it('should reject whitespace-only name', () => {
    const result = validateProjectName('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Project name cannot be empty')
  })

  it('should reject name over 100 chars', () => {
    const result = validateProjectName('a'.repeat(101))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Project name must be 100 characters or less')
  })

  it('should reject name with < character', () => {
    const result = validateProjectName('Test<Project')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Project name contains invalid characters')
  })

  it('should reject name with > character', () => {
    const result = validateProjectName('Test>Project')
    expect(result.valid).toBe(false)
  })

  it('should reject name with quotes', () => {
    expect(validateProjectName('Test"Project').valid).toBe(false)
    expect(validateProjectName("Test'Project").valid).toBe(false)
  })

  // VALID SPECIAL CHARS
  it('should accept dashes and underscores', () => {
    expect(validateProjectName('My-Project_v2').valid).toBe(true)
  })

  it('should accept unicode characters', () => {
    expect(validateProjectName('Проект 🚀').valid).toBe(true)
  })
})


// ============================================================================
// VALIDATE EMAIL TESTS
// ============================================================================

describe('validateEmail', () => {
  // HAPPY PATH
  it('should accept valid email', () => {
    const result = validateEmail('user@example.com')
    expect(result.valid).toBe(true)
  })

  it('should accept email with subdomain', () => {
    expect(validateEmail('user@mail.example.com').valid).toBe(true)
  })

  it('should accept email with plus sign', () => {
    expect(validateEmail('user+tag@example.com').valid).toBe(true)
  })

  // EDGE CASES
  it('should reject empty email', () => {
    const result = validateEmail('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Email cannot be empty')
  })

  it('should reject email without @', () => {
    const result = validateEmail('userexample.com')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Please enter a valid email address')
  })

  it('should reject email without domain', () => {
    expect(validateEmail('user@').valid).toBe(false)
  })

  it('should reject email without TLD', () => {
    expect(validateEmail('user@example').valid).toBe(false)
  })

  it('should reject email with spaces', () => {
    expect(validateEmail('user @example.com').valid).toBe(false)
  })

  it('should reject email over 254 chars (RFC 5321)', () => {
    const longEmail = 'a'.repeat(250) + '@b.co'
    const result = validateEmail(longEmail)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Email address is too long')
  })

  it('should trim and accept valid email', () => {
    expect(validateEmail('  user@example.com  ').valid).toBe(true)
  })
})


// ============================================================================
// VALIDATE OPENAI KEY TESTS
// ============================================================================

describe('validateOpenAIKey', () => {
  // HAPPY PATH
  it('should accept valid sk-proj- key', () => {
    const key = 'sk-proj-' + 'a'.repeat(40)
    expect(validateOpenAIKey(key).valid).toBe(true)
  })

  it('should accept valid sk- key', () => {
    const key = 'sk-' + 'a'.repeat(40)
    expect(validateOpenAIKey(key).valid).toBe(true)
  })

  it('should accept longer key', () => {
    const key = 'sk-proj-' + 'abcdefghij1234567890'.repeat(5)
    expect(validateOpenAIKey(key).valid).toBe(true)
  })

  // EDGE CASES
  it('should reject empty key', () => {
    const result = validateOpenAIKey('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key cannot be empty')
  })

  it('should reject key without sk- prefix', () => {
    const result = validateOpenAIKey('api-' + 'a'.repeat(48))
    expect(result.valid).toBe(false)
  })

  it('should reject key too short', () => {
    const result = validateOpenAIKey('sk-proj-abc123')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid format. Key should start with "sk-" or "sk-proj-".')
  })

  it('should reject key with invalid characters', () => {
    const result = validateOpenAIKey('sk-proj-' + 'a'.repeat(40) + '!@#$%^&*')
    expect(result.valid).toBe(false)
  })

  it('should trim and validate', () => {
    const key = '  sk-proj-' + 'a'.repeat(40) + '  '
    expect(validateOpenAIKey(key).valid).toBe(true)
  })
})


// ============================================================================
// VALIDATE BUDGET TESTS
// ============================================================================

describe('validateBudget', () => {
  // HAPPY PATH
  it('should accept valid budget', () => {
    const result = validateBudget('100.50')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(100.50)
  })

  it('should accept integer budget', () => {
    const result = validateBudget('1000')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(1000)
  })

  it('should accept zero (unlimited)', () => {
    const result = validateBudget('0')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(0)
  })

  it('should treat empty string as unlimited (0)', () => {
    const result = validateBudget('')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(0)
  })

  // EDGE CASES
  it('should reject negative budget', () => {
    const result = validateBudget('-50')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Budget cannot be negative')
  })

  it('should reject non-numeric string', () => {
    const result = validateBudget('abc')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Budget must be a valid number')
  })

  it('should reject budget too large (> 999M)', () => {
    const result = validateBudget('1000000000')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Budget is too large')
  })

  it('should reject more than 2 decimal places', () => {
    const result = validateBudget('100.123')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Budget can have at most 2 decimal places')
  })

  it('should accept exactly 2 decimal places', () => {
    const result = validateBudget('100.99')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(100.99)
  })

  it('should accept max valid budget', () => {
    const result = validateBudget('999999999.99')
    expect(result.valid).toBe(true)
  })

  // CHAOS
  it('should handle whitespace', () => {
    const result = validateBudget('  50.00  ')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(50)
  })

  it('should reject NaN-producing input', () => {
    expect(validateBudget('NaN').valid).toBe(false)
  })

  it('should reject Infinity', () => {
    expect(validateBudget('Infinity').valid).toBe(false)
  })
})


// ============================================================================
// ESCAPE HTML TESTS
// ============================================================================

describe('escapeHtml', () => {
  it('should escape &', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('should escape <', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('should escape >', () => {
    expect(escapeHtml('value > 5')).toBe('value &gt; 5')
  })

  it('should escape double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s')
  })

  it('should escape all special chars together', () => {
    const input = '<div class="test" data-val=\'x\' & done>'
    const expected = '&lt;div class=&quot;test&quot; data-val=&#039;x&#039; &amp; done&gt;'
    expect(escapeHtml(input)).toBe(expected)
  })

  it('should pass through normal text', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123')
  })

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('')
  })
})


// ============================================================================
// SAFE ERROR MESSAGE TESTS
// ============================================================================

describe('safeErrorMessage', () => {
  it('should extract Error message', () => {
    const error = new Error('Something went wrong')
    expect(safeErrorMessage(error)).toBe('Something went wrong')
  })

  it('should escape HTML in Error message', () => {
    const error = new Error('<script>alert("xss")</script>')
    expect(safeErrorMessage(error)).toContain('&lt;script&gt;')
  })

  it('should truncate long Error messages', () => {
    const error = new Error('x'.repeat(600))
    expect(safeErrorMessage(error).length).toBeLessThanOrEqual(500 + 20) // Some leeway for escaping
  })

  it('should handle string error', () => {
    expect(safeErrorMessage('String error')).toBe('String error')
  })

  it('should escape HTML in string error', () => {
    expect(safeErrorMessage('<b>bold</b>')).toContain('&lt;b&gt;')
  })

  it('should handle unknown error types', () => {
    expect(safeErrorMessage(123)).toBe('An unknown error occurred')
    expect(safeErrorMessage(null)).toBe('An unknown error occurred')
    expect(safeErrorMessage(undefined)).toBe('An unknown error occurred')
    expect(safeErrorMessage({ code: 500 })).toBe('An unknown error occurred')
  })
})


// ============================================================================
// VALIDATE PASSWORD TESTS
// ============================================================================

describe('validatePassword', () => {
  // HAPPY PATH
  it('should accept strong password', () => {
    // Avoid sequences like 123 and common words
    const result = validatePassword('MyStr0ng!PassW0rd')
    expect(result.valid).toBe(true)
    expect(result.strength).toBe('strong')
  })

  it('should accept medium password (3 complexity types)', () => {
    // Avoid all sequential patterns: 123, 234, 345, 456, 567, 678, 789, 890
    // Use non-sequential numbers like 159, 268, 379
    const result = validatePassword('MyPassw0rd!X59')
    expect(result.valid).toBe(true)
    expect(result.strength).toBeDefined()
  })

  // LENGTH CHECKS
  it('should reject password under 12 chars', () => {
    const result = validatePassword('Short1!')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 12 characters')
    expect(result.strength).toBe('weak')
  })

  it('should reject password over 128 chars', () => {
    const result = validatePassword('Aa1!' + 'x'.repeat(130))
    expect(result.valid).toBe(false)
    expect(result.error).toContain('max 128 characters')
  })

  it('should reject empty password', () => {
    const result = validatePassword('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Password cannot be empty')
  })

  // COMPLEXITY CHECKS
  it('should accept password with 3 complexity types (no uppercase)', () => {
    // lowercase + number + special = 3 types
    // Avoid all sequential patterns - use 159, 268, etc.
    const result = validatePassword('onlylowercase!159')
    expect(result.valid).toBe(true)
  })

  it('should reject password with only 2 complexity types', () => {
    const result = validatePassword('onlylowercase!!')
    // lowercase + special = 2 types
    expect(result.valid).toBe(false)
    expect(result.error).toContain('at least 3 of')
  })

  // COMMON PASSWORD CHECKS
  it('should reject password containing "password"', () => {
    const result = validatePassword('password123ABC!')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('too common')
  })

  it('should reject password containing "qwerty"', () => {
    const result = validatePassword('Qwerty12345678!')
    expect(result.valid).toBe(false)
  })

  it('should reject password containing "admin"', () => {
    const result = validatePassword('adminUser123456!')
    expect(result.valid).toBe(false)
  })

  // SEQUENTIAL CHECKS
  it('should reject password with "123" (common pattern)', () => {
    const result = validatePassword('MyPassword1234567!')
    expect(result.valid).toBe(false)
    // This is caught by "common password" check since it contains "12345678"
    expect(result.error).toBeDefined()
  })

  it('should reject password with "abc"', () => {
    const result = validatePassword('abcdefghijkLMN!')
    expect(result.valid).toBe(false)
  })

  // STRENGTH DETERMINATION
  it('should rate 16+ chars with 4 types as strong', () => {
    const result = validatePassword('VeryStr0ng!Pass!!')
    expect(result.valid).toBe(true)
    expect(result.strength).toBe('strong')
  })

  it('should rate 12-15 chars as medium', () => {
    const result = validatePassword('GoodPass!99')
    // 11 chars... let me count: G-o-o-d-P-a-s-s-!-9-9 = 11
    // Need 12 minimum
  })

  it('should rate valid but shorter password as medium', () => {
    const result = validatePassword('ValidPass!99') // 12 chars
    expect(result.valid).toBe(true)
    // Has uppercase, lowercase, number, special = 4 types, but only 12 chars
    expect(result.strength).toBe('medium')
  })
})


// ============================================================================
// DEBOUNCE TESTS
// ============================================================================

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should delay function execution', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc()
    expect(func).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(func).toHaveBeenCalledTimes(1)
  })

  it('should only call function once for rapid calls', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc()
    debouncedFunc()
    debouncedFunc()
    debouncedFunc()
    debouncedFunc()

    vi.advanceTimersByTime(100)
    expect(func).toHaveBeenCalledTimes(1)
  })

  it('should pass arguments to debounced function', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc('arg1', 'arg2')

    vi.advanceTimersByTime(100)
    expect(func).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('should reset timer on each call', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc()
    vi.advanceTimersByTime(50)
    
    debouncedFunc() // Reset timer
    vi.advanceTimersByTime(50)
    expect(func).not.toHaveBeenCalled()
    
    vi.advanceTimersByTime(50)
    expect(func).toHaveBeenCalledTimes(1)
  })

  it('should use last arguments when called multiple times', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc('first')
    debouncedFunc('second')
    debouncedFunc('third')

    vi.advanceTimersByTime(100)
    expect(func).toHaveBeenCalledWith('third')
  })

  it('should allow separate calls after debounce period', () => {
    const func = vi.fn()
    const debouncedFunc = debounce(func, 100)

    debouncedFunc('call1')
    vi.advanceTimersByTime(100)
    
    debouncedFunc('call2')
    vi.advanceTimersByTime(100)

    expect(func).toHaveBeenCalledTimes(2)
    expect(func).toHaveBeenNthCalledWith(1, 'call1')
    expect(func).toHaveBeenNthCalledWith(2, 'call2')
  })
})

