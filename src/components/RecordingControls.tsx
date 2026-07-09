import { Button } from '@/components/ui/button'
import { Loader2, Mic, Square } from 'lucide-react'

interface RecordingControlsProps {
  isRecording: boolean
  isProcessing: boolean
  onStartRecording: () => void
  onStopRecording: () => void
}

export function RecordingControls({
  isRecording,
  isProcessing,
  onStartRecording,
  onStopRecording,
}: RecordingControlsProps) {
  const statusText = isProcessing
    ? '텍스트로 변환 중...'
    : isRecording
      ? '녹음 중...'
      : '녹음을 시작하려면 버튼을 누르세요'

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        type="button"
        size="icon-lg"
        variant={isRecording ? 'destructive' : 'default'}
        className="size-16 rounded-full [&_svg:not([class*='size-'])]:size-6"
        disabled={isProcessing}
        aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
        onClick={isRecording ? onStopRecording : onStartRecording}
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" />
        ) : isRecording ? (
          <Square />
        ) : (
          <Mic />
        )}
      </Button>

      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {statusText}
      </p>
    </div>
  )
}
