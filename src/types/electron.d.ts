export {}

declare global {
  interface Window {
    electron?: {
      clipboard: {
        write: (text: string) => Promise<{ success: boolean; error?: string }>
      }
    }
  }
}
