import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges static and conditional class names', () => {
    const isActive = true
    const isHidden = false
    expect(cn('base', isActive && 'active', isHidden && 'hidden')).toBe('base active')
  })

  it('resolves conflicting Tailwind utility classes, keeping the last one', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('ignores falsy inputs (undefined, null, empty string)', () => {
    expect(cn('base', undefined, null, '', 'extra')).toBe('base extra')
  })
})
