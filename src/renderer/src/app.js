// API Key Manager - Renderer Process
// This file handles the UI logic and communicates with the main process via IPC

class APIKeyManager {
  constructor() {
    this.currentKeys = []
    this.selectedKey = null
    this.initializeApp()
  }

  async initializeApp() {
    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.error('electronAPI not available')
      this.showNotification('Application initialization failed', 'error')
      return
    }

    // Initialize UI event listeners
    this.setupEventListeners()
    
    // Load existing API keys
    await this.loadAPIKeys()
    
    // Check biometric availability
    await this.checkBiometricAuth()
    
    console.log('API Key Manager initialized')
  }

  setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput')
    searchInput.addEventListener('input', (e) => {
      this.filterKeys(e.target.value)
    })

    // New key button
    const newKeyBtn = document.getElementById('newKeyBtn')
    const addFirstKeyBtn = document.getElementById('addFirstKeyBtn')
    
    newKeyBtn.addEventListener('click', () => this.showNewKeyForm())
    addFirstKeyBtn.addEventListener('click', () => this.showNewKeyForm())

    // Export button
    const exportBtn = document.getElementById('exportBtn')
    exportBtn.addEventListener('click', () => this.exportKeys())

    // Menu event listeners
    if (window.electronAPI.menu) {
      window.electronAPI.menu.onNewAPIKey(() => this.showNewKeyForm())
      window.electronAPI.menu.onExportKeys(() => this.exportKeys())
      window.electronAPI.menu.onImportKeys((filePath) => this.importKeys(filePath))
    }
  }

  async loadAPIKeys() {
    try {
      this.showLoading()
      const response = await window.electronAPI.apiKeys.list()
      
      if (response.success) {
        this.currentKeys = response.keys || []
        this.renderKeysList()
        this.updateMainContent()
      } else {
        this.showNotification(`Failed to load API keys: ${response.error}`, 'error')
      }
    } catch (error) {
      console.error('Error loading API keys:', error)
      this.showNotification('Failed to load API keys', 'error')
    } finally {
      this.hideLoading()
    }
  }

  renderKeysList() {
    const container = document.getElementById('apiKeysList')
    
    if (this.currentKeys.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: #86868b;">No API keys found</div>'
      return
    }

    container.innerHTML = this.currentKeys.map(key => `
      <div class="api-key-item" data-key-id="${key.id}" onclick="app.selectKey('${key.id}')">
        <div class="api-key-name">${this.escapeHtml(key.name)}</div>
        <div class="api-key-platform">${this.escapeHtml(key.platform)}</div>
        ${key.tags && key.tags.length > 0 ? `
          <div class="api-key-tags">
            ${key.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('')
  }

  selectKey(keyId) {
    // Remove previous selection
    document.querySelectorAll('.api-key-item').forEach(item => {
      item.classList.remove('selected')
    })

    // Add selection to current item
    const keyItem = document.querySelector(`[data-key-id="${keyId}"]`)
    if (keyItem) {
      keyItem.classList.add('selected')
    }

    this.selectedKey = this.currentKeys.find(key => key.id === keyId)
    this.showKeyDetails()
  }

  async showKeyDetails() {
    if (!this.selectedKey) return

    const contentArea = document.getElementById('contentArea')
    const toolbarTitle = document.getElementById('toolbarTitle')
    
    toolbarTitle.textContent = this.selectedKey.name

    // Show loading while fetching the actual key
    contentArea.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
      </div>
    `

    try {
      const response = await window.electronAPI.apiKeys.get(this.selectedKey.id)
      
      if (response.success) {
        const key = response.key
        contentArea.innerHTML = `
          <div class="key-details">
            <div class="key-details-header">
              <div class="key-info">
                <h2>${this.escapeHtml(this.selectedKey.name)}</h2>
                <div class="platform">${this.escapeHtml(this.selectedKey.platform)}</div>
                ${this.selectedKey.description ? `<div class="description">${this.escapeHtml(this.selectedKey.description)}</div>` : ''}
              </div>
              <div class="key-actions">
                <button class="btn btn-secondary" onclick="app.editKey('${this.selectedKey.id}')">Edit</button>
                <button class="btn btn-secondary" onclick="app.deleteKey('${this.selectedKey.id}')">Delete</button>
              </div>
            </div>
            
            <div class="key-field">
              <label>API Key</label>
              <div class="key-field-value">
                ${this.maskKey(key)}
                <button class="copy-button" onclick="app.copyKey('${key}', this)">Copy</button>
              </div>
            </div>
            
            <div class="key-field">
              <label>Created</label>
              <div class="key-field-value">${window.electronAPI.utils.formatDate(this.selectedKey.createdAt)}</div>
            </div>
            
            ${this.selectedKey.lastAccessed ? `
              <div class="key-field">
                <label>Last Accessed</label>
                <div class="key-field-value">${window.electronAPI.utils.formatDate(this.selectedKey.lastAccessed)}</div>
              </div>
            ` : ''}
            
            ${this.selectedKey.tags && this.selectedKey.tags.length > 0 ? `
              <div class="key-field">
                <label>Tags</label>
                <div class="api-key-tags">
                  ${this.selectedKey.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `
      } else {
        contentArea.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3 class="empty-state-title">Access Denied</h3>
            <p class="empty-state-subtitle">${response.error}</p>
          </div>
        `
      }
    } catch (error) {
      console.error('Error fetching key details:', error)
      contentArea.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <h3 class="empty-state-title">Error</h3>
          <p class="empty-state-subtitle">Failed to load key details</p>
        </div>
      `
    }
  }

  copyKey(key, button) {
    // Copy key with auto-clear after 30 seconds
    window.electronAPI.clipboard.writeText(key, 30000)
    
    // Update button text temporarily
    const originalText = button.textContent
    button.textContent = 'Copied!'
    button.style.background = 'rgba(52, 199, 89, 0.2)'
    button.style.color = '#34c759'
    
    setTimeout(() => {
      button.textContent = originalText
      button.style.background = ''
      button.style.color = ''
    }, 2000)
    
    this.showNotification('API key copied to clipboard (auto-clear in 30s)')
  }

  maskKey(key) {
    if (key.length <= 8) return '••••••••'
    const start = key.substring(0, 4)
    const end = key.substring(key.length - 4)
    const middle = '•'.repeat(Math.min(20, key.length - 8))
    return `${start}${middle}${end}`
  }

  showNewKeyForm() {
    const contentArea = document.getElementById('contentArea')
    const toolbarTitle = document.getElementById('toolbarTitle')
    
    toolbarTitle.textContent = 'New API Key'
    
    contentArea.innerHTML = `
      <div class="key-details">
        <h2>Add New API Key</h2>
        <form id="newKeyForm">
          <div class="key-field">
            <label for="keyName">Name *</label>
            <input type="text" id="keyName" class="search-input" placeholder="e.g., GitHub Personal Token" required>
          </div>
          
          <div class="key-field">
            <label for="keyPlatform">Platform *</label>
            <select id="keyPlatform" class="search-input" required>
              <option value="">Select platform</option>
              <option value="github">GitHub</option>
              <option value="openai">OpenAI</option>
              <option value="aws">AWS</option>
              <option value="google">Google Cloud</option>
              <option value="stripe">Stripe</option>
              <option value="discord">Discord</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="key-field">
            <label for="keyValue">API Key *</label>
            <input type="password" id="keyValue" class="search-input" placeholder="Paste your API key here" required>
            <small style="color: #86868b; font-size: 12px;">Your key will be securely stored in the macOS Keychain</small>
          </div>
          
          <div class="key-field">
            <label for="keyDescription">Description (optional)</label>
            <textarea id="keyDescription" class="search-input" placeholder="What is this key used for?" rows="3"></textarea>
          </div>
          
          <div class="key-field">
            <label for="keyTags">Tags (optional)</label>
            <input type="text" id="keyTags" class="search-input" placeholder="production, personal, work (comma-separated)">
          </div>
          
          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" onclick="app.cancelForm()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save API Key</button>
          </div>
        </form>
      </div>
    `
    
    // Setup form submission
    document.getElementById('newKeyForm').addEventListener('submit', (e) => {
      e.preventDefault()
      this.saveNewKey()
    })
  }

  async saveNewKey() {
    const form = document.getElementById('newKeyForm')
    const formData = new FormData(form)
    
    const keyData = {
      id: window.electronAPI.utils.generateId(),
      name: document.getElementById('keyName').value.trim(),
      platform: document.getElementById('keyPlatform').value,
      key: document.getElementById('keyValue').value.trim(),
      description: document.getElementById('keyDescription').value.trim() || undefined,
      tags: document.getElementById('keyTags').value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    }
    
    // Validation
    if (!keyData.name || !keyData.platform || !keyData.key) {
      this.showNotification('Please fill in all required fields', 'error')
      return
    }
    
    if (!window.electronAPI.utils.isValidAPIKey(keyData.key, keyData.platform)) {
      this.showNotification('Please enter a valid API key', 'error')
      return
    }
    
    try {
      const response = await window.electronAPI.apiKeys.store(keyData)
      
      if (response.success) {
        this.showNotification('API key saved successfully')
        await this.loadAPIKeys()
        this.updateMainContent()
      } else {
        this.showNotification(`Failed to save API key: ${response.error}`, 'error')
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      this.showNotification('Failed to save API key', 'error')
    }
  }

  cancelForm() {
    this.selectedKey = null
    this.updateMainContent()
  }

  async deleteKey(keyId) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return
    }
    
    try {
      const response = await window.electronAPI.apiKeys.delete(keyId)
      
      if (response.success) {
        this.showNotification('API key deleted successfully')
        await this.loadAPIKeys()
        this.selectedKey = null
        this.updateMainContent()
      } else {
        this.showNotification(`Failed to delete API key: ${response.error}`, 'error')
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      this.showNotification('Failed to delete API key', 'error')
    }
  }

  editKey(keyId) {
    // TODO: Implement edit functionality
    this.showNotification('Edit functionality coming soon')
  }

  exportKeys() {
    // TODO: Implement export functionality
    this.showNotification('Export functionality coming soon')
  }

  importKeys(filePath) {
    // TODO: Implement import functionality
    this.showNotification(`Import from ${filePath} - coming soon`)
  }

  filterKeys(searchTerm) {
    const filteredKeys = this.currentKeys.filter(key => 
      key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (key.description && key.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (key.tags && key.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    )
    
    // Temporarily store current keys and render filtered
    const originalKeys = this.currentKeys
    this.currentKeys = filteredKeys
    this.renderKeysList()
    this.currentKeys = originalKeys
  }

  updateMainContent() {
    const contentArea = document.getElementById('contentArea')
    const toolbarTitle = document.getElementById('toolbarTitle')
    
    if (this.currentKeys.length === 0) {
      toolbarTitle.textContent = 'API Key Manager'
      contentArea.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔐</div>
          <h3 class="empty-state-title">No API Keys</h3>
          <p class="empty-state-subtitle">Add your first API key to get started</p>
          <button class="btn btn-primary" onclick="app.showNewKeyForm()">Add API Key</button>
        </div>
      `
    } else if (!this.selectedKey) {
      toolbarTitle.textContent = 'API Key Manager'
      contentArea.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👈</div>
          <h3 class="empty-state-title">Select an API Key</h3>
          <p class="empty-state-subtitle">Choose a key from the sidebar to view details</p>
        </div>
      `
    }
  }

  async checkBiometricAuth() {
    try {
      const response = await window.electronAPI.auth.checkBiometric()
      console.log('Biometric auth available:', response.available)
    } catch (error) {
      console.error('Error checking biometric auth:', error)
    }
  }

  showLoading() {
    const contentArea = document.getElementById('contentArea')
    contentArea.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
      </div>
    `
  }

  hideLoading() {
    // Loading state will be replaced by the actual content
  }

  showNotification(message, type = 'success') {
    const notification = document.getElementById('notification')
    notification.textContent = message
    notification.className = `notification ${type}`
    notification.classList.add('show')
    
    setTimeout(() => {
      notification.classList.remove('show')
    }, 3000)
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize the application
const app = new APIKeyManager() 