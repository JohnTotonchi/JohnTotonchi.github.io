/**
 * iScribeWeb - Main Application
 * Initializes and coordinates all components of the application
 */

class App {
  constructor() {
    // Application state
    this.isInitialized = false;
    this.isOnline = navigator.onLine;
    this.deferredInstallPrompt = null;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.handleOnlineStatusChange = this.handleOnlineStatusChange.bind(this);
    this.checkForUpdates = this.checkForUpdates.bind(this);
    this.registerServiceWorker = this.registerServiceWorker.bind(this);
    this.setupEventListeners = this.setupEventListeners.bind(this);
    this.handleAppInstall = this.handleAppInstall.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    
    // Initialize app when DOM is loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.init);
    } else {
      this.init();
    }
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.isInitialized) return;
    
    console.log('Initializing iScribeWeb application...');
    
    // Register service worker
    await this.registerServiceWorker();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check if API is connected
    if (apiClient.hasAPIDetails()) {
      console.log('API connection details found');
      
      // Test connection
      try {
        const isConnected = await apiClient.testConnection();
        if (isConnected) {
          console.log('API connection successful');
        } else {
          console.warn('API connection failed');
        }
      } catch (error) {
        console.error('API connection test error:', error);
      }
    } else {
      console.log('No API connection details found');
    }
    
    // Check for microphone access
    if (audioRecorder) {
      const isSupported = await audioRecorder.isSupported();
      if (isSupported) {
        console.log('Audio recording is supported');
      } else {
        console.warn('Audio recording is not supported in this browser');
      }
    }
    
    // Check for camera access
    if (QRScanner) {
      const hasCamera = await QRScanner.hasCamera();
      if (hasCamera) {
        console.log('Camera is available');
      } else {
        console.warn('No camera available');
      }
    }
    
    // Initialize UI
    if (uiManager) {
      // Start on welcome screen or dashboard based on API connection
      if (apiClient.hasAPIDetails()) {
        uiManager.navigateTo('dashboard');
      } else {
        uiManager.navigateTo('welcome');
      }
    }
    
    // Check for updates
    this.checkForUpdates();
    
    // Mark as initialized
    this.isInitialized = true;
    console.log('Application initialized');
    
    // Process URL parameters
    this.processUrlParameters();
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered with scope:', registration.scope);
        
        // Check for updates when service worker is activated
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('Service Worker activated, new version available');
              this.showUpdateNotification();
            }
          });
        });
        
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    } else {
      console.warn('Service Workers are not supported in this browser');
    }
    
    return null;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Online/offline status
    window.addEventListener('online', this.handleOnlineStatusChange);
    window.addEventListener('offline', this.handleOnlineStatusChange);
    
    // App installation
    window.addEventListener('beforeinstallprompt', event => {
      // Prevent Chrome 67+ from automatically showing the prompt
      event.preventDefault();
      
      // Stash the event so it can be triggered later
      this.deferredInstallPrompt = event;
      
      // Show install button or banner
      this.showInstallPrompt();
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.deferredInstallPrompt = null;
      
      // Hide install button or banner
      this.hideInstallPrompt();
    });
    
    // Visibility change (app goes to background/foreground)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Custom events
    document.addEventListener('recording-uploaded', event => {
      // Start polling for status
      const transcriptId = event.detail.transcript_id;
      this.pollTranscriptStatus(transcriptId);
    });
    
    document.addEventListener('file-uploaded', event => {
      // Start polling for status
      const transcriptId = event.detail.transcript_id;
      this.pollTranscriptStatus(transcriptId);
    });
  }

  /**
   * Handle online/offline status change
   * @param {Event} event - Online/offline event
   */
  handleOnlineStatusChange(event) {
    this.isOnline = navigator.onLine;
    console.log(`App is ${this.isOnline ? 'online' : 'offline'}`);
    
    if (this.isOnline) {
      // Sync pending uploads when back online
      this.syncPendingUploads();
      
      // Show online notification
      if (uiManager) {
        uiManager.showToast('You are back online', 'success');
      }
    } else {
      // Show offline notification
      if (uiManager) {
        uiManager.showToast('You are offline. Some features may be limited.', 'warning');
      }
    }
  }

  /**
   * Handle visibility change (app goes to background/foreground)
   */
  handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      console.log('App is in foreground');
      
      // Refresh data when app comes to foreground
      if (uiManager && uiManager.screens.dashboard.classList.contains('active')) {
        uiManager.renderTranscriptsList();
      }
      
      // Check for updates
      this.checkForUpdates();
    } else {
      console.log('App is in background');
    }
  }

  /**
   * Process URL parameters
   */
  processUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    
    // Handle deep links
    const action = params.get('action');
    if (action) {
      switch (action) {
        case 'scan':
          if (uiManager) uiManager.navigateTo('scanner');
          break;
        case 'record':
          if (uiManager) uiManager.navigateTo('recording');
          break;
        case 'transcript':
          const transcriptId = params.get('id');
          if (transcriptId && uiManager) {
            uiManager.viewTranscript(transcriptId);
          }
          break;
      }
    }
  }

  /**
   * Check for app updates
   */
  async checkForUpdates() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }
  }

  /**
   * Show update notification
   */
  showUpdateNotification() {
    if (uiManager) {
      uiManager.showConfirmDialog(
        'Update Available',
        'A new version of the app is available. Would you like to reload to update?',
        () => {
          window.location.reload();
        }
      );
    }
  }

  /**
   * Show install prompt
   */
  showInstallPrompt() {
    // Show install button if available
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
      installButton.classList.remove('d-none');
      installButton.addEventListener('click', this.handleAppInstall);
    }
  }

  /**
   * Hide install prompt
   */
  hideInstallPrompt() {
    const installButton = document.getElementById('install-pwa-btn');
    if (installButton) {
      installButton.classList.add('d-none');
    }
  }

  /**
   * Handle app install button click
   */
  async handleAppInstall() {
    if (!this.deferredInstallPrompt) return;
    
    // Show the install prompt
    this.deferredInstallPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await this.deferredInstallPrompt.userChoice;
    
    // Reset the deferred prompt variable
    this.deferredInstallPrompt = null;
    
    // Hide install button
    this.hideInstallPrompt();
  }

  /**
   * Sync pending uploads
   */
  async syncPendingUploads() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-transcripts');
        console.log('Background sync registered for pending uploads');
      } catch (error) {
        console.error('Error registering background sync:', error);
        
        // Fallback for browsers that don't support background sync
        this.syncPendingUploadsManually();
      }
    } else {
      console.warn('Background sync not supported in this browser');
      this.syncPendingUploadsManually();
    }
  }

  /**
   * Manually sync pending uploads
   */
  async syncPendingUploadsManually() {
    console.log('Manually syncing pending uploads');
    
    // This would typically be handled by the service worker
    // Here we're providing a fallback for browsers without background sync
    
    try {
      // Open IndexedDB
      const request = indexedDB.open('iScribeWebDB', 1);
      
      request.onsuccess = async event => {
        const db = event.target.result;
        
        // Get pending uploads
        const transaction = db.transaction(['pendingUploads'], 'readwrite');
        const store = transaction.objectStore('pendingUploads');
        const pendingUploads = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = event => resolve(event.target.result);
          request.onerror = event => reject(event.target.error);
        });
        
        console.log(`Found ${pendingUploads.length} pending uploads`);
        
        // Process each pending upload
        for (const upload of pendingUploads) {
          try {
            // Upload to API
            const response = await apiClient.uploadAudio(upload.audioBlob);
            console.log('Upload successful:', response);
            
            // Remove from pending uploads
            await new Promise((resolve, reject) => {
              const request = store.delete(upload.id);
              request.onsuccess = event => resolve();
              request.onerror = event => reject(event.target.error);
            });
            
            // Show notification
            if (uiManager) {
              uiManager.showToast('Pending recording uploaded successfully', 'success');
            }
            
            // Start polling for status
            const transcriptId = response.transcript_id;
            this.pollTranscriptStatus(transcriptId);
          } catch (error) {
            console.error('Error uploading pending recording:', error);
          }
        }
      };
      
      request.onerror = event => {
        console.error('Error opening IndexedDB:', event.target.error);
      };
    } catch (error) {
      console.error('Error syncing pending uploads:', error);
    }
  }

  /**
   * Poll for transcript status
   * @param {string} transcriptId - Transcript ID
   */
  async pollTranscriptStatus(transcriptId) {
    if (!transcriptId) return;
    
    try {
      await apiClient.pollTranscriptStatus(
        transcriptId,
        status => {
          console.log('Transcript status update:', status);
          
          // Refresh transcripts list if on dashboard
          if (uiManager && uiManager.screens.dashboard.classList.contains('active')) {
            uiManager.renderTranscriptsList();
          }
        }
      );
      
      // When polling completes (transcript is ready)
      console.log('Transcription completed');
      
      // Show notification
      if (uiManager) {
        uiManager.showToast('Transcription completed', 'success');
        
        // Refresh transcripts list if on dashboard
        if (uiManager.screens.dashboard.classList.contains('active')) {
          uiManager.renderTranscriptsList();
        }
      }
    } catch (error) {
      console.error('Error polling transcript status:', error);
      
      if (uiManager) {
        uiManager.showToast(`Transcription error: ${error.message}`, 'danger');
      }
    }
  }
}

// Create app instance
const app = new App();
