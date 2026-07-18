import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { TranscriptionResult } from '@/components/TranscriptionResult'

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TranscriptionResult', () => {
  it('text가 빈 문자열이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<TranscriptionResult text="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('변환 결과 텍스트와 복사 버튼을 렌더링한다', () => {
    render(<TranscriptionResult text="안녕하세요" />)

    expect(screen.getByText('변환 결과')).toBeInTheDocument()
    expect(screen.getByText('안녕하세요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '복사' })).toBeInTheDocument()
  })

  it('복사 버튼 클릭 시 클립보드에 복사하고 onCopy를 호출한다', async () => {
    const onCopy = vi.fn()
    render(<TranscriptionResult text="복사할 텍스트" onCopy={onCopy} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '복사' }))
      await Promise.resolve()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('복사할 텍스트')
    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '복사됨' })).toBeInTheDocument()
  })

  it('복사 2초 후 버튼 라벨이 다시 복사로 돌아온다', async () => {
    vi.useFakeTimers()
    render(<TranscriptionResult text="타이머 테스트" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '복사' }))
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: '복사됨' })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByRole('button', { name: '복사' })).toBeInTheDocument()
  })
})
