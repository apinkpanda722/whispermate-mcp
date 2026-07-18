import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useTheme } from 'next-themes'
import { ThemeToggle } from '@/components/ThemeToggle'

vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ThemeToggle', () => {
  it('라이트 모드일 때 다크 모드 전환 버튼을 렌더링한다', () => {
    const setTheme = vi.fn()
    vi.mocked(useTheme).mockReturnValue({ resolvedTheme: 'light', setTheme } as never)

    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: '다크 모드로 전환' })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('다크 모드일 때 라이트 모드 전환 버튼을 렌더링한다', () => {
    const setTheme = vi.fn()
    vi.mocked(useTheme).mockReturnValue({ resolvedTheme: 'dark', setTheme } as never)

    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: '라이트 모드로 전환' })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('resolvedTheme이 아직 없을 때 다크 모드 전환 버튼으로 취급한다', () => {
    const setTheme = vi.fn()
    vi.mocked(useTheme).mockReturnValue({ resolvedTheme: undefined, setTheme } as never)

    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: '다크 모드로 전환' })).toBeInTheDocument()
  })
})
