import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SettingsPanel } from '@/components/SettingsPanel'

afterEach(() => cleanup())

describe('SettingsPanel', () => {
  it('현재 언어와 단축키, 저장 버튼을 렌더링한다', () => {
    render(
      <SettingsPanel
        language="ko"
        onLanguageChange={vi.fn()}
        shortcut="CommandOrControl+Shift+R"
        onShortcutChange={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByText('설정')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '변환 언어 선택' })).toHaveTextContent('한국어')
    expect(
      screen.getByRole('button', { name: 'CommandOrControl+Shift+R' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('저장 버튼 클릭 시 onSave를 호출한다', () => {
    const onSave = vi.fn()
    render(
      <SettingsPanel
        language="ko"
        onLanguageChange={vi.fn()}
        shortcut="CommandOrControl+Shift+R"
        onShortcutChange={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('단축키 버튼을 누른 뒤 키를 입력하면 새 단축키로 변경된다', () => {
    const onShortcutChange = vi.fn()
    render(
      <SettingsPanel
        language="ko"
        onLanguageChange={vi.fn()}
        shortcut="CommandOrControl+Shift+R"
        onShortcutChange={onShortcutChange}
        onSave={vi.fn()}
      />,
    )

    const shortcutButton = screen.getByRole('button', { name: 'CommandOrControl+Shift+R' })
    fireEvent.click(shortcutButton)
    expect(screen.getByRole('button', { name: '키를 입력하세요...' })).toBeInTheDocument()

    fireEvent.keyDown(shortcutButton, { key: 'r', ctrlKey: true })

    expect(onShortcutChange).toHaveBeenCalledWith('CommandOrControl+R')
  })

  it('modifier 키만 누르면 단축키가 변경되지 않고 계속 입력 대기 상태를 유지한다', () => {
    const onShortcutChange = vi.fn()
    render(
      <SettingsPanel
        language="ko"
        onLanguageChange={vi.fn()}
        shortcut="CommandOrControl+Shift+R"
        onShortcutChange={onShortcutChange}
        onSave={vi.fn()}
      />,
    )

    const shortcutButton = screen.getByRole('button', { name: 'CommandOrControl+Shift+R' })
    fireEvent.click(shortcutButton)
    fireEvent.keyDown(shortcutButton, { key: 'Control', ctrlKey: true })

    expect(onShortcutChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '키를 입력하세요...' })).toBeInTheDocument()
  })

  it('saving 상태일 때 저장 버튼이 비활성화되고 저장 중 텍스트를 표시한다', () => {
    render(
      <SettingsPanel
        language="ko"
        onLanguageChange={vi.fn()}
        shortcut="CommandOrControl+Shift+R"
        onShortcutChange={vi.fn()}
        onSave={vi.fn()}
        saving
      />,
    )

    const saveButton = screen.getByRole('button', { name: '저장 중...' })
    expect(saveButton).toBeDisabled()
  })
})
