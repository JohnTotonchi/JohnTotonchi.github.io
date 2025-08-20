/**
 * iScribeWeb - QR Code Scanner
 * Handles QR code scanning functionality using the device camera
 */

class QRScanner {
  constructor() {
    // DOM elements
    this.videoElement = document.getElementById('qr-video');
    this.scannerContainer = document.getElementById('qr-scanner-container');
    this.resultContainer = document.getElementById('qr-result');
    this.resultText = document.getElementById('qr-result-text');
    this.toggleCameraButton = document.getElementById('toggle-camera-btn');
    
    // Scanner state
    this.isScanning = false;
    this.stream = null;
    this.videoTrack = null;
    this.canvasElement = document.createElement('canvas');
    this.canvas = this.canvasElement.getContext('2d');
    this.facingMode = 'environment'; // Start with back camera
    
    // Bind methods
    this.startScanner = this.startScanner.bind(this);
    this.stopScanner = this.stopScanner.bind(this);
    this.scanQRCode = this.scanQRCode.bind(this);
    this.toggleCamera = this.toggleCamera.bind(this);
    this.handleSuccess = this.handleSuccess.bind(this);
    
    // Event listeners
    if (this.toggleCameraButton) {
      this.toggleCameraButton.addEventListener('click', this.toggleCamera);
    }
  }

  /**
   * Initialize the QR scanner
   * @param {Function} onScanSuccess - Callback for successful scan
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(onScanSuccess) {
    this.onScanSuccess = onScanSuccess;
    
    // Check if camera is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Camera access not supported in this browser');
      return false;
    }
    
    return true;
  }

  /**
   * Start the QR scanner
   * @returns {Promise<boolean>} - True if scanner started successfully
   */
  async startScanner() {
    if (this.isScanning) return true;
    
    try {
      // Show loading state
      if (this.videoElement) {
        this.videoElement.classList.add('loading');
      }
      
      // Get camera stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.facingMode }
      });
      
      // Set up video element
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        this.videoElement.setAttribute('playsinline', true); // Required for iOS
        await this.videoElement.play();
        
        // Get video track for later use
        this.videoTrack = this.stream.getVideoTracks()[0];
        
        // Set canvas size to match video
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;
        
        // Start scanning
        this.isScanning = true;
        this.scanQRCode();
        
        // Remove loading state
        this.videoElement.classList.remove('loading');
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error starting QR scanner:', error);
      
      // Remove loading state
      if (this.videoElement) {
        this.videoElement.classList.remove('loading');
      }
      
      return false;
    }
  }

  /**
   * Stop the QR scanner
   */
  stopScanner() {
    if (!this.isScanning) return;
    
    // Stop scanning loop
    this.isScanning = false;
    
    // Stop all tracks in the stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.videoTrack = null;
    }
    
    // Clear video source
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  /**
   * Scan for QR codes in the video feed
   */
  scanQRCode() {
    if (!this.isScanning) return;
    
    // Check if video is playing
    if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
      // Draw video frame to canvas
      this.canvas.drawImage(
        this.videoElement,
        0, 0,
        this.canvasElement.width,
        this.canvasElement.height
      );
      
      // Get image data for QR code detection
      const imageData = this.canvas.getImageData(
        0, 0,
        this.canvasElement.width,
        this.canvasElement.height
      );
      
      // Scan for QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });
      
      // If QR code found
      if (code) {
        console.log('QR code detected:', code.data);
        
        // Stop scanning
        this.stopScanner();
        
        // Show result
        this.showResult(code.data);
        
        // Call success callback
        if (this.onScanSuccess) {
          this.onScanSuccess(code.data);
        }
      }
    }
    
    // Continue scanning
    if (this.isScanning) {
      requestAnimationFrame(this.scanQRCode);
    }
  }

  /**
   * Toggle between front and back camera
   */
  async toggleCamera() {
    // Toggle facing mode
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    
    // Restart scanner with new facing mode
    this.stopScanner();
    await this.startScanner();
  }

  /**
   * Show scan result
   * @param {string} data - QR code data
   */
  showResult(data) {
    if (this.resultContainer && this.resultText) {
      // Show result container
      this.resultContainer.classList.remove('d-none');
      
      // Set result text (truncate if too long)
      const maxLength = 100;
      this.resultText.textContent = data.length > maxLength
        ? data.substring(0, maxLength) + '...'
        : data;
    }
  }

  /**
   * Handle successful QR code scan
   * @param {string} qrData - QR code data
   */
  handleSuccess(qrData) {
    // Parse QR code data
    const apiDetails = apiClient.parseQRCode(qrData);
    
    if (apiDetails) {
      // Save API details
      apiClient.saveAPIDetails(apiDetails);
      
      // Show success message
      this.showResult(`Connected to API at ${apiDetails.url}`);
      
      // Test connection
      apiClient.testConnection()
        .then(isConnected => {
          if (isConnected) {
            console.log('API connection successful');
            
            // Trigger custom event for successful connection
            const event = new CustomEvent('qr-scan-success', {
              detail: { apiDetails }
            });
            document.dispatchEvent(event);
          } else {
            console.error('API connection failed');
            
            // Trigger custom event for failed connection
            const event = new CustomEvent('qr-scan-error', {
              detail: { error: 'Could not connect to API server' }
            });
            document.dispatchEvent(event);
          }
        })
        .catch(error => {
          console.error('API connection test error:', error);
          
          // Trigger custom event for connection error
          const event = new CustomEvent('qr-scan-error', {
            detail: { error: error.message }
          });
          document.dispatchEvent(event);
        });
    } else {
      // Show error message
      this.showResult('Invalid QR code format');
      
      // Trigger custom event for invalid QR code
      const event = new CustomEvent('qr-scan-error', {
        detail: { error: 'Invalid QR code format' }
      });
      document.dispatchEvent(event);
    }
  }

  /**
   * Check if device has camera
   * @returns {Promise<boolean>} - True if camera is available
   */
  static async hasCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error checking for camera:', error);
      return false;
    }
  }
}

// Create scanner instance
const qrScanner = new QRScanner();
