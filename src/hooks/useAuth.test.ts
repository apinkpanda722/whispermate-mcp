import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

const { mockGetSession, mockSignInAnonymously, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignInAnonymously: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInAnonymously: mockSignInAnonymously,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })

  it('세션이 있으면 해당 세션의 사용자로 설정하고 익명 로그인을 시도하지 않는다', async () => {
    const existingUser = { id: 'user-1' } as User
    mockGetSession.mockResolvedValue({ data: { session: { user: existingUser } } })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user).toEqual(existingUser)
    expect(mockSignInAnonymously).not.toHaveBeenCalled()
  })

  it('세션이 없으면 익명 로그인을 시도해 반환된 사용자로 설정한다', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const anonUser = { id: 'anon-1' } as User
    mockSignInAnonymously.mockResolvedValue({ data: { user: anonUser }, error: null })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockSignInAnonymously).toHaveBeenCalled()
    expect(result.current.user).toEqual(anonUser)
  })

  it('익명 로그인이 실패하면 콘솔에 에러를 로깅하고 loading을 종료한다', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const authError = { message: 'anon login failed' }
    mockSignInAnonymously.mockResolvedValue({ data: { user: null }, error: authError })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.user).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith('익명 로그인 실패:', authError)

    consoleErrorSpy.mockRestore()
  })

  it('onAuthStateChange 콜백이 실행되면 최신 세션의 사용자로 갱신한다', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'initial' } } } })
    let authChangeCallback: ((event: string, session: { user: User } | null) => void) | undefined
    mockOnAuthStateChange.mockImplementation((callback) => {
      authChangeCallback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const updatedUser = { id: 'updated' } as User
    act(() => {
      authChangeCallback?.('SIGNED_IN', { user: updatedUser })
    })

    expect(result.current.user).toEqual(updatedUser)
  })
})
