import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  // 향후 IPC 핸들러 추가 예정
})
