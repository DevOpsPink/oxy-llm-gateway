/**
 * KEYBOARD SHORTCUTS (POWER USER FEATURE)
 * ========================================
 * 
 * Shortcuts:
 * - Cmd/Ctrl + K: Command palette
 * - Cmd/Ctrl + D: Dashboard
 * - Cmd/Ctrl + S: Settings
 * - Cmd/Ctrl + P: Projects
 * - Cmd/Ctrl + /: Show shortcuts help
 * - Escape: Close modals/dialogs
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type ShortcutHandler = () => void

interface Shortcut {
  key: string
  ctrlOrCmd: boolean
  shift?: boolean
  alt?: boolean
  description: string
  handler: ShortcutHandler
}

export function useHotkeys() {
  const router = useRouter()

  useEffect(() => {
    const shortcuts: Shortcut[] = [
      {
        key: 'd',
        ctrlOrCmd: true,
        description: 'Go to Dashboard',
        handler: () => router.push('/dashboard')
      },
      {
        key: 's',
        ctrlOrCmd: true,
        description: 'Go to Settings',
        handler: () => router.push('/settings')
      },
      {
        key: 'p',
        ctrlOrCmd: true,
        description: 'Go to Projects',
        handler: () => router.push('/dashboard#projects')
      },
      {
        key: '/',
        ctrlOrCmd: true,
        description: 'Show keyboard shortcuts',
        handler: () => {
          // Show modal with all shortcuts
          const shortcutsHelp = shortcuts.map((s: Shortcut) => 
            `${s.ctrlOrCmd ? 'Cmd/Ctrl + ' : ''}${s.shift ? 'Shift + ' : ''}${s.key.toUpperCase()}: ${s.description}`
          ).join('\n')
          
          alert(`KEYBOARD SHORTCUTS:\n\n${shortcutsHelp}\n\nEscape: Close modals`)
        }
      }
    ]

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return
      }

      // Match shortcuts
      for (const shortcut of shortcuts) {
        const matchesCtrlOrCmd = shortcut.ctrlOrCmd ? (e.metaKey || e.ctrlKey) : true
        const matchesShift = shortcut.shift ? e.shiftKey : true
        const matchesAlt = shortcut.alt ? e.altKey : true
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (matchesCtrlOrCmd && matchesShift && matchesAlt && matchesKey) {
          e.preventDefault()
          shortcut.handler()
          break
        }
      }

      // Escape key: close modals (generic handler)
      if (e.key === 'Escape') {
        // Dispatch custom event that modals can listen to
        window.dispatchEvent(new CustomEvent('hotkey-escape'))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])
}

/**
 * Helper component to display keyboard shortcuts hint
 */
export function KeyboardShortcutsHint() {
  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm opacity-70 hover:opacity-100 transition-opacity">
      Press <kbd className="px-2 py-1 bg-slate-700 rounded">Cmd/Ctrl + /</kbd> for shortcuts
    </div>
  )
}

