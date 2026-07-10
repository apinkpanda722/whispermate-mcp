import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RecordingControls } from '@/components/RecordingControls'
import { TranscriptionResult } from '@/components/TranscriptionResult'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useAuth } from '@/hooks/useAuth'
import { useClipboard } from '@/hooks/useClipboard'
import { saveTranscription, transcribeAudio } from '@/services/transcription'

function App() {
  const { loading: authLoading } = useAuth()
  const { isRecording, audioBlob, error: recorderError, startRecording, stopRecording } =
    useAudioRecorder()
  const { copyToClipboard } = useClipboard()
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcriptionText, setTranscriptionText] = useState('')

  useEffect(() => {
    if (recorderError) {
      toast.error(recorderError.message)
    }
  }, [recorderError])

  const handleTranscription = useCallback(
    async (blob: Blob) => {
      setIsProcessing(true)
      try {
        const result = await transcribeAudio(blob)
        setTranscriptionText(result.text)

        const copied = await copyToClipboard(result.text)
        if (copied) {
          toast.success('클립보드에 복사되었습니다')
        }

        await saveTranscription(result.text, result.language, result.duration)
      } catch (error) {
        console.error('변환 실패:', error)
        toast.error('변환에 실패했습니다. 다시 시도해주세요.')
      } finally {
        setIsProcessing(false)
      }
    },
    [copyToClipboard],
  )

  useEffect(() => {
    if (audioBlob && !isRecording) {
      void handleTranscription(audioBlob)
    }
  }, [audioBlob, isRecording, handleTranscription])

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">로딩 중...</div>
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Whisper Mate</h1>
        <p className="text-muted-foreground mt-2">
          음성을 텍스트로 변환하여 클립보드에 복사합니다
        </p>
      </div>

      <RecordingControls
        isRecording={isRecording}
        isProcessing={isProcessing}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />

      <TranscriptionResult text={transcriptionText} />
    </div>
  )
}

export default App
