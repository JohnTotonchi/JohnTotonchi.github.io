/**
 * iScribeWeb - UI Manager
 * Handles user interface interactions and screen navigation
 */

class UIManager {
  constructor() {
    // Screens
    this.screens = {
      welcome: document.getElementById('welcome-screen'),
      scanner: document.getElementById('scanner-screen'),
      dashboard: document.getElementById('dashboard-screen'),
      recording: document.getElementById('recording-screen'),
      transcriptDetail: document.getElementById('transcript-detail-screen'),
      settings: document.getElementById('settings-screen')
    };
    
    // Navigation buttons
    this.backButtons = document.querySelectorAll('.back-btn');
    this.startScanButton = document.getElementById('start-scan-btn');
    this.gotoDashboardButton = document.getElementById('goto-dashboard');
    this.settingsButton = document.getElementById('settings-btn');
    this.scanNewQRButton = document.getElementById('scan-new-qr-btn');
    this.recordAudioButton = document.getElementById('record-audio-btn');
    this.uploadAudioButton = document.getElementById('upload-audio-btn');
    this.uploadRecordingButton = document.getElementById('upload-recording-btn');
    this.discardRecordingButton = document.getElementById('discard-recording-btn');
    this.exportTranscriptButton = document.getElementById('export-transcript-btn');
    
    // Settings elements
    this.darkModeToggle = document.getElementById('dark-mode-toggle');
    this.offlineModeToggle = document.getElementById('offline-mode-toggle');
    this.installPWAButton = document.getElementById('install-pwa-btn');
    this.apiConnectionDetails = document.getElementById('api-connection-details');
    
    // Loading overlay
    this.loadingOverlay = document.getElementById('loading-overlay');
    this.loadingMessage = document.getElementById('loading-message');
    
    // Transcript elements
    this.transcriptsList = document.getElementById('transcripts-list');
    this.noTranscriptsMessage = document.getElementById('no-transcripts-message');
    this.transcriptTitle = document.getElementById('transcript-title');
    this.transcriptDate = document.getElementById('transcript-date');
    this.transcriptStatus = document.getElementById('transcript-status');
    this.transcriptFullText = document.querySelector('#transcript-full-text .transcript-text');
    this.transcriptSegmentsList = document.querySelector('.transcript-segments-list');
    
    // PWA installation
    this.deferredPrompt = null;
    
    // Bind methods
    this.navigateTo = this.navigateTo.bind(this);
    this.handleBackButton = this.handleBackButton.bind(this);
    this.toggleDarkMode = this.toggleDarkMode.bind(this);
    this.showLoading = this.showLoading.bind(this);
    this.hideLoading = this.hideLoading.bind(this);
    this.updateAPIConnectionUI = this.updateAPIConnectionUI.bind(this);
    this.renderTranscriptsList = this.renderTranscriptsList.bind(this);
    this.renderTranscriptDetail = this.renderTranscriptDetail.bind(this);
    this.handleInstallClick = this.handleInstallClick.bind(this);
    
    // Initialize UI
    this.initEventListeners();
    this.initDarkMode();
    this.initPWAInstallPrompt();
    this.updateAPIConnectionUI();
  }

