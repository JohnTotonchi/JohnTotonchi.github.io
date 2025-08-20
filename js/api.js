/**
 * iScribeWeb - API Client
 * Handles communication with the Speech-to-Text API server
 */

class APIClient {
  constructor() {
    this.apiDetails = null;
    this.loadStoredAPIDetails();
  }

  /**
   * Load API details from localStorage
   */
  loadStoredAPIDetails() {
    try {
      const storedDetails = localStorage.getItem('apiDetails');
      if (storedDetails) {
        this.apiDetails = JSON.parse(storedDetails);
        console.log('API details loaded from storage');
      }
    } catch (error) {
      console.error('Error loading API details:', error);
    }
  }

  /**
   * Save API details to localStorage
   * @param {Object} details - API connection details
   */
  saveAPIDetails(details) {
    try {
      this.apiDetails = details;
      localStorage.setItem('apiDetails', JSON.stringify(details));
      console.log('API details saved to storage');
      return true;
    } catch (error) {
      console.error('Error saving API details:', error);
      return false;
    }
  }

  /**
   * Clear stored API details
   */
  clearAPIDetails() {
    this.apiDetails = null;
    localStorage.removeItem('apiDetails');
    console.log('API details cleared from storage');
  }

  /**
   * Check if API details are available
   * @returns {boolean} - True if API details are available
   */
  hasAPIDetails() {
    return this.apiDetails !== null;
  }

  /**
   * Get API connection details
   * @returns {Object|null} - API connection details
   */
  getAPIDetails() {
    return this.apiDetails;
  }

  /**
   * Parse QR code data
   * @param {string} qrData - QR code data
   * @returns {Object|null} - Parsed API details
   */
  parseQRCode(qrData) {
    try {
      // QR code format: {'url':'http://host:port/api/v1','username':'admin','password':'password'}
      // Convert single quotes to double quotes for valid JSON
      const jsonData = qrData.replace(/'/g, '"');
      const data = JSON.parse(jsonData);
      
      // Validate required fields
      if (!data.url || !data.username || !data.password) {
        throw new Error('Missing required fields in QR code data');
      }
      
      return {
        url: data.url,
        username: data.username,
        password: data.password
      };
    } catch (error) {
      console.error('Error parsing QR code:', error);
      return null;
    }
  }

  /**
   * Create authentication header
   * @returns {Object} - Headers object with Authorization
   */
  getAuthHeaders() {
    if (!this.apiDetails) {
      throw new Error('API details not available');
    }
    
    const { username, password } = this.apiDetails;
    const credentials = btoa(`${username}:${password}`);
    
    return {
      'Authorization': `Basic ${credentials}`
    };
  }

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise} - Fetch promise
   */
  async request(endpoint, options = {}) {
    if (!this.apiDetails) {
      throw new Error('API details not available');
    }
    
    const url = `${this.apiDetails.url}${endpoint}`;
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Handle HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      
      // Parse JSON response if applicable
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      
      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Get API information
   * @returns {Promise} - API information
   */
  async getAPIInfo() {
    return this.request('');
  }

  /**
   * Get list of all transcripts
   * @returns {Promise<Array>} - Array of transcript IDs
   */
  async getTranscripts() {
    return this.request('/transcripts');
  }

  /**
   * Get details of a specific transcript
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<Object>} - Transcript details
   */
  async getTranscript(transcriptId) {
    return this.request(`/transcripts/${transcriptId}`);
  }

  /**
   * Check status of a transcription job
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<Object>} - Status information
   */
  async getTranscriptStatus(transcriptId) {
    return this.request(`/transcripts/${transcriptId}/status`);
  }

  /**
   * Upload audio file for transcription
   * @param {Blob} audioBlob - Audio file as Blob
   * @returns {Promise<Object>} - Response with transcript ID
   */
  async uploadAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    
    return this.request('/transcripts', {
      method: 'POST',
      body: formData
    });
  }

  /**
   * Get QR code image
   * @returns {Promise<Blob>} - QR code image as Blob
   */
  async getQRCode() {
    const response = await this.request('/qrcode');
    return response.blob();
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    try {
      await this.getAPIInfo();
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  /**
   * Poll for transcript status until completed or failed
   * @param {string} transcriptId - Transcript ID
   * @param {function} onStatusChange - Callback for status updates
   * @param {number} interval - Polling interval in ms
   * @returns {Promise<Object>} - Final transcript data
   */
  async pollTranscriptStatus(transcriptId, onStatusChange, interval = 3000) {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const statusData = await this.getTranscriptStatus(transcriptId);
          
          // Call the status change callback
          if (onStatusChange) {
            onStatusChange(statusData);
          }
          
          if (statusData.status === 'completed') {
            clearInterval(intervalId);
            const transcript = await this.getTranscript(transcriptId);
            resolve(transcript);
          } else if (statusData.status === 'failed') {
            clearInterval(intervalId);
            reject(new Error('Transcription failed'));
          }
          // If status is "pending" or "processing", continue polling
        } catch (error) {
          clearInterval(intervalId);
          reject(error);
        }
      };
      
      // Check immediately and then at intervals
      checkStatus();
      const intervalId = setInterval(checkStatus, interval);
    });
  }
}

// Create and export a singleton instance
const apiClient = new APIClient();
