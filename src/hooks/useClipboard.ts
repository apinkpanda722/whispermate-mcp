import { useCallback } from 'react'
import * as Sentry from '@sentry/react'

export const useClipboard = () => {
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (window.electron?.clipboard) {
        const result = await window.electron.clipboard.write(text)
        if (!result.success) {
          throw new Error(result.error ?? 'Electron clipboard write failed')
        }
        return true
      }

      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'clipboard' },
        contexts: { clipboard: { textLength: text.length } },
      })
      console.error('클립보드 복사 실패:', error)
      return false
    }
  }, [])

  return { copyToClipboard }
}
