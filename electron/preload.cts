import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  clipboard: {
    write: (text: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('clipboard:write', text),
  },
  onToggleRecording: (callback: () => void): (() => void) => {
    const listener = () => callback()
    ipcRenderer.on('toggle-recording', listener)
    return () => ipcRenderer.removeListener('toggle-recording', listener)
  },
})
