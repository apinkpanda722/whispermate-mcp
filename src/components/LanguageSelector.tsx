import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LanguageSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const SUPPORTED_LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
]

const LANGUAGE_LABELS = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((lang) => [lang.code, lang.label]),
)

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onChange(newValue)
      }}
      disabled={disabled}
    >
      <SelectTrigger aria-label="변환 언어 선택" className="w-32">
        <SelectValue>{(code: string) => LANGUAGE_LABELS[code] ?? code}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
