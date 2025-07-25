import { contextBridge, ipcRenderer, clipboard } from 'electron'

// Types for API key data
export interface APIKey {
  id: string
  name: string
  platform: string
  description?: string
  tags?: string[]
  createdAt: string
  lastAccessed: string | null
}

export interface APIKeyInput {
  id: string
  name: string
  platform: string
  description?: string
  key: string
  tags?: string[]
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

// Custom APIs for renderer
const electronAPI = {
  // API Key Management
  apiKeys: {
    store: (keyData: APIKeyInput): Promise<APIResponse> => 
      ipcRenderer.invoke('api-keys:store', keyData),
    
    get: (keyId: string): Promise<APIResponse<string>> => 
      ipcRenderer.invoke('api-keys:get', keyId),
    
    list: (): Promise<APIResponse<APIKey[]>> => 
      ipcRenderer.invoke('api-keys:list'),
    
    delete: (keyId: string): Promise<APIResponse> => 
      ipcRenderer.invoke('api-keys:delete', keyId)
  },

  // Authentication
  auth: {
    checkBiometric: (): Promise<APIResponse<{ available: boolean }>> => 
      ipcRenderer.invoke('auth:check-biometric')
  },

  // App Preferences
  preferences: {
    get: (key?: string): Promise<APIResponse> => 
      ipcRenderer.invoke('preferences:get', key),
    
    set: (key: string, value: any): Promise<APIResponse> => 
      ipcRenderer.invoke('preferences:set', key, value)
  },

  // Clipboard operations with auto-clear
  clipboard: {
    writeText: (text: string, autoClearMs?: number) => {
      clipboard.writeText(text)
      
      if (autoClearMs && autoClearMs > 0) {
        setTimeout(() => {
          // Only clear if the clipboard still contains our text
          if (clipboard.readText() === text) {
            clipboard.clear()
          }
        }, autoClearMs)
      }
    },
    
    readText: () => clipboard.readText(),
    clear: () => clipboard.clear()
  },

  // Menu event listeners
  menu: {
    onNewAPIKey: (callback: () => void) => {
      const removeListener = () => ipcRenderer.removeListener('menu:new-api-key', callback)
      ipcRenderer.on('menu:new-api-key', callback)
      return removeListener
    },
    
    onImportKeys: (callback: (filePath: string) => void) => {
      const wrappedCallback = (_: any, filePath: string) => callback(filePath)
      const removeListener = () => ipcRenderer.removeListener('menu:import-keys', wrappedCallback)
      ipcRenderer.on('menu:import-keys', wrappedCallback)
      return removeListener
    },
    
    onExportKeys: (callback: () => void) => {
      const removeListener = () => ipcRenderer.removeListener('menu:export-keys', callback)
      ipcRenderer.on('menu:export-keys', callback)
      return removeListener
    }
  },

  // Utility functions
  utils: {
    generateId: () => {
      return 'key_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    },
    
    isValidAPIKey: (key: string, platform?: string) => {
      if (!key || key.trim().length === 0) return false
      
      // Basic validation - can be extended for platform-specific formats
      const minLength = platform === 'github' ? 40 : 10
      return key.trim().length >= minLength
    },
    
    formatDate: (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}

// Expose the API to the renderer process
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  } catch (error) {
    console.error('Failed to expose electronAPI:', error)
  }
} else {
  // Fallback for non-isolated contexts (development only)
  ;(window as any).electronAPI = electronAPI
}

// Type declarations for the global window object
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
} 