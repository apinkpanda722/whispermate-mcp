import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  clipboard: {
    write: (text: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('clipboard:write', text),
  },
})
