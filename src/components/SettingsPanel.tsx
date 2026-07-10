import { useState } from 'react'
import { Keyboard } from 'lucide-react'
import { LanguageSelector } from '@/components/LanguageSelector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt'])

function acceleratorFromKeyEvent(event: React.KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null

  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')

  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  parts.push(key)

  return parts.join('+')
}

interface SettingsPanelProps {
  language: string
  onLanguageChange: (value: string) => void
  shortcut: string
  onShortcutChange: (value: string) => void
  onSave: () => void
  saving?: boolean
}

export function SettingsPanel({
  language,
  onLanguageChange,
  shortcut,
  onShortcutChange,
  onSave,
  saving,
}: SettingsPanelProps) {
  const [recording, setRecording] = useState(false)

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.preventDefault()
    const accelerator = acceleratorFromKeyEvent(event)
    if (accelerator) {
      onShortcutChange(accelerator)
      setRecording(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>설정</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">기본 변환 언어</p>
            <p className="text-sm text-muted-foreground">녹음 시작 시 기본으로 선택될 언어</p>
          </div>
          <LanguageSelector value={language} onChange={onLanguageChange} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">녹음 전역 단축키</p>
            <p className="text-sm text-muted-foreground">
              버튼을 누른 뒤 원하는 키 조합을 입력하세요
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRecording(true)}
            onKeyDown={recording ? handleKeyDown : undefined}
            onBlur={() => setRecording(false)}
            className="min-w-40"
          >
            <Keyboard className="size-4 mr-2" />
            {recording ? '키를 입력하세요...' : shortcut}
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
