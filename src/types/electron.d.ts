export {}

declare global {
  interface Window {
    electron?: {
      clipboard: {
        write: (text: string) => Promise<{ success: boolean; error?: string }>
      }
      updateShortcut: (accelerator: string) => Promise<{ success: boolean; error?: string }>
      onToggleRecording: (callback: () => void) => () => void
      onShowHistory: (callback: () => void) => () => void
    }
  }
}
