import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check, Copy, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface TranscriptionResultProps {
  text: string
  onCopy?: () => void
}

export function TranscriptionResult({ text, onCopy }: TranscriptionResultProps) {
  const [copied, setCopied] = useState(false)

  if (!text) return null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    onCopy?.()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="w-full max-w-2xl p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-4 text-primary" />
          변환 결과
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" /> 복사됨
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" /> 복사
            </>
          )}
        </Button>
      </div>
      <p className="text-base leading-relaxed whitespace-pre-wrap">{text}</p>
    </Card>
  )
}