  /**
   * Initialize event listeners
   */
  initEventListeners() {
    // Back buttons
    this.backButtons.forEach(button => {
      button.addEventListener('click', this.handleBackButton);
    });
    
    // Navigation
    if (this.startScanButton) {
      this.startScanButton.addEventListener('click', () => this.navigateTo('scanner'));
    }
    
    if (this.gotoDashboardButton) {
      this.gotoDashboardButton.addEventListener('click', () => this.navigateTo('dashboard'));
    }
    
    if (this.settingsButton) {
      this.settingsButton.addEventListener('click', () => this.navigateTo('settings'));
    }
    
    if (this.scanNewQRButton) {
      this.scanNewQRButton.addEventListener('click', () => this.navigateTo('scanner'));
    }
    
    if (this.recordAudioButton) {
      this.recordAudioButton.addEventListener('click', () => this.navigateTo('recording'));
    }
    
    // Settings
    if (this.darkModeToggle) {
      this.darkModeToggle.addEventListener('change', this.toggleDarkMode);
    }
    
    // Recording actions
    if (this.uploadRecordingButton) {
      this.uploadRecordingButton.addEventListener('click', async () => {
        try {
          const response = await audioRecorder.uploadRecording();
          
          if (response.offline) {
            this.showToast('Recording saved for offline upload', 'info');
          } else {
            this.showToast('Recording uploaded successfully', 'success');
            this.navigateTo('dashboard');
          }
        } catch (error) {
          this.showToast(`Upload failed: ${error.message}`, 'danger');
        }
      });
    }
    
    if (this.discardRecordingButton) {
      this.discardRecordingButton.addEventListener('click', () => {
        this.showConfirmDialog(
          'Discard Recording',
          'Are you sure you want to discard this recording?',
          () => {
            // Reset recording UI
            document.getElementById('recording-actions').classList.add('d-none');
            document.getElementById('start-recording-btn').classList.remove('d-none');
            document.getElementById('play-recording-btn').classList.add('d-none');
            document.getElementById('recording-timer').textContent = '00:00';
            
            // Navigate back to dashboard
            this.navigateTo('dashboard');
          }
        );
      });
    }
    
    // File upload
    if (this.uploadAudioButton) {
      this.uploadAudioButton.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', async event => {
          const file = event.target.files[0];
          if (file) {
            this.showLoading('Uploading audio file...');
            
            try {
              const response = await apiClient.uploadAudio(file);
              this.hideLoading();
              this.showToast('Audio file uploaded successfully', 'success');
              
              // Trigger custom event
              const uploadEvent = new CustomEvent('file-uploaded', {
                detail: response
              });
              document.dispatchEvent(uploadEvent);
            } catch (error) {
              this.hideLoading();
              this.showToast(`Upload failed: ${error.message}`, 'danger');
            }
          }
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
        
        // Remove the input after selection
        setTimeout(() => {
          document.body.removeChild(fileInput);
        }, 5000);
      });
    }
    
    // Export transcript
    if (this.exportTranscriptButton) {
      this.exportTranscriptButton.addEventListener('click', () => {
        const transcriptId = this.exportTranscriptButton.dataset.transcriptId;
        if (transcriptId) {
          this.exportTranscript(transcriptId);
        }
      });
    }
    
    // Install PWA
    if (this.installPWAButton) {
      this.installPWAButton.addEventListener('click', this.handleInstallClick);
    }
    
    // Custom events
    document.addEventListener('qr-scan-success', event => {
      this.updateAPIConnectionUI();
      this.showToast('Connected to API successfully', 'success');
      setTimeout(() => this.navigateTo('dashboard'), 1500);
    });
    
    document.addEventListener('qr-scan-error', event => {
      this.showToast(`QR scan error: ${event.detail.error}`, 'danger');
    });
    
    document.addEventListener('recording-uploaded', event => {
      this.showToast('Recording uploaded successfully', 'success');
      this.navigateTo('dashboard');
      
      // Start polling for status
      const transcriptId = event.detail.transcript_id;
      this.pollTranscriptStatus(transcriptId);
    });
    
    document.addEventListener('recording-saved-offline', () => {
      this.showToast('Recording saved for offline upload', 'info');
      this.navigateTo('dashboard');
    });
    
    // Check URL parameters on load
    window.addEventListener('load', () => {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      
      if (action === 'scan') {
        this.navigateTo('scanner');
      } else if (action === 'record') {
        this.navigateTo('recording');
      }
    });
  }

  /**
   * Initialize dark mode
   */
  initDarkMode() {
    // Check for saved preference
    const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    
    if (darkModeEnabled) {
      document.body.classList.add('dark-mode');
      if (this.darkModeToggle) {
        this.darkModeToggle.checked = true;
      }
    }
    
    // Check for system preference if no saved preference
    if (localStorage.getItem('darkMode') === null) {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDarkMode) {
        document.body.classList.add('dark-mode');
        if (this.darkModeToggle) {
          this.darkModeToggle.checked = true;
        }
        localStorage.setItem('darkMode', 'true');
      }
    }
  }

  /**
   * Initialize PWA install prompt
   */
  initPWAInstallPrompt() {
    window.addEventListener('beforeinstallprompt', event => {
      // Prevent Chrome 67+ from automatically showing the prompt
      event.preventDefault();
      
      // Stash the event so it can be triggered later
      this.deferredPrompt = event;
      
      // Show the install button
      if (this.installPWAButton) {
        this.installPWAButton.classList.remove('d-none');
      }
    });
    
    // Hide the install button if app is already installed
    window.addEventListener('appinstalled', () => {
      if (this.installPWAButton) {
        this.installPWAButton.classList.add('d-none');
      }
      this.deferredPrompt = null;
    });
  }

  /**
   * Handle PWA install button click
   */
  async handleInstallClick() {
    if (!this.deferredPrompt) return;
    
    // Show the install prompt
    this.deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await this.deferredPrompt.userChoice;
    
    // Reset the deferred prompt variable
    this.deferredPrompt = null;
    
    // Hide the install button
    if (this.installPWAButton) {
      this.installPWAButton.classList.add('d-none');
    }
  }

  /**
   * Navigate to a screen
   * @param {string} screenId - ID of the screen to navigate to
   */
  navigateTo(screenId) {
    // Hide all screens
    Object.values(this.screens).forEach(screen => {
      if (screen) {
        screen.classList.remove('active');
      }
    });
    
    // Show the target screen
    const targetScreen = this.screens[screenId];
    if (targetScreen) {
      targetScreen.classList.add('active');
      
      // Special handling for specific screens
      if (screenId === 'scanner') {
        // Initialize and start QR scanner
        qrScanner.initialize(qrScanner.handleSuccess)
          .then(isInitialized => {
            if (isInitialized) {
              qrScanner.startScanner();
            } else {
              this.showToast('Camera access not available', 'danger');
              this.navigateTo('welcome');
            }
          });
      } else if (screenId === 'dashboard') {
        // Fetch and render transcripts
        this.renderTranscriptsList();
      } else if (screenId === 'settings') {
        // Update API connection details
        this.updateAPIConnectionUI();
      }
    }
  }

  /**
   * Handle back button click
   */
  handleBackButton() {
    // Determine current screen
    let currentScreen = null;
    Object.entries(this.screens).forEach(([id, screen]) => {
      if (screen && screen.classList.contains('active')) {
        currentScreen = id;
      }
    });
    
    // Navigate based on current screen
    switch (currentScreen) {
      case 'scanner':
        qrScanner.stopScanner();
        this.navigateTo('welcome');
        break;
      case 'recording':
        if (audioRecorder.isRecording) {
          this.showConfirmDialog(
            'Stop Recording',
            'Are you sure you want to stop recording and discard the audio?',
            () => {
              audioRecorder.stopRecording();
              this.navigateTo('dashboard');
            }
          );
        } else {
          this.navigateTo('dashboard');
        }
        break;
      case 'transcriptDetail':
        this.navigateTo('dashboard');
        break;
      case 'settings':
        this.navigateTo('dashboard');
        break;
      default:
        this.navigateTo('welcome');
    }
  }

  /**
   * Toggle dark mode
   */
  toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode.toString());
  }

  /**
   * Show loading overlay
   * @param {string} message - Loading message
   */
  showLoading(message = 'Loading...') {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('d-none');
    }
    if (this.loadingMessage) {
      this.loadingMessage.textContent = message;
    }
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('d-none');
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type (success, danger, warning, info)
   * @param {number} duration - Duration in milliseconds
   */
  showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Toast content
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Initialize and show toast
    const bsToast = new bootstrap.Toast(toast, {
      autohide: true,
      delay: duration
    });
    bsToast.show();
    
    // Remove toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
  }

  /**
   * Show confirmation dialog
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @param {Function} onConfirm - Callback for confirm button
   * @param {Function} onCancel - Callback for cancel button
   */
  showConfirmDialog(title, message, onConfirm, onCancel = null) {
    // Create modal element
    const modalId = `modal-${Date.now()}`;
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = modalId;
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', `${modalId}-label`);
    modal.setAttribute('aria-hidden', 'true');
    
    // Modal content
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="${modalId}-label">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="${modalId}-confirm">Confirm</button>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to DOM
    document.body.appendChild(modal);
    
    // Initialize modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Add event listeners
    const confirmButton = document.getElementById(`${modalId}-confirm`);
    if (confirmButton) {
      confirmButton.addEventListener('click', () => {
        bsModal.hide();
        if (onConfirm) {
          onConfirm();
        }
      });
    }
    
    // Handle cancel
    modal.addEventListener('hidden.bs.modal', () => {
      if (onCancel) {
        onCancel();
      }
      modal.remove();
    });
  }

  /**
   * Update API connection UI
   */
  updateAPIConnectionUI() {
    if (!this.apiConnectionDetails) return;
    
    if (apiClient.hasAPIDetails()) {
      const details = apiClient.getAPIDetails();
      this.apiConnectionDetails.innerHTML = `
        <div class="alert alert-success mb-3">
          <h6 class="mb-1">Connected to API</h6>
          <p class="mb-0 small">${details.url}</p>
          <p class="mb-0 small">Username: ${details.username}</p>
        </div>
        <button id="disconnect-api-btn" class="btn btn-outline-danger">Disconnect</button>
      `;
      
      // Add disconnect button event listener
      const disconnectButton = document.getElementById('disconnect-api-btn');
      if (disconnectButton) {
        disconnectButton.addEventListener('click', () => {
          this.showConfirmDialog(
            'Disconnect API',
            'Are you sure you want to disconnect from the API? This will remove all saved credentials.',
            () => {
              apiClient.clearAPIDetails();
              this.updateAPIConnectionUI();
              this.showToast('Disconnected from API', 'info');
              this.navigateTo('welcome');
            }
          );
        });
      }
    } else {
      this.apiConnectionDetails.innerHTML = `
        <p class="text-muted">Not connected</p>
        <button id="scan-new-qr-btn" class="btn btn-primary">Scan QR Code</button>
      `;
      
      // Add scan button event listener
      const scanButton = document.getElementById('scan-new-qr-btn');
      if (scanButton) {
        scanButton.addEventListener('click', () => this.navigateTo('scanner'));
      }
    }
  }

  /**
   * Render transcripts list
   */
  async renderTranscriptsList() {
    if (!this.transcriptsList || !this.noTranscriptsMessage) return;
    
    this.showLoading('Loading transcripts...');
    
    try {
      // Check if API is connected
      if (!apiClient.hasAPIDetails()) {
        this.hideLoading();
        this.noTranscriptsMessage.innerHTML = `
          <p>Connect to an API to view transcripts</p>
          <button id="connect-api-btn" class="btn btn-primary">Connect API</button>
        `;
        this.noTranscriptsMessage.classList.remove('d-none');
        this.transcriptsList.innerHTML = '';
        
        // Add connect button event listener
        const connectButton = document.getElementById('connect-api-btn');
        if (connectButton) {
          connectButton.addEventListener('click', () => this.navigateTo('scanner'));
        }
        
        return;
      }
      
      // Fetch transcripts
      const transcriptIds = await apiClient.getTranscripts();
      
      this.hideLoading();
      
      if (!transcriptIds || transcriptIds.length === 0) {
        this.noTranscriptsMessage.innerHTML = '<p>No transcripts yet</p>';
        this.noTranscriptsMessage.classList.remove('d-none');
        this.transcriptsList.innerHTML = '';
        return;
      }
      
      // Hide no transcripts message
      this.noTranscriptsMessage.classList.add('d-none');
      
      // Clear list
      this.transcriptsList.innerHTML = '';
      
      // Fetch details for each transcript
      for (const id of transcriptIds) {
        try {
          const status = await apiClient.getTranscriptStatus(id);
          
          // Create list item
          const listItem = document.createElement('a');
          listItem.href = '#';
          listItem.className = 'list-group-item list-group-item-action transcript-item';
          listItem.dataset.transcriptId = id;
          
          // Format date
          const date = new Date(status.created_at);
          const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          
          // Status badge
          let badgeClass = 'bg-secondary';
          if (status.status === 'completed') {
            badgeClass = 'bg-success';
          } else if (status.status === 'processing') {
            badgeClass = 'bg-primary';
          } else if (status.status === 'failed') {
            badgeClass = 'bg-danger';
          }
          
          // Set content
          listItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
              <h6 class="mb-1">Transcript ${id}</h6>
              <span class="badge ${badgeClass}">${status.status}</span>
            </div>
            <p class="mb-1 text-muted small">${formattedDate}</p>
          `;
          
          // Add click event
          listItem.addEventListener('click', () => {
            this.viewTranscript(id);
          });
          
          // Add to list
          this.transcriptsList.appendChild(listItem);
        } catch (error) {
          console.error(`Error fetching transcript ${id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error rendering transcripts list:', error);
      this.hideLoading();
      this.showToast(`Error loading transcripts: ${error.message}`, 'danger');
    }
  }

  /**
   * View transcript details
   * @param {string} transcriptId - Transcript ID
   */
  async viewTranscript(transcriptId) {
    this.showLoading('Loading transcript...');
    
    try {
      // Fetch transcript details
      const transcript = await apiClient.getTranscript(transcriptId);
      
      this.hideLoading();
      
      // Render transcript details
      this.renderTranscriptDetail(transcript);
      
      // Navigate to transcript detail screen
      this.navigateTo('transcriptDetail');
    } catch (error) {
      console.error('Error viewing transcript:', error);
      this.hideLoading();
      this.showToast(`Error loading transcript: ${error.message}`, 'danger');
    }
  }

  /**
   * Render transcript detail
   * @param {Object} transcript - Transcript data
   */
  renderTranscriptDetail(transcript) {
    if (!this.transcriptTitle || !this.transcriptDate || !this.transcriptStatus || 
        !this.transcriptFullText || !this.transcriptSegmentsList) {
      return;
    }
    
    // Set transcript ID for export button
    if (this.exportTranscriptButton) {
      this.exportTranscriptButton.dataset.transcriptId = transcript.id;
    }
    
    // Set title
    this.transcriptTitle.textContent = `Transcript #${transcript.id}`;
    
    // Format and set date
    const date = new Date(transcript.created_at);
    this.transcriptDate.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
    // Set status badge
    let badgeClass = 'bg-secondary';
    if (transcript.status === 'completed') {
      badgeClass = 'bg-success';
    } else if (transcript.status === 'processing') {
      badgeClass = 'bg-primary';
    } else if (transcript.status === 'failed') {
      badgeClass = 'bg-danger';
    }
    this.transcriptStatus.innerHTML = `<span class="badge ${badgeClass}">${transcript.status}</span>`;
    
    // Set full text
    if (transcript.result && transcript.result.text) {
      this.transcriptFullText.textContent = transcript.result.text;
    } else {
      this.transcriptFullText.textContent = 'No transcript text available';
    }
    
    // Render segments
    this.transcriptSegmentsList.innerHTML = '';
    
    if (transcript.result && transcript.result.segments && transcript.result.segments.length > 0) {
      // Create a map of unique speakers
      const speakers = new Set();
      transcript.result.segments.forEach(segment => {
        speakers.add(segment.speaker);
      });
      
      // Assign speaker classes
      const speakerClasses = {};
      Array.from(speakers).forEach((speaker, index) => {
        speakerClasses[speaker] = `speaker-${(index % 5) + 1}`;
      });
      
      // Render each segment
      transcript.result.segments.forEach(segment => {
        const segmentElement = document.createElement('div');
        segmentElement.className = `transcript-segment ${speakerClasses[segment.speaker]}`;
        
        // Format time
        const startTime = this.formatTime(segment.start);
        const endTime = this.formatTime(segment.end);
        const duration = this.formatTime(segment.end - segment.start);
        
        segmentElement.innerHTML = `
          <div class="transcript-segment-header">
            <span class="transcript-segment-speaker">${segment.speaker}</span>
            <span class="transcript-segment-time">${startTime} - ${endTime} (${duration})</span>
          </div>
          <p class="transcript-segment-text">${segment.text}</p>
          <div class="transcript-segment-controls">
            <button class="btn btn-sm btn-outline-secondary play-segment-btn" 
                    data-start="${segment.start}" 
                    data-end="${segment.end}">
              <i class="bi bi-play-fill"></i> Play
            </button>
          </div>
        `;
        
        this.transcriptSegmentsList.appendChild(segmentElement);
      });
      
      // Add event listeners for play buttons
      const playButtons = this.transcriptSegmentsList.querySelectorAll('.play-segment-btn');
      playButtons.forEach(button => {
        button.addEventListener('click', () => {
          const start = parseFloat(button.dataset.start);
          const end = parseFloat(button.dataset.end);
          this.playAudioSegment(transcript.audio_path, start, end);
        });
      });
    } else {
      this.transcriptSegmentsList.innerHTML = '<p class="text-muted">No segments available</p>';
    }
  }

  /**
   * Play audio segment
   * @param {string} audioPath - Path to audio file
   * @param {number} start - Start time in seconds
   * @param {number} end - End time in seconds
   */
  async playAudioSegment(audioPath, start, end) {
    // This is a placeholder - in a real implementation, you would:
    // 1. Fetch the audio file from the server
    // 2. Create an audio element
    // 3. Set the currentTime to start
    // 4. Play until end time
    
    console.log(`Playing segment from ${start}s to ${end}s of ${audioPath}`);
    this.showToast(`Playing segment from ${this.formatTime(start)} to ${this.formatTime(end)}`, 'info');
  }

  /**
   * Format time in seconds to MM:SS.ms
   * @param {number} seconds - Time in seconds
   * @returns {string} - Formatted time
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  }

  /**
   * Export transcript to file
   * @param {string} transcriptId - Transcript ID
   */
  async exportTranscript(transcriptId) {
    this.showLoading('Preparing export...');
    
    try {
      // Fetch transcript details
      const transcript = await apiClient.getTranscript(transcriptId);
      
      this.hideLoading();
      
      if (!transcript || !transcript.result) {
        this.showToast('No transcript data available for export', 'warning');
        return;
      }
      
      // Create export data
      let exportData = '';
      
      // Add header
      exportData += `Transcript ID: ${transcript.id}\n`;
      exportData += `Created: ${new Date(transcript.created_at).toLocaleString()}\n`;
      exportData += `Status: ${transcript.status}\n\n`;
      
      // Add full text
      exportData += `FULL TRANSCRIPT:\n\n${transcript.result.text}\n\n`;
      
      // Add segments
      exportData += 'SEGMENTS BY SPEAKER:\n\n';
      
      if (transcript.result.segments && transcript.result.segments.length > 0) {
        transcript.result.segments.forEach(segment => {
          const startTime = this.formatTime(segment.start);
          const endTime = this.formatTime(segment.end);
          exportData += `[${startTime} - ${endTime}] ${segment.speaker}: ${segment.text}\n`;
        });
      } else {
        exportData += 'No segments available\n';
      }
      
      // Create download link
      const blob = new Blob([exportData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${transcript.id}.txt`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      this.showToast('Transcript exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting transcript:', error);
      this.hideLoading();
      this.showToast(`Error exporting transcript: ${error.message}`, 'danger');
    }
  }

  /**
   * Poll for transcript status
   * @param {string} transcriptId - Transcript ID
   */
  async pollTranscriptStatus(transcriptId) {
    try {
      await apiClient.pollTranscriptStatus(
        transcriptId,
        status => {
          // Update UI based on status
          console.log('Transcript status update:', status);
          
          // Refresh transcripts list
          this.renderTranscriptsList();
        }
      );
      
      // When polling completes (transcript is ready)
      this.showToast('Transcription completed', 'success');
      this.renderTranscriptsList();
    } catch (error) {
      console.error('Error polling transcript status:', error);
      this.showToast(`Transcription error: ${error.message}`, 'danger');
    }
  }
}

// Create UI manager instance
const uiManager = new UIManager();
