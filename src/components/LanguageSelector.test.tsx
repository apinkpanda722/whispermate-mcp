import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LanguageSelector } from '@/components/LanguageSelector'

afterEach(() => cleanup())

function openAndSelect(optionName: string) {
  const trigger = screen.getByRole('combobox', { name: '변환 언어 선택' })
  fireEvent.click(trigger)
  const option = screen.getByRole('option', { name: optionName })
  // base-ui's Select ignores plain synthetic clicks unless a pointerdown
  // preceded them (it treats bare clicks with no pointer data as "invalid").
  fireEvent.pointerDown(option, { pointerType: 'mouse' })
  fireEvent.click(option, { detail: 1 })
}

describe('LanguageSelector', () => {
  it('선택된 언어 라벨을 트리거에 표시한다', () => {
    render(<LanguageSelector value="en" onChange={vi.fn()} />)

    const trigger = screen.getByRole('combobox', { name: '변환 언어 선택' })
    expect(trigger).toHaveTextContent('English')
  })

  it('다른 언어를 선택하면 onChange가 새 언어 코드로 호출된다', () => {
    const onChange = vi.fn()
    render(<LanguageSelector value="ko" onChange={onChange} />)

    openAndSelect('English')

    expect(onChange).toHaveBeenCalledWith('en')
  })

  it('disabled일 때 트리거를 비활성화한다', () => {
    render(<LanguageSelector value="ko" onChange={vi.fn()} disabled />)

    const trigger = screen.getByRole('combobox', { name: '변환 언어 선택' })
    expect(trigger).toBeDisabled()
  })

  it('지원하지 않는 언어 코드는 코드 값 그대로 표시한다', () => {
    render(<LanguageSelector value="xx" onChange={vi.fn()} />)

    const trigger = screen.getByRole('combobox', { name: '변환 언어 선택' })
    expect(trigger).toHaveTextContent('xx')
  })
})
