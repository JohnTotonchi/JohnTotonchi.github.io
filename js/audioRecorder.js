/**
 * iScribeWeb - Audio Recorder
 * Handles audio recording functionality using the MediaRecorder API
 */

class AudioRecorder {
  constructor() {
    // DOM elements
    this.startButton = document.getElementById('start-recording-btn');
    this.stopButton = document.getElementById('stop-recording-btn');
    this.playButton = document.getElementById('play-recording-btn');
    this.timerDisplay = document.getElementById('recording-timer');
    this.visualizationElement = document.getElementById('recording-visualization');
    this.recordingActions = document.getElementById('recording-actions');
    
    // Recorder state
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioBlob = null;
    this.audioURL = null;
    this.audioElement = new Audio();
    this.stream = null;
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.timerInterval = null;
    this.analyser = null;
    this.visualizationInterval = null;
    
    // Database
    this.db = null;
    
    // Bind methods
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.playRecording = this.playRecording.bind(this);
    this.updateTimer = this.updateTimer.bind(this);
    this.updateVisualization = this.updateVisualization.bind(this);
    this.saveRecording = this.saveRecording.bind(this);
    this.uploadRecording = this.uploadRecording.bind(this);
    
    // Initialize IndexedDB
    this.initDatabase();
    
    // Add event listeners
    if (this.startButton) {
      this.startButton.addEventListener('click', this.startRecording);
    }
    if (this.stopButton) {
      this.stopButton.addEventListener('click', this.stopRecording);
    }
    if (this.playButton) {
      this.playButton.addEventListener('click', this.playRecording);
    }
  }

  /**
   * Initialize IndexedDB database
   */
  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('iScribeWebDB', 1);
      
      request.onerror = event => {
        console.error('Error opening IndexedDB:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = event => {
        this.db = event.target.result;
        console.log('IndexedDB opened successfully');
        resolve();
      };
      
      request.onupgradeneeded = event => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('recordings')) {
          const recordingsStore = db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
          recordingsStore.createIndex('timestamp', 'timestamp', { unique: false });
          recordingsStore.createIndex('duration', 'duration', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('pendingUploads')) {
          const uploadsStore = db.createObjectStore('pendingUploads', { keyPath: 'id', autoIncrement: true });
          uploadsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Check if audio recording is supported
   * @returns {Promise<boolean>} - True if recording is supported
   */
  async isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Request microphone access
   * @returns {Promise<boolean>} - True if access was granted
   */
  async requestMicrophoneAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording() {
    if (this.isRecording) return;
    
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Set up audio context for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(this.stream);
      this.analyser = audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      
      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.stream);
      
      // Clear previous recording data
      this.audioChunks = [];
      this.audioBlob = null;
      this.audioURL = null;
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        // Create blob from chunks
        this.audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.audioURL = URL.createObjectURL(this.audioBlob);
        
        // Set up audio element
        this.audioElement.src = this.audioURL;
        
        // Show recording actions
        if (this.recordingActions) {
          this.recordingActions.classList.remove('d-none');
        }
        
        // Save recording to IndexedDB
        this.saveRecording();
        
        // Update UI
        if (this.visualizationElement) {
          this.visualizationElement.classList.remove('recording');
        }
      };
      
      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      
      // Update UI
      if (this.startButton) {
        this.startButton.classList.add('d-none');
      }
      if (this.stopButton) {
        this.stopButton.classList.remove('d-none');
      }
      if (this.visualizationElement) {
        this.visualizationElement.classList.add('recording');
      }
      
      // Start timer
      this.recordingStartTime = Date.now();
      this.timerInterval = setInterval(this.updateTimer, 1000);
      this.updateTimer();
      
      // Start visualization
      this.visualizationInterval = setInterval(this.updateVisualization, 100);
      
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording() {
    if (!this.isRecording) return;
    
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    // Stop all tracks in the stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Clear intervals
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.visualizationInterval) {
      clearInterval(this.visualizationInterval);
      this.visualizationInterval = null;
    }
    
    // Update state
    this.isRecording = false;
    
    // Update UI
    if (this.stopButton) {
      this.stopButton.classList.add('d-none');
    }
    if (this.playButton) {
      this.playButton.classList.remove('d-none');
    }
    
    console.log('Recording stopped');
  }

  /**
   * Play recorded audio
   */
  playRecording() {
    if (!this.audioElement.src) return;
    
    if (this.audioElement.paused) {
      this.audioElement.play();
      if (this.playButton) {
        this.playButton.innerHTML = '<i class="bi bi-pause-circle"></i>';
      }
    } else {
      this.audioElement.pause();
      if (this.playButton) {
        this.playButton.innerHTML = '<i class="bi bi-play-circle"></i>';
      }
    }
    
    // Reset button when audio ends
    this.audioElement.onended = () => {
      if (this.playButton) {
        this.playButton.innerHTML = '<i class="bi bi-play-circle"></i>';
      }
    };
  }

