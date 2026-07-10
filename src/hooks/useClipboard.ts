import { useCallback } from 'react'
import * as Sentry from '@sentry/react'

export const useClipboard = () => {
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
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
