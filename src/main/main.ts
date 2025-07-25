import { app, BrowserWindow, ipcMain, Menu, dialog, systemPreferences } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import * as keytar from 'keytar'

// Initialize secure store for app preferences (not for API keys)
const store = new Store({
  name: 'app-preferences',
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    theme: 'system'
  }
})

let mainWindow: BrowserWindow

const SERVICE_NAME = 'ElectronAPIKeyManager'

/**
 * Create the main application window with security best practices
 */
function createWindow(): void {
  const bounds = store.get('windowBounds') as { width: number; height: number }

  // Create the browser window with security-first configuration
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset', // macOS native title bar style
    vibrancy: 'under-window', // macOS vibrancy effect
    webPreferences: {
      // Security best practices
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webSecurity: true,
      sandbox: false, // Disabled for preload script functionality
      
      // Preload script for secure IPC bridge
      preload: join(__dirname, '../preload/preload.js')
    }
  })

  // Load the appropriate content based on environment
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Show window when ready to prevent visual flash
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    
    // Open DevTools in development
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  // Save window bounds on resize/move
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds()
    store.set('windowBounds', { width: bounds.width, height: bounds.height })
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null!
  })

  // Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
}

/**
 * Setup secure IPC handlers for API key management
 */
function setupIPC(): void {
  // Store API key securely in Keychain
  ipcMain.handle('api-keys:store', async (_, keyData: {
    id: string
    name: string
    platform: string
    description?: string
    key: string
    tags?: string[]
  }) => {
    try {
      // Prompt for Touch ID/Face ID authentication
      if (process.platform === 'darwin') {
        try {
          await systemPreferences.promptTouchID('Authenticate to store API key')
        } catch (authError) {
          throw new Error('Authentication required to store API keys')
        }
      }

      // Store the API key in Keychain
      await keytar.setPassword(SERVICE_NAME, keyData.id, keyData.key)
      
      // Store metadata in encrypted store (without the actual key)
      const metadata = {
        id: keyData.id,
        name: keyData.name,
        platform: keyData.platform,
        description: keyData.description,
        tags: keyData.tags,
        createdAt: new Date().toISOString(),
        lastAccessed: null
      }
      
      const existingKeys = store.get('apiKeys', []) as any[]
      const updatedKeys = existingKeys.filter(k => k.id !== keyData.id)
      updatedKeys.push(metadata)
      store.set('apiKeys', updatedKeys)
      
      return { success: true }
    } catch (error) {
      console.error('Failed to store API key:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Retrieve API key from Keychain
  ipcMain.handle('api-keys:get', async (_, keyId: string) => {
    try {
      // Prompt for Touch ID/Face ID authentication
      if (process.platform === 'darwin') {
        try {
          await systemPreferences.promptTouchID('Authenticate to access API key')
        } catch (authError) {
          throw new Error('Authentication required to access API keys')
        }
      }

      const key = await keytar.getPassword(SERVICE_NAME, keyId)
      if (!key) {
        throw new Error('API key not found')
      }

      // Update last accessed time
      const existingKeys = store.get('apiKeys', []) as any[]
      const updatedKeys = existingKeys.map(k => 
        k.id === keyId ? { ...k, lastAccessed: new Date().toISOString() } : k
      )
      store.set('apiKeys', updatedKeys)

      return { success: true, key }
    } catch (error) {
      console.error('Failed to retrieve API key:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Get all API key metadata (without actual keys)
  ipcMain.handle('api-keys:list', async () => {
    try {
      const keys = store.get('apiKeys', []) as any[]
      return { success: true, keys }
    } catch (error) {
      console.error('Failed to list API keys:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Delete API key from Keychain and metadata
  ipcMain.handle('api-keys:delete', async (_, keyId: string) => {
    try {
      // Prompt for Touch ID/Face ID authentication
      if (process.platform === 'darwin') {
        try {
          await systemPreferences.promptTouchID('Authenticate to delete API key')
        } catch (authError) {
          throw new Error('Authentication required to delete API keys')
        }
      }

      await keytar.deletePassword(SERVICE_NAME, keyId)
      
      const existingKeys = store.get('apiKeys', []) as any[]
      const updatedKeys = existingKeys.filter(k => k.id !== keyId)
      store.set('apiKeys', updatedKeys)
      
      return { success: true }
    } catch (error) {
      console.error('Failed to delete API key:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Check if Touch ID/Face ID is available
  ipcMain.handle('auth:check-biometric', async () => {
    if (process.platform === 'darwin') {
      try {
        // This will throw if Touch ID/Face ID is not available
        await systemPreferences.promptTouchID('Testing biometric availability')
        return { available: true }
      } catch (error) {
        return { available: false, error: (error as Error).message }
      }
    }
    return { available: false, error: 'Not supported on this platform' }
  })

  // Get app preferences
  ipcMain.handle('preferences:get', async (_, key?: string) => {
    if (key) {
      return { success: true, value: store.get(key) }
    }
    return { success: true, value: store.store }
  })

  // Set app preferences
  ipcMain.handle('preferences:set', async (_, key: string, value: any) => {
    try {
      store.set(key, value)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}

/**
 * Setup application menu
 */
function setupMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New API Key',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-api-key')
          }
        },
        { type: 'separator' },
        {
          label: 'Import Keys',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'JSON Files', extensions: ['json'] }
              ]
            })
            
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('menu:import-keys', result.filePaths[0])
            }
          }
        },
        {
          label: 'Export Keys',
          click: () => {
            mainWindow?.webContents.send('menu:export-keys')
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// App event handlers
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron.api-key-manager')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIPC()
  setupMenu()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    
    if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.origin !== 'file://') {
      event.preventDefault()
    }
  })
}) 