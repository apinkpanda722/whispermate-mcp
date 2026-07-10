import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    win.hide()
  })

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  return win
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  tray.setToolTip('Whisper Mate')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '녹음 시작',
      click: () => {
        mainWindow?.show()
        mainWindow?.webContents.send('toggle-recording')
      },
    },
    {
      label: '히스토리 열기',
      click: () => {
        mainWindow?.show()
        mainWindow?.webContents.send('show-history')
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)

  if (process.platform !== 'darwin') {
    tray.on('click', () => {
      mainWindow?.show()
      mainWindow?.focus()
    })
  }
}

ipcMain.handle('clipboard:write', (_event, text: string) => {
  try {
    clipboard.writeText(text)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

app.whenReady().then(() => {
  mainWindow = createWindow()
  createTray()

  const registered = globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow?.webContents.send('toggle-recording')
  })

  if (!registered) {
    console.error('전역 단축키 CommandOrControl+Shift+R 등록에 실패했습니다')
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // App stays resident in the tray; quitting happens via the tray menu or Cmd+Q.
})

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show()
  } else {
    mainWindow = createWindow()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
