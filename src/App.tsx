import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  AudioLines,
  History,
  Mic,
  RotateCw,
  Settings as SettingsIcon,
} from 'lucide-react'
import { LanguageSelector } from '@/components/LanguageSelector'
import { RecordingControls } from '@/components/RecordingControls'
import { SettingsPanel } from '@/components/SettingsPanel'
import { TranscriptionResult } from '@/components/TranscriptionResult'
import { TranscriptionHistory } from '@/components/TranscriptionHistory'
import { StatsOverview } from '@/components/StatsOverview'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type AudioChunk, useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useAuth } from '@/hooks/useAuth'
import { useClipboard } from '@/hooks/useClipboard'
import { getSettings, updateSettings } from '@/services/settings'
import { saveTranscription, transcribeAudioWithRetry } from '@/services/transcription'

const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+R'

function App() {
  const { loading: authLoading } = useAuth()
  const { copyToClipboard } = useClipboard()
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcriptionText, setTranscriptionText] = useState('')
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
  const [failedAudioBlob, setFailedAudioBlob] = useState<Blob | null>(null)
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState('record')
  const [selectedLanguage, setSelectedLanguage] = useState('ko')
  const [shortcut, setShortcut] = useState(DEFAULT_SHORTCUT)
  const [savingSettings, setSavingSettings] = useState(false)

  const chunkTextsRef = useRef<string[]>([])
  const chunkDurationsRef = useRef<number[]>([])
  const chunkFailedRef = useRef(false)
  const chunkChainRef = useRef<Promise<void>>(Promise.resolve())
  const singleChunkBlobRef = useRef<Blob | null>(null)

  const updateJoinedText = useCallback(() => {
    setTranscriptionText(chunkTextsRef.current.filter(Boolean).join(' ').trim())
  }, [])

  const handleChunk = useCallback(
    ({ blob, index }: AudioChunk) => {
      singleChunkBlobRef.current = index === 1 ? blob : null
      setChunkProgress((prev) => ({ done: prev?.done ?? 0, total: index }))

      chunkChainRef.current = chunkChainRef.current.then(async () => {
        try {
          const result = await transcribeAudioWithRetry(blob, selectedLanguage)
          chunkTextsRef.current[index - 1] = result.text
          chunkDurationsRef.current[index - 1] = result.duration ?? 0
          updateJoinedText()
        } catch (error) {
          console.error(`청크 ${index} 변환 실패:`, error)
          chunkFailedRef.current = true
          chunkTextsRef.current[index - 1] = ''
        } finally {
          setChunkProgress((prev) => ({ done: (prev?.done ?? 0) + 1, total: prev?.total ?? index }))
        }
      })
    },
    [selectedLanguage, updateJoinedText],
  )

  const { isRecording, error: recorderError, startRecording, stopRecording } =
    useAudioRecorder(handleChunk)

  useEffect(() => {
    if (recorderError) {
      toast.error(recorderError.message)
    }
  }, [recorderError])

  useEffect(() => {
    if (authLoading) return

    void (async () => {
      try {
        const settings = await getSettings()
        if (!settings) return

        setSelectedLanguage(settings.default_language)
        const savedShortcut = settings.shortcut_key ?? DEFAULT_SHORTCUT
        setShortcut(savedShortcut)
        await window.electron?.updateShortcut(savedShortcut)
      } catch (error) {
        console.error('설정 불러오기 실패:', error)
      }
    })()
  }, [authLoading])

  const handleSaveSettings = useCallback(async () => {
    setSavingSettings(true)
    try {
      const result = await window.electron?.updateShortcut(shortcut)
      if (result && !result.success) {
        toast.error(result.error ?? '단축키 등록에 실패했습니다')
        return
      }

      await updateSettings({ default_language: selectedLanguage, shortcut_key: shortcut })
      toast.success('설정이 저장되었습니다')
    } catch (error) {
      console.error('설정 저장 실패:', error)
      toast.error('설정 저장에 실패했습니다')
    } finally {
      setSavingSettings(false)
    }
  }, [selectedLanguage, shortcut])

  const finalizeTranscription = useCallback(async () => {
    setIsProcessing(true)
    try {
      await chunkChainRef.current
      const finalText = chunkTextsRef.current.filter(Boolean).join(' ').trim()
      const totalDuration = chunkDurationsRef.current.reduce((sum, duration) => sum + duration, 0)

      if (!finalText) {
        setTranscriptionError('변환에 실패했습니다')
        setFailedAudioBlob(singleChunkBlobRef.current)
        toast.error('변환에 실패했습니다. 다시 시도해주세요.')
        return
      }

      setTranscriptionText(finalText)
      setTranscriptionError(null)
      setFailedAudioBlob(null)

      if (chunkFailedRef.current) {
        toast.warning('일부 구간 변환에 실패했습니다')
      }

      const copied = await copyToClipboard(finalText)
      if (copied) {
        toast.success('클립보드에 복사되었습니다')
      }

      await saveTranscription(finalText, selectedLanguage, totalDuration || undefined)
      setStatsRefreshKey((key) => key + 1)
    } catch (error) {
      console.error('변환 실패:', error)
      toast.error('변환에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsProcessing(false)
      setChunkProgress(null)
      chunkTextsRef.current = []
      chunkDurationsRef.current = []
      chunkFailedRef.current = false
    }
  }, [copyToClipboard, selectedLanguage])

  const handleStopRecording = useCallback(() => {
    void (async () => {
      await stopRecording()
      await finalizeTranscription()
    })()
  }, [stopRecording, finalizeTranscription])

  const handleRetry = useCallback(() => {
    if (!failedAudioBlob) return

    void (async () => {
      setIsProcessing(true)
      setTranscriptionError(null)
      try {
        const result = await transcribeAudioWithRetry(failedAudioBlob, selectedLanguage)
        setTranscriptionText(result.text)
        setFailedAudioBlob(null)

        const copied = await copyToClipboard(result.text)
        if (copied) {
          toast.success('클립보드에 복사되었습니다')
        }

        await saveTranscription(result.text, result.language, result.duration)
        setStatsRefreshKey((key) => key + 1)
      } catch (error) {
        console.error('변환 실패:', error)
        setTranscriptionError('변환에 실패했습니다')
        toast.error('변환에 실패했습니다. 다시 시도해주세요.')
      } finally {
        setIsProcessing(false)
      }
    })()
  }, [failedAudioBlob, copyToClipboard, selectedLanguage])

  useEffect(() => {
    if (!window.electron?.onToggleRecording) return

    return window.electron.onToggleRecording(() => {
      if (isProcessing) return
      if (isRecording) {
        handleStopRecording()
      } else {
        void startRecording()
      }
    })
  }, [isRecording, isProcessing, startRecording, handleStopRecording])

  useEffect(() => {
    if (!window.electron?.onShowHistory) return

    return window.electron.onShowHistory(() => {
      setActiveTab('history')
    })
  }, [])

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl items-center">
        <TabsList>
          <TabsTrigger value="record">
            <Mic className="size-4" />
            녹음
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" />
            히스토리
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon className="size-4" />
            설정
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="w-full flex flex-col items-center gap-8">
          <div className="w-full max-w-2xl flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">변환 언어</span>
            <LanguageSelector
              value={selectedLanguage}
              onChange={setSelectedLanguage}
              disabled={isRecording || isProcessing}
            />
          </div>

          <RecordingControls
            isRecording={isRecording}
            isProcessing={isProcessing}
            onStartRecording={startRecording}
            onStopRecording={handleStopRecording}
          />

          {chunkProgress && chunkProgress.total > 1 && (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              청크 {chunkProgress.done}/{chunkProgress.total} 변환 중...
            </p>
          )}

          {transcriptionError && (
            <Card className="w-full max-w-2xl p-4 flex items-center justify-between gap-4 border-destructive/50">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span className="text-sm">{transcriptionError}</span>
              </div>
              {failedAudioBlob && (
                <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                  <RotateCw className="size-4 mr-2" />
                  다시 시도
                </Button>
              )}
            </Card>
          )}

          <TranscriptionResult text={transcriptionText} />
        </TabsContent>

        <TabsContent value="history" className="w-full flex justify-center">
          <TranscriptionHistory onDataChange={() => setStatsRefreshKey((key) => key + 1)} />
        </TabsContent>

        <TabsContent value="settings" className="w-full flex justify-center">
          <SettingsPanel
            language={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            shortcut={shortcut}
            onShortcutChange={setShortcut}
            onSave={() => void handleSaveSettings()}
            saving={savingSettings}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default App
