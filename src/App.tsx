import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AudioLines, History, Mic } from 'lucide-react'
import { RecordingControls } from '@/components/RecordingControls'
import { TranscriptionResult } from '@/components/TranscriptionResult'
import { TranscriptionHistory } from '@/components/TranscriptionHistory'
import { StatsOverview } from '@/components/StatsOverview'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)

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
        setStatsRefreshKey((key) => key + 1)
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

  useEffect(() => {
    if (!window.electron?.onToggleRecording) return

    return window.electron.onToggleRecording(() => {
      if (isProcessing) return
      if (isRecording) {
        stopRecording()
      } else {
        void startRecording()
      }
    })
  }, [isRecording, isProcessing, startRecording, stopRecording])

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">로딩 중...</div>
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-8 gap-8">
      <div className="w-full max-w-4xl flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-lg shadow-primary/30">
            <AudioLines className="size-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Whisper Mate</h1>
            <p className="text-muted-foreground text-sm">
              음성을 텍스트로 변환하여 클립보드에 복사합니다
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-4xl">
        <StatsOverview refreshKey={statsRefreshKey} />
      </div>

      <Tabs defaultValue="record" className="w-full max-w-4xl items-center">
        <TabsList>
          <TabsTrigger value="record">
            <Mic className="size-4" />
            녹음
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" />
            히스토리
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="w-full flex flex-col items-center gap-8">
          <RecordingControls
            isRecording={isRecording}
            isProcessing={isProcessing}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />

          <TranscriptionResult text={transcriptionText} />
        </TabsContent>

        <TabsContent value="history" className="w-full flex justify-center">
          <TranscriptionHistory onDataChange={() => setStatsRefreshKey((key) => key + 1)} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default App