  /**
   * Update recording timer display
   */
  updateTimer() {
    if (!this.timerDisplay) return;
    
    const elapsed = Date.now() - this.recordingStartTime;
    const seconds = Math.floor(elapsed / 1000) % 60;
    const minutes = Math.floor(elapsed / 60000);
    
    this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Update audio visualization
   */
  updateVisualization() {
    if (!this.analyser || !this.visualizationElement) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    
    // Update visualization bars
    const bars = this.visualizationElement.querySelectorAll('.audio-wave-bar');
    if (bars.length > 0) {
      const maxHeight = 50; // Maximum height in pixels
      const scaleFactor = maxHeight / 255; // Scale to max height
      
      bars.forEach((bar, index) => {
        // Use different parts of the frequency data for each bar
        const segment = Math.floor(bufferLength / bars.length);
        const startIndex = segment * index;
        const endIndex = startIndex + segment;
        
        let segmentSum = 0;
        for (let i = startIndex; i < endIndex; i++) {
          segmentSum += dataArray[i];
        }
        const segmentAverage = segmentSum / segment;
        
        // Apply height with some randomness for visual appeal
        const randomFactor = 0.7 + Math.random() * 0.6; // Between 0.7 and 1.3
        const height = Math.max(5, segmentAverage * scaleFactor * randomFactor);
        
        bar.style.height = `${height}px`;
      });
    }
  }

  /**
   * Save recording to IndexedDB
   */
  async saveRecording() {
    if (!this.db || !this.audioBlob) return;
    
    try {
      const duration = Math.round((Date.now() - this.recordingStartTime) / 1000);
      const timestamp = new Date().toISOString();
      
      const transaction = this.db.transaction(['recordings'], 'readwrite');
      const store = transaction.objectStore('recordings');
      
      const recording = {
        blob: this.audioBlob,
        duration,
        timestamp,
        size: this.audioBlob.size,
        type: this.audioBlob.type
      };
      
      const request = store.add(recording);
      
      request.onsuccess = event => {
        console.log('Recording saved to IndexedDB with ID:', event.target.result);
        
        // Trigger custom event
        const saveEvent = new CustomEvent('recording-saved', {
          detail: {
            id: event.target.result,
            duration,
            timestamp
          }
        });
        document.dispatchEvent(saveEvent);
      };
      
      request.onerror = event => {
        console.error('Error saving recording:', event.target.error);
      };
    } catch (error) {
      console.error('Error saving recording:', error);
    }
  }

  /**
   * Upload recording to API
   * @param {boolean} saveOffline - Whether to save for offline upload if API is unavailable
   * @returns {Promise<Object>} - API response
   */
  async uploadRecording(saveOffline = true) {
    if (!this.audioBlob) {
      throw new Error('No recording available');
    }
    
    try {
      // Show loading state
      document.getElementById('loading-overlay').classList.remove('d-none');
      document.getElementById('loading-message').textContent = 'Uploading recording...';
      
      // Check if online
      if (navigator.onLine) {
        // Upload to API
        const response = await apiClient.uploadAudio(this.audioBlob);
        
        // Hide loading state
        document.getElementById('loading-overlay').classList.add('d-none');
        
        // Trigger custom event
        const uploadEvent = new CustomEvent('recording-uploaded', {
          detail: response
        });
        document.dispatchEvent(uploadEvent);
        
        return response;
      } else if (saveOffline) {
        // Save for offline upload
        await this.saveForOfflineUpload();
        
        // Hide loading state
        document.getElementById('loading-overlay').classList.add('d-none');
        
        // Trigger custom event
        const offlineEvent = new CustomEvent('recording-saved-offline');
        document.dispatchEvent(offlineEvent);
        
        // Register for background sync if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-transcripts');
        }
        
        return { offline: true, message: 'Recording saved for offline upload' };
      }
    } catch (error) {
      console.error('Error uploading recording:', error);
      
      // Hide loading state
      document.getElementById('loading-overlay').classList.add('d-none');
      
      // Save for offline upload if requested
      if (saveOffline) {
        await this.saveForOfflineUpload();
        
        // Trigger custom event
        const offlineEvent = new CustomEvent('recording-saved-offline');
        document.dispatchEvent(offlineEvent);
        
        return { offline: true, message: 'Recording saved for offline upload' };
      }
      
      throw error;
    }
  }

  /**
   * Save recording for offline upload
   */
  async saveForOfflineUpload() {
    if (!this.db || !this.audioBlob) return;
    
    try {
      const transaction = this.db.transaction(['pendingUploads'], 'readwrite');
      const store = transaction.objectStore('pendingUploads');
      
      const upload = {
        audioBlob: this.audioBlob,
        timestamp: new Date().toISOString()
      };
      
      const request = store.add(upload);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = event => {
          console.log('Recording saved for offline upload with ID:', event.target.result);
          resolve(event.target.result);
        };
        
        request.onerror = event => {
          console.error('Error saving for offline upload:', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error('Error saving for offline upload:', error);
      throw error;
    }
  }

  /**
   * Get all saved recordings
   * @returns {Promise<Array>} - Array of recordings
   */
  async getRecordings() {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['recordings'], 'readonly');
      const store = transaction.objectStore('recordings');
      const request = store.getAll();
      
      request.onsuccess = event => {
        resolve(event.target.result);
      };
      
      request.onerror = event => {
        console.error('Error getting recordings:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Get a specific recording
   * @param {number} id - Recording ID
   * @returns {Promise<Object>} - Recording object
   */
  async getRecording(id) {
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['recordings'], 'readonly');
      const store = transaction.objectStore('recordings');
      const request = store.get(id);
      
      request.onsuccess = event => {
        resolve(event.target.result);
      };
      
      request.onerror = event => {
        console.error('Error getting recording:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Delete a recording
   * @param {number} id - Recording ID
   * @returns {Promise<boolean>} - True if deletion was successful
   */
  async deleteRecording(id) {
    if (!this.db) return false;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['recordings'], 'readwrite');
      const store = transaction.objectStore('recordings');
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log('Recording deleted:', id);
        resolve(true);
      };
      
      request.onerror = event => {
        console.error('Error deleting recording:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Format duration in seconds to MM:SS
   * @param {number} seconds - Duration in seconds
   * @returns {string} - Formatted duration
   */
  static formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Create recorder instance
const audioRecorder = new AudioRecorder();
