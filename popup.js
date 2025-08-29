// Global variables
let selectedFiles = [];
const MAX_FILES = 9;
let lastActiveTabId = null; // Track the last active tab

// Listen for tab activation events and store the last active tab
chrome.tabs.onActivated.addListener(function(activeInfo) {
  // Only store if it's not our extension tab
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (!tab.url.startsWith('chrome-extension://')) {
      lastActiveTabId = activeInfo.tabId;
      console.log('Last active tab updated:', lastActiveTabId);
    }
  });
});

// Function to get the previously active tab
async function getPreviouslyActiveTab() {
  // If we have a stored last active tab, return it
  if (lastActiveTabId) {
    try {
      const tab = await chrome.tabs.get(lastActiveTabId);
      console.log('Using stored last active tab:', tab);
      return tab;
    } catch (e) {
      console.log('Stored tab no longer exists, falling back to other methods');
    }
  }
  
  // Fallback: Get all tabs and find the first non-extension tab
  const tabs = await chrome.tabs.query({ currentWindow: true }); 
  const realTab = tabs.find(tab => !tab.url.startsWith('chrome-extension://'));
  
  console.log('Fallback tab found:', realTab);
  return realTab;
}

// Function to get a real tab (non-extension page) - KEEPING FOR COMPATIBILITY
async function getRealTab() {
  return getPreviouslyActiveTab();
}

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
  // Debug: Track popup state
  console.log('Extension popup loaded');
  
  // Prevent popup from closing unexpectedly due to file operations
  window.addEventListener('beforeunload', function(e) {
    console.log('Popup beforeunload event triggered');
  });
  
  // Track focus events to debug popup closing
  window.addEventListener('blur', function() {
    console.log('Popup lost focus');
  });
  
  window.addEventListener('focus', function() {
    console.log('Popup gained focus');
  });
  
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  const changeApiKeyButton = document.getElementById('changeApiKey');
  const promptTextarea = document.getElementById('prompt');
  const imageUploadInput = document.getElementById('imageUpload');
  const imagePreviewDiv = document.getElementById('imagePreview');
  const generateButton = document.getElementById('generate');
  const resultDiv = document.getElementById('result');
  const loadingSpinner = document.getElementById('loading');
  const closeButton = document.getElementById('closeButton');
  const fullscreenButton = document.getElementById('fullscreenButton');
  const copyButton = document.getElementById('copyButton');
  const dropArea = document.getElementById('dropArea');
  const imageCounter = document.getElementById('imageCounter');
  const imageCount = document.getElementById('imageCount');
  const clearImagesButton = document.getElementById('clearImages');
  const screenshotButton = document.getElementById('takeScreenshot');
  const toast = document.getElementById('toast');
  const csvExportButton = document.getElementById('csvExportButton');
  
  // New UI elements
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const settingsButton = document.getElementById('settingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const settingsClose = document.getElementById('settingsClose');
  const templateSelect = document.getElementById('templateSelect');
  const loadTemplateButton = document.getElementById('loadTemplate');
  const testCaseControls = document.getElementById('testCaseControls');
  const testCaseSearch = document.getElementById('testCaseSearch');
  const priorityFilter = document.getElementById('priorityFilter');
  const visibleCount = document.getElementById('visibleCount');
  const totalCount = document.getElementById('totalCount');
  const expandAllButton = document.getElementById('expandAll');
  const collapseAllButton = document.getElementById('collapseAll');
  const clearSearchButton = document.getElementById('clearSearch');
  
  // Settings elements
  const themeSelect = document.getElementById('themeSelect');
  const compactModeCheckbox = document.getElementById('compactMode');
  const saveSettingsButton = document.getElementById('saveSettings');
  const resetSettingsButton = document.getElementById('resetSettings');
  
  // Image modal elements
  const imageModal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalImageName = document.getElementById('modalImageName');
  const modalClose = document.getElementById('modalClose');

  // Detect if opened in popup or full-screen mode
  function detectMode() {
    // Check if opened in a tab (full-screen) or popup
    const isTab = window.location.protocol === 'chrome-extension:' && 
                  (window.outerWidth > 700 || window.innerWidth > 700);
    
    if (isTab) {
      document.body.classList.add('fullscreen-mode');
      document.body.classList.remove('popup-mode');
      // Hide the fullscreen button when already in fullscreen
      if (fullscreenButton) {
        fullscreenButton.style.display = 'none';
      }
      // Auto-show output section with placeholder in fullscreen
      const outputSection = document.querySelector('.output-section');
      if (outputSection) {
        outputSection.style.display = 'flex';
        // Add placeholder text if no result yet
        if (!resultDiv.textContent.trim()) {
          resultDiv.innerHTML = '<div style="color: var(--text-secondary); font-style: italic; text-align: center; padding: 60px 20px;">Generated test cases will appear here...</div>';
          resultDiv.style.display = 'block';
        }
      }
    } else {
      document.body.classList.add('popup-mode');
      document.body.classList.remove('fullscreen-mode');
      // Hide output section in popup mode until generated
      const outputSection = document.querySelector('.output-section');
      if (outputSection && !resultDiv.textContent.trim()) {
        outputSection.style.display = 'none';
      }
    }
  }
  
  // Apply smooth entrance animations for a premium feel
      setTimeout(() => {
    document.body.style.opacity = '1';
    detectMode();
    initializeApiKey();
    initializeTheme();
    initializeSettings();
    initializeTemplates();
    
    // Check for temporary state from popup mode (for file upload handling)
    chrome.storage.local.get(['temp_prompt', 'temp_files', 'trigger_file_upload'], function(result) {
      if (result.temp_prompt) {
        promptTextarea.value = result.temp_prompt;
      }
      
      if (result.temp_files && result.temp_files.length > 0) {
        selectedFiles.push(...result.temp_files);
        renderFilePreviews();
        updateFileCounter();
      }
      
      // If we should trigger file upload automatically
      if (result.trigger_file_upload) {
        setTimeout(() => {
          imageUploadInput.click();
          showToast('Ready for file upload!', 'success', 2000);
        }, 500);
      }
      
      // Clear temporary data
      chrome.storage.local.remove(['temp_prompt', 'temp_files', 'trigger_file_upload']);
    });
  }, 100);

  // API Key Management Functions
  function showApiKeyInput() {
    const container = document.querySelector('.api-key-container');
    container.style.display = 'flex';
    apiKeyStatus.style.display = 'none';
    
    // Clear the input and focus it
    apiKeyInput.value = '';
    apiKeyInput.focus();
  }

  function hideApiKeyInput() {
    const container = document.querySelector('.api-key-container');
    container.style.display = 'none';
    apiKeyStatus.style.display = 'flex';
  }

  function initializeApiKey() {
    // Check if API key exists in storage
    chrome.storage.local.get(['openai_api_key'], function(result) {
      if (result.openai_api_key && result.openai_api_key.trim()) {
        // API key exists, hide input and show status
        hideApiKeyInput();
        console.log('API key found in storage');
      } else {
        // No API key, show input
        showApiKeyInput();
        console.log('No API key found, showing input');
      }
    });
  }

  // Theme Management Functions
  function initializeTheme() {
    chrome.storage.local.get(['theme'], function(result) {
      const theme = result.theme || 'dark';
      applyTheme(theme);
    });
  }

  function applyTheme(theme) {
    const body = document.body;
    
    if (theme === 'light') {
      body.setAttribute('data-theme', 'light');
      updateThemeIcon('light');
    } else if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      updateThemeIcon('auto');
    } else {
      body.removeAttribute('data-theme');
      updateThemeIcon('dark');
    }
  }

  function updateThemeIcon(theme) {
    if (theme === 'light') {
      themeIcon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      themeToggle.classList.add('light-mode');
    } else {
      themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      themeToggle.classList.remove('light-mode');
    }
  }

  // Settings Management Functions
  function initializeSettings() {
    chrome.storage.local.get(['settings'], function(result) {
      const settings = result.settings || getDefaultSettings();
      loadSettings(settings);
    });
  }

  function getDefaultSettings() {
    return {
      theme: 'dark',
      compactMode: false,
      defaultTemplate: '',
      autoExpand: true,
      enableTooltips: true,
      exportFormat: 'csv',
      saveHistory: true,
      maxTokens: 3000,
      temperature: 0.2
    };
  }

  function loadSettings(settings) {
    if (themeSelect) themeSelect.value = settings.theme || 'dark';
    if (compactModeCheckbox) compactModeCheckbox.checked = settings.compactMode || false;
    
    // Apply compact mode
    if (settings.compactMode) {
      document.body.setAttribute('data-compact', 'true');
    } else {
      document.body.removeAttribute('data-compact');
    }
    
    applyTheme(settings.theme);
  }

  function saveSettings() {
    const settings = {
      theme: themeSelect?.value || 'dark',
      compactMode: compactModeCheckbox?.checked || false,
      defaultTemplate: document.getElementById('defaultTemplate')?.value || '',
      autoExpand: document.getElementById('autoExpand')?.checked || true,
      enableTooltips: document.getElementById('enableTooltips')?.checked || true,
      exportFormat: document.getElementById('exportFormat')?.value || 'csv',
      saveHistory: document.getElementById('saveHistory')?.checked || true,
      maxTokens: parseInt(document.getElementById('maxTokens')?.value) || 3000,
      temperature: parseFloat(document.getElementById('temperature')?.value) || 0.2
    };

    chrome.storage.local.set({ settings }, function() {
      loadSettings(settings);
      showToast('Settings saved successfully!', 'success', 2000);
      closeSettingsModal();
    });
  }

  function resetSettings() {
    const defaultSettings = getDefaultSettings();
    chrome.storage.local.set({ settings: defaultSettings }, function() {
      loadSettings(defaultSettings);
      showToast('Settings reset to defaults!', 'success', 2000);
    });
  }

  // Templates Management Functions
  function initializeTemplates() {
    templateSelect.addEventListener('change', function() {
      loadTemplateButton.disabled = !this.value;
    });

    loadTemplateButton.addEventListener('click', function() {
      const templateType = templateSelect.value;
      if (templateType) {
        const template = getTemplate(templateType);
        promptTextarea.value = template;
        showToast(`${templateType.charAt(0).toUpperCase() + templateType.slice(1)} template loaded!`, 'success', 2000);
      }
    });
  }

  function getTemplate(type) {
    const templates = {
      login: `Test the user login functionality including:
- Valid credentials login
- Invalid username/password combinations
- Account lockout after multiple failed attempts
- Password reset functionality
- Remember me option
- Social login integrations
- Security validations and error messages`,

      registration: `Test the user registration process including:
- Valid user registration with required fields
- Email verification process
- Password strength requirements
- Duplicate email/username handling
- Terms and conditions acceptance
- CAPTCHA validation
- Welcome email functionality`,

      ecommerce: `Test the e-commerce checkout process including:
- Add items to cart
- Update cart quantities
- Apply discount codes/coupons
- Select shipping options
- Enter billing/shipping information
- Payment method selection
- Order confirmation and receipt
- Inventory management during checkout`,

      form: `Test form validation including:
- Required field validations
- Email format validation
- Phone number format validation
- Date and numeric field validations
- File upload restrictions
- Form submission with valid/invalid data
- Error message display and clearing
- Form autosave functionality`,

      api: `Test API functionality including:
- GET requests with valid/invalid parameters
- POST requests with valid/invalid payloads
- PUT/PATCH requests for data updates
- DELETE requests and data removal
- Authentication token validation
- Rate limiting and throttling
- Error response handling
- Data format validation (JSON/XML)`,

      mobile: `Test mobile application functionality including:
- Touch gestures and interactions
- Screen orientation changes
- Network connectivity scenarios
- Push notification handling
- App lifecycle (background/foreground)
- Device-specific features (camera, GPS)
- Performance on different devices
- Offline functionality`,

      dashboard: `Test dashboard features including:
- Data loading and display
- Filter and search functionality
- Chart and graph interactions
- Real-time data updates
- Export functionality
- User preference settings
- Responsive layout on different screens
- Performance with large datasets`,

      search: `Test search functionality including:
- Basic keyword search
- Advanced search with filters
- Search suggestions and autocomplete
- Empty search result handling
- Search result sorting options
- Pagination of search results
- Search history and saved searches
- Performance with large datasets`
    };

    return templates[type] || '';
  }

  // Test Case Controls Functions
  function initializeTestCaseControls() {
    // Search functionality
    testCaseSearch.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      filterTestCases();
      
      clearSearchButton.style.display = searchTerm ? 'block' : 'none';
    });

    // Priority filter
    priorityFilter.addEventListener('change', filterTestCases);

    // Clear search
    clearSearchButton.addEventListener('click', function() {
      testCaseSearch.value = '';
      priorityFilter.value = '';
      filterTestCases();
      this.style.display = 'none';
    });

    // Expand/Collapse all
    expandAllButton.addEventListener('click', function() {
      const containers = document.querySelectorAll('.test-case-container');
      containers.forEach(container => {
        container.classList.remove('collapsed');
      });
      showToast('All test cases expanded', 'success', 1500);
    });

    collapseAllButton.addEventListener('click', function() {
      const containers = document.querySelectorAll('.test-case-container');
      containers.forEach(container => {
        container.classList.add('collapsed');
      });
      showToast('All test cases collapsed', 'success', 1500);
    });
  }

  function filterTestCases() {
    const searchTerm = testCaseSearch?.value?.toLowerCase() || '';
    const priorityFilter = document.getElementById('priorityFilter')?.value || '';
    const containers = document.querySelectorAll('.test-case-container');
    
    let visibleTotal = 0;

    containers.forEach(container => {
      const title = container.querySelector('.test-case-title')?.textContent?.toLowerCase() || '';
      const content = container.textContent?.toLowerCase() || '';
      const priority = container.querySelector('.test-case-priority')?.textContent?.toLowerCase() || '';

      const matchesSearch = !searchTerm || title.includes(searchTerm) || content.includes(searchTerm);
      const matchesPriority = !priorityFilter || priority.includes(priorityFilter);

      if (matchesSearch && matchesPriority) {
        container.style.display = 'block';
        visibleTotal++;
      } else {
        container.style.display = 'none';
      }
    });

    updateTestCaseStats(visibleTotal, containers.length);
  }

  function updateTestCaseStats(visible, total) {
    if (visibleCount) visibleCount.textContent = visible;
    if (totalCount) totalCount.textContent = total;
  }

  // Settings Modal Functions
  function openSettingsModal() {
    settingsModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeSettingsModal() {
    settingsModal.classList.remove('show');
    document.body.style.overflow = '';
  }

  // Event Listeners for new UI elements
  themeToggle.addEventListener('click', function() {
    chrome.storage.local.get(['settings'], function(result) {
      const settings = result.settings || getDefaultSettings();
      const currentTheme = settings.theme || 'dark';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      settings.theme = nextTheme;
      chrome.storage.local.set({ settings }, function() {
        applyTheme(nextTheme);
        showToast(`Switched to ${nextTheme} theme`, 'success', 1500);
      });
    });
  });

  settingsButton.addEventListener('click', openSettingsModal);
  settingsClose.addEventListener('click', closeSettingsModal);
  saveSettingsButton.addEventListener('click', saveSettings);
  resetSettingsButton.addEventListener('click', resetSettings);

  // Close settings modal when clicking outside
  settingsModal.addEventListener('click', function(e) {
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });

  // Close button functionality
  closeButton.addEventListener('click', function() {
    // Smooth fade out animation before closing
    document.body.style.opacity = '0';
    setTimeout(() => {
      window.close();
    }, 300);
  });

  // Full-screen button functionality
  fullscreenButton.addEventListener('click', function() {
    // Open the extension in a new tab for full-screen experience
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html')
    });
    // Close the popup
    window.close();
  });

  // Screenshot button functionality
  screenshotButton.addEventListener('click', captureScreenshot);

  // Change API Key button functionality
  changeApiKeyButton.addEventListener('click', function() {
    showApiKeyInput();
    showToast('Enter your new API key', 'success', 2000);
  });

  // Toast notification function
  function showToast(message, type = 'success', duration = 3000) {
    toast.textContent = message;
    toast.className = 'toast';
    
    if (type === 'success') {
      toast.classList.add('toast-success');
    } else if (type === 'error') {
      toast.classList.add('toast-error');
    }
    
    // Show the toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Hide the toast after duration
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // Make showToast globally accessible
  window.showToastGlobal = showToast;

  // Function to capture screenshot
  async function captureScreenshot() {
    try {
      // Get all windows
      const windows = await chrome.windows.getAll({ populate: true });
      
      // Find the window that's not our popup (extension) window
      const currentWindowId = await getCurrentWindowId();
      const mainWindow = windows.find(w => w.id !== currentWindowId && w.type === 'normal');
      
      if (!mainWindow) {
        showToast('Could not find main browser window', 'error');
        return;
      }
      
      // Get the active tab in the main window
      const activeTab = mainWindow.tabs.find(tab => tab.active);
      
      if (!activeTab) {
        showToast('No active tab found in the main window', 'error');
        return;
      }
      
      try {
        // Capture visible area of the active tab in the main window
        const screenshotUrl = await chrome.tabs.captureVisibleTab(mainWindow.id, { format: 'png' });
        
        // Create a date-based filename
        const dateString = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `screenshot-${dateString}.png`;
        
        // Create an image object from the data URL
        const imageData = {
          name: filename,
          data: screenshotUrl,
          isScreenshot: true
        };
        
        // Add screenshot to selected files and update UI
        if (selectedFiles.length < MAX_FILES) {
          selectedFiles.push(imageData);
          renderFilePreviews();
          updateFileCounter();
          showToast('Screenshot captured!');
        } else {
          showToast(`Maximum file limit reached (${MAX_FILES} files)`, 'error');
        }
      } catch (error) {
        console.error('Error capturing screenshot:', error);
        showToast('Error capturing screenshot: ' + error.message, 'error');
      }
    } catch (error) {
      console.error('Error in screenshot capture:', error);
      showToast('Error capturing screenshot: ' + error.message, 'error');
    }
  }

  // Helper function to get the current window ID (the extension popup window)
  async function getCurrentWindowId() {
    return new Promise((resolve) => {
      chrome.windows.getCurrent(function(window) {
        resolve(window.id);
      });
    });
  }

  // Copy button functionality with elegant animation
  if (copyButton) {
    copyButton.addEventListener('click', function() {
      // Copy all test cases as formatted text
      const textToCopy = resultDiv.textContent;
      
      navigator.clipboard.writeText(textToCopy).then(() => {
        // Show success feedback with animation
        copyButton.classList.add('copy-success');
        copyButton.innerHTML = '✓';
        setTimeout(() => {
          copyButton.innerHTML = '📋';
          copyButton.classList.remove('copy-success');
        }, 1500);
        
        showToast('All test cases copied to clipboard!', 'success', 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard', 'error');
      });
    });
  }

  // CSV Export button functionality
  if (csvExportButton) {
    csvExportButton.addEventListener('click', handleCSVExport);
  }



  // Clear all images button with animation
  if (clearImagesButton) {
    clearImagesButton.addEventListener('click', function() {
      clearImagesButton.style.transform = 'translateX(5px)';
      setTimeout(() => {
        clearImagesButton.style.transform = 'translateX(0)';
      }, 300);
      
              // Fade out files before removing them
        const previews = imagePreviewDiv.querySelectorAll('.file-preview-item');
      if (previews.length > 0) {
        previews.forEach(preview => {
          preview.style.opacity = '0';
          preview.style.transform = 'scale(0.8)';
        });
        
        setTimeout(() => {
          selectedFiles = [];
          renderFilePreviews();
          updateFileCounter();
          clearImagesButton.style.display = 'none';
        }, 300);
      } else {
        selectedFiles = [];
        renderFilePreviews();
        updateFileCounter();
        clearImagesButton.style.display = 'none';
      }
    });
  }

  // Save API key to storage
  saveApiKeyButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ 'openai_api_key': apiKey }, function() {
        // Show visual feedback with elegant animation
        saveApiKeyButton.textContent = 'Saved';
        saveApiKeyButton.style.backgroundColor = 'var(--primary)';
        saveApiKeyButton.style.color = 'white';
        saveApiKeyButton.style.transform = 'translateY(-3px)';
        
        setTimeout(() => {
          saveApiKeyButton.textContent = 'Save';
          saveApiKeyButton.style.backgroundColor = 'rgba(159, 122, 234, 0.15)';
          saveApiKeyButton.style.color = 'var(--primary-light)';
          saveApiKeyButton.style.transform = 'translateY(0)';
          
          // Hide the API key input and show the status
          hideApiKeyInput();
          showToast('API key saved successfully!', 'success', 3000);
        }, 1500);
      });
    } else {
      apiKeyInput.classList.add('shake');
      setTimeout(() => {
        apiKeyInput.classList.remove('shake');
      }, 600);
      showToast('Please enter a valid API key.', 'error');
    }
  });

  // Update file counter with animation
  function updateFileCounter() {
    if (selectedFiles.length > 0) {
      imageCounter.style.display = 'flex';
      imageCount.textContent = selectedFiles.length;
      clearImagesButton.style.display = 'inline-block';
      
      // Animate counter
      imageCounter.classList.add('pulse');
      setTimeout(() => {
        imageCounter.classList.remove('pulse');
      }, 500);
    } else {
      imageCounter.style.display = 'none';
      clearImagesButton.style.display = 'none';
    }
  }

  // Drag and drop event handlers
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    dropArea.classList.add('drag-over');
  }

  function unhighlight() {
    dropArea.classList.remove('drag-over');
  }

  dropArea.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const dt = e.dataTransfer;
      const files = dt.files;
      
      if (files && files.length > 0) {
        handleFiles(files);
      }
    } catch (error) {
      console.error('Error in handleDrop:', error);
      showToast('Error handling dropped files. Please try again.', 'error');
    }
  }

  function handleFiles(files) {
    console.log('handleFiles called with', files.length, 'files');
    try {
      if (!files || files.length === 0) {
        console.log('No files provided to handleFiles');
        return;
      }

      if (selectedFiles.length + files.length > MAX_FILES) {
        // Show elegant error feedback
        dropArea.classList.add('shake');
        setTimeout(() => {
          dropArea.classList.remove('shake');
        }, 600);
        
        showToast(`You can only upload up to ${MAX_FILES} files in total`, 'error');
        return;
      }

      [...files].forEach((file, index) => {
        try {
          // Accept images, PDFs, and videos
          const allowedTypes = [
            'image/', 
            'application/pdf', 
            'video/mp4', 
            'video/mov', 
            'video/avi', 
            'video/webm', 
            'video/quicktime'
          ];
          
          const isAllowed = allowedTypes.some(type => file.type.startsWith(type) || file.type === type);
          
          if (!isAllowed) {
            showToast(`Unsupported file type: ${file.type}. Only images, PDFs, and videos are allowed.`, 'error');
            return;
          }
          
          // Check file size (50MB limit)
          const maxSize = 50 * 1024 * 1024; // 50MB
          if (file.size > maxSize) {
            showToast(`File "${file.name}" is too large. Maximum size is 50MB.`, 'error');
            return;
          }
          
          const reader = new FileReader();
          
          reader.onload = async function(e) {
            console.log('File loaded successfully:', file.name);
            try {
              const fileData = {
                name: file.name,
                data: e.target.result,
                file: file,
                type: file.type,
                size: file.size,
                isImage: file.type.startsWith('image/'),
                isPdf: file.type === 'application/pdf',
                isVideo: file.type.startsWith('video/'),
                extractedContent: null,
                extractedFrames: null
              };
              
              // Process different file types for content extraction
              if (fileData.isPdf) {
                try {
                  showToast(`Extracting text from "${file.name}"...`, 'success', 2000);
                  fileData.extractedContent = await extractPdfText(e.target.result);
                  console.log('PDF text extracted:', fileData.extractedContent?.substring(0, 100) + '...');
                } catch (pdfError) {
                  console.error('PDF extraction failed:', pdfError);
                  fileData.extractedContent = `Failed to extract text from PDF: ${file.name}`;
                }
              } else if (fileData.isVideo) {
                try {
                  showToast(`Extracting frames from "${file.name}"...`, 'success', 2000);
                  fileData.extractedFrames = await extractVideoFrames(e.target.result, file.name);
                  console.log('Video frames extracted:', fileData.extractedFrames?.length, 'frames');
                } catch (videoError) {
                  console.error('Video extraction failed:', videoError);
                  fileData.extractedFrames = null;
                }
              }
              
              selectedFiles.push(fileData);
              
              // Use setTimeout to ensure DOM updates don't interfere with popup
              setTimeout(() => {
                renderFilePreviews();
                updateFileCounter();
                // Show success feedback
                const contentInfo = fileData.isPdf && fileData.extractedContent ? ' (text extracted)' : 
                                   fileData.isVideo && fileData.extractedFrames ? ` (${fileData.extractedFrames.length} frames extracted)` : '';
                showToast(`File "${file.name}" uploaded successfully!${contentInfo}`, 'success', 2000);
                console.log('File processing completed for:', file.name);
              }, 10);
              
            } catch (error) {
              console.error('Error processing file data:', error);
              showToast(`Error processing file "${file.name}". Please try again.`, 'error');
            }
          };
          
          reader.onerror = function(error) {
            console.error('FileReader error:', error);
            showToast(`Error reading file "${file.name}". Please try again.`, 'error');
          };
          
          // Add a small delay to prevent overwhelming the browser and maintain popup focus
          setTimeout(() => {
            console.log('Starting to read file:', file.name);
            try {
              // Maintain popup focus during file reading
              window.focus();
              reader.readAsDataURL(file);
            } catch (error) {
              console.error('Error starting file read:', error);
              showToast(`Error reading file "${file.name}". Please try again.`, 'error');
            }
          }, index * 50); // Increased delay to prevent rapid operations
          
        } catch (error) {
          console.error('Error handling individual file:', error);
          showToast(`Error uploading file "${file.name}". Please try again.`, 'error');
        }
      });
    } catch (error) {
      console.error('Error in handleFiles:', error);
      showToast('Error uploading files. Please try again.', 'error');
    }
  }

  // Click to upload functionality with ripple effect
  dropArea.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Create ripple effect
      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      this.appendChild(ripple);
      
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      
      const x = e.clientX - rect.left - size/2;
      const y = e.clientY - rect.top - size/2;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
      
      // Check if we're in popup mode
      if (!document.body.classList.contains('fullscreen-mode')) {
        // If in popup mode, open in fullscreen first to prevent popup closing
        showToast('Opening in fullscreen for file upload...', 'success', 2000);
        
        // Save current state before opening fullscreen
        const currentPrompt = promptTextarea.value;
        chrome.storage.local.set({ 
          'temp_prompt': currentPrompt,
          'temp_files': selectedFiles,
          'trigger_file_upload': true 
        }, function() {
          // Open in fullscreen mode
          chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
          });
          
          // Close the popup
          if (window.close) {
            window.close();
          }
        });
        return;
      }
      
      // Use a small timeout to ensure the click doesn't interfere with popup
      setTimeout(() => {
        imageUploadInput.click();
      }, 50);
    } catch (error) {
      console.error('Error in drop area click:', error);
      // Fallback to direct click if ripple effect fails
      imageUploadInput.click();
    }
  });

  // Handle image selection through input
  imageUploadInput.addEventListener('change', function(e) {
    console.log('File input change event triggered');
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (e.target.files && e.target.files.length > 0) {
        console.log('Files selected:', e.target.files.length);
        handleFiles(e.target.files);
        
        // Ensure window stays focused after file selection
        if (window.focus) {
          setTimeout(() => {
            window.focus();
          }, 100);
        }
      }
    } catch (error) {
      console.error('Error handling file upload:', error);
      showToast('Error uploading files. Please try again.', 'error');
    }
    
    // Reset the input to allow selecting the same file again
    e.target.value = '';
  });

  // Generate test case button click with elegant loading state
  generateButton.addEventListener('click', function() {
    const prompt = promptTextarea.value.trim();
    
    if (!prompt) {
      promptTextarea.classList.add('shake');
      setTimeout(() => {
        promptTextarea.classList.remove('shake');
      }, 600);
      showToast('Please enter a test case prompt', 'error');
      return;
    }

    // Get API key from storage
    chrome.storage.local.get(['openai_api_key'], function(result) {
      const apiKey = result.openai_api_key;
      
      if (!apiKey || !apiKey.trim()) {
        // No API key found, show the input form
        showApiKeyInput();
        showToast('Please enter your OpenAI API key first', 'error');
        return;
      }

      generateTestCase(apiKey, prompt, selectedFiles);
    });
  });

  // Image Modal functionality
  function openImageModal(src, name) {
    modalImage.src = src;
    modalImageName.textContent = name;
    imageModal.classList.add('show');
    
    // Prevent scrolling the body when modal is open
    document.body.style.overflow = 'hidden';
  }
  
  function closeImageModal() {
    imageModal.classList.remove('show');
    
    // Re-enable scrolling
    document.body.style.overflow = '';
    
    // Clear the src after animation completes to free up resources
    setTimeout(() => {
      modalImage.src = '';
    }, 300);
  }
  
  // Close modal when clicking the close button
  modalClose.addEventListener('click', closeImageModal);
  
  // Close modal when clicking outside the image
  imageModal.addEventListener('click', function(e) {
    if (e.target === imageModal) {
      closeImageModal();
    }
  });
  
  // Close modal with ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && imageModal.classList.contains('show')) {
      closeImageModal();
    }
  });

  // Render file previews with staggered animation
  function renderFilePreviews() {
    imagePreviewDiv.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'file-preview-item';
      previewItem.style.opacity = '0';
      previewItem.style.transform = 'scale(0.9)';
      
      // Create different previews based on file type
      if (file.isImage) {
        const imgElement = document.createElement('img');
        imgElement.src = file.data;
        imgElement.style.width = '100%';
        imgElement.style.height = '100%';
        imgElement.style.objectFit = 'cover';
        previewItem.appendChild(imgElement);
      } else if (file.isPdf) {
        const pdfIcon = document.createElement('div');
        pdfIcon.className = 'file-icon pdf-icon';
        const hasText = file.extractedContent && file.extractedContent.length > 0;
        const statusColor = hasText ? '#22c55e' : '#e74c3c';
        const statusText = hasText ? 'TEXT EXTRACTED' : 'PDF';
        
        pdfIcon.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 24 24" fill="${statusColor}">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
          <span>${statusText}</span>
          ${hasText ? `<div style="font-size: 10px; color: #22c55e; margin-top: 2px;">✓ Content ready</div>` : ''}
        `;
        previewItem.appendChild(pdfIcon);
      } else if (file.isVideo) {
        const videoIcon = document.createElement('div');
        videoIcon.className = 'file-icon video-icon';
        const hasFrames = file.extractedFrames && file.extractedFrames.length > 0;
        const statusColor = hasFrames ? '#22c55e' : '#9b59b6';
        const statusText = hasFrames ? `${file.extractedFrames.length} FRAMES` : 'VIDEO';
        
        videoIcon.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 24 24" fill="${statusColor}">
            <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
          </svg>
          <span>${statusText}</span>
          ${hasFrames ? `<div style="font-size: 10px; color: #22c55e; margin-top: 2px;">✓ Frames ready</div>` : ''}
        `;
        previewItem.appendChild(videoIcon);
      }
      
      // Add file name overlay
      const nameOverlay = document.createElement('div');
      nameOverlay.className = 'file-name-overlay';
      nameOverlay.textContent = file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name;
      previewItem.appendChild(nameOverlay);
      
      // Add caption for screenshots
      if (file.isScreenshot) {
        const badgeElement = document.createElement('div');
        badgeElement.className = 'screenshot-badge';
        badgeElement.textContent = 'Screenshot';
        previewItem.appendChild(badgeElement);
      }
      
      const removeButton = document.createElement('div');
      removeButton.className = 'remove-file';
      removeButton.innerHTML = '×';
      removeButton.onclick = function(e) {
        e.stopPropagation(); // Prevent event bubbling
        
        // Fade out animation before removing
        previewItem.style.opacity = '0';
        previewItem.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
          selectedFiles.splice(index, 1);
          renderFilePreviews();
          updateFileCounter();
        }, 300);
      };
      
      // Add click event to preview file in modal (only for images)
      if (file.isImage) {
        previewItem.addEventListener('click', function() {
          openImageModal(file.data, file.name);
        });
        previewItem.style.cursor = 'pointer';
      }
      
      previewItem.appendChild(removeButton);
      imagePreviewDiv.appendChild(previewItem);
      
      // Stagger the fade-in animation for each preview
      setTimeout(() => {
        previewItem.style.opacity = '1';
        previewItem.style.transform = 'scale(1)';
      }, 50 * index);
    });
  }

  // Process the response to clean up any special characters
  function cleanResponseText(text) {
    // Replace any asterisks in parentheses (*) with nothing
    return text.replace(/\(\*\)/g, '');
  }

  // Format plain text response with copy buttons
  function formatPlainTextWithCopyButtons(content) {
    if (!content || content.trim() === '') {
      return '<p>No test cases generated.</p>';
    }
    
    console.log('\n=== RAW CONTENT FROM OPENAI ===');
    console.log(content);
    console.log('=== END RAW CONTENT ===\n');
    
    // Split content by "TEST CASE TITLE:" and rejoin the delimiter
    let testCaseSections = content.split('TEST CASE TITLE:').filter(section => section.trim());
    
    console.log('Split sections:', testCaseSections);
    
    // Add back the "TEST CASE TITLE:" to each section (except the first which might be empty)
    testCaseSections = testCaseSections.map((section, index) => {
      if (index === 0 && section.trim() === '') {
        return ''; // Skip empty first section
      }
      return 'TEST CASE TITLE:' + section;
    }).filter(section => section.trim());
    
    console.log('Final sections after processing:', testCaseSections);
    
    // If no sections found with the standard approach, try alternative parsing
    if (testCaseSections.length === 0) {
      console.log('No sections found with TEST CASE TITLE, trying alternative parsing...');
      
      // Try splitting by common patterns
      const alternativePatterns = [
        /TEST CASE \d+/gi,
        /Test Case \d+/gi,
        /TITLE:/gi,
        /Title:/gi,
        /^[A-Z][^:]*$/gm // Lines that start with capital and don't contain colons
      ];
      
      for (const pattern of alternativePatterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          console.log('Found alternative pattern:', pattern, 'matches:', matches);
          // Split by these patterns and see if we can extract sections
          const sections = content.split(pattern).filter(s => s.trim());
          if (sections.length > 0) {
            testCaseSections = sections.map((section, index) => {
              if (matches[index]) {
                return matches[index] + section;
              }
              return section;
            }).filter(s => s.trim());
            break;
          }
        }
      }
    }
    
    if (testCaseSections.length === 0) {
      return '<p>No test cases found in response.</p>';
    }
    
    let html = `
      <div class="test-suite-header">
        <h2>Generated Test Cases</h2>
        <p class="suite-description">Test cases generated from provided input</p>
        <div class="suite-summary">
          <span class="test-count">Total Test Cases: ${testCaseSections.length}</span>
        </div>
      </div>
    `;
    
    testCaseSections.forEach((section, index) => {
      const lines = section.trim().split('\n');
      
      let title = '';
      let description = '';
      let preConditions = [];
      let steps = [];
      let expectedResults = '';
      let priority = '';
      let regressionCandidate = '';
      
      let currentSection = '';
      
      console.log(`\n=== PARSING TEST CASE ${index + 1} ===`);
      console.log('Raw section:', section);
      console.log('Lines:', lines);
      console.log('First few lines:');
      lines.slice(0, 5).forEach((line, i) => {
        console.log(`  ${i}: "${line}"`);
      });
      
      for (let line of lines) {
        line = line.trim();
        
        if (!line) continue; // Skip empty lines
        
        if (line.startsWith('TEST CASE TITLE:') || line.startsWith('**TEST CASE TITLE:**') || 
            line.startsWith('Test Case Title:') || line.startsWith('**Test Case Title:**') ||
            line.startsWith('TITLE:') || line.startsWith('**TITLE:**') ||
            line.startsWith('Title:') || line.startsWith('**Title:**')) {
          title = line.replace(/\*\*TEST CASE TITLE:\*\*|TEST CASE TITLE:|Test Case Title:|\*\*Test Case Title:\*\*|TITLE:|\*\*TITLE:\*\*|Title:|\*\*Title:\*\*/, '').trim();
          console.log('Found title:', title);
          currentSection = 'title';
        } else if (line.startsWith('DESCRIPTION:') || line.startsWith('**DESCRIPTION:**')) {
          description = line.replace(/\*\*DESCRIPTION:\*\*|DESCRIPTION:/, '').trim();
          currentSection = 'description';
        } else if (line.startsWith('PRE-CONDITIONS:') || line.startsWith('**PRE-CONDITIONS:**')) {
          currentSection = 'preConditions';
        } else if (line.startsWith('STEPS:') || line.startsWith('**STEPS:**')) {
          currentSection = 'steps';
        } else if (line.startsWith('EXPECTED RESULTS:') || line.startsWith('**EXPECTED RESULTS:**')) {
          expectedResults = line.replace(/\*\*EXPECTED RESULTS:\*\*|EXPECTED RESULTS:/, '').trim();
          currentSection = 'expectedResults';
        } else if (line.startsWith('PRIORITY:') || line.startsWith('**PRIORITY:**')) {
          priority = line.replace(/\*\*PRIORITY:\*\*|PRIORITY:/, '').trim();
          currentSection = 'priority';
        } else if (line.startsWith('REGRESSION CANDIDATE:') || line.startsWith('**REGRESSION CANDIDATE:**')) {
          regressionCandidate = line.replace(/\*\*REGRESSION CANDIDATE:\*\*|REGRESSION CANDIDATE:/, '').trim();
          currentSection = 'regressionCandidate';
        } else {
          // Handle content under sections
          if (currentSection === 'title') {
            if (title === '') {
              title = line;
              console.log('Found title on next line:', title);
            } else {
              title += ' ' + line;
            }
          } else if (currentSection === 'description') {
            if (description === '') {
              description = line;
            } else {
              description += ' ' + line;
            }
          } else if (currentSection === 'preConditions') {
            if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
              preConditions.push(line.replace(/^[-•*]\s*/, ''));
            } else {
              // Handle pre-conditions that don't start with bullets
              preConditions.push(line);
            }
          } else if (currentSection === 'steps') {
            if (/^\d+\./.test(line)) {
              steps.push(line.replace(/^\d+\.\s*/, ''));
            } else if (steps.length > 0) {
              // Continue previous step if it's a continuation line
              steps[steps.length - 1] += ' ' + line;
            }
          } else if (currentSection === 'expectedResults') {
            if (expectedResults === '') {
              expectedResults = line;
            } else {
              expectedResults += ' ' + line;
            }
          } else if (currentSection === 'regressionCandidate') {
            if (regressionCandidate === '') {
              regressionCandidate = line;
            } else {
              regressionCandidate += ' ' + line;
            }
          }
        }
      }
      
      // Default values - try to extract title from first meaningful line if not found
      if (!title) {
        // Look for the first non-empty line that could be a title
        const firstMeaningfulLine = lines.find(line => 
          line.trim() && 
          !line.startsWith('TEST CASE TITLE:') && 
          !line.startsWith('DESCRIPTION:') &&
          !line.startsWith('PRE-CONDITIONS:') &&
          !line.startsWith('STEPS:') &&
          !line.startsWith('EXPECTED RESULTS:') &&
          !line.startsWith('PRIORITY:') &&
          !line.startsWith('REGRESSION CANDIDATE:')
        );
        
        if (firstMeaningfulLine && firstMeaningfulLine.trim().length > 0) {
          title = firstMeaningfulLine.trim();
          console.log('Extracted title from first meaningful line:', title);
        } else {
          title = `Test Case ${index + 1}`;
        }
      }
      
      if (!description) description = 'No description provided';
      if (preConditions.length === 0) preConditions = ['No pre-conditions specified'];
      if (steps.length === 0) steps = ['No steps specified'];
      if (!expectedResults) expectedResults = 'No expected results specified';
      if (!priority) priority = 'Medium';
      if (!regressionCandidate) regressionCandidate = 'Not specified';
      
      console.log(`Final parsed data for test case ${index + 1}:`, {
        title, description, preConditions, steps, expectedResults, priority, regressionCandidate
      });
      
      // Debug title specifically
      console.log('Title that will be displayed:', title);
      console.log('Title HTML escaped:', escapeHtml(title));
      
      const priorityClass = priority.toLowerCase();
      
      html += `
        <div class="test-case-container">
          <div class="test-case-header">
            <div class="test-case-meta">
              <span class="test-case-id">TC_${String(index + 1).padStart(3, '0')}</span>
              <span class="test-case-priority ${priorityClass}">${priority}</span>
            </div>
            <div class="title-row">
              <button class="collapse-toggle" onclick="window.toggleTestCase(this)" title="Toggle collapse">▼</button>
              <h3 class="test-case-title">${title}</h3>
              <button class="section-copy-btn" onclick="window.handleSectionCopy(this, '${escapeHtml(title)}', 'Title')">📋</button>
            </div>
          </div>
          
          <div class="test-case-content">
            <div class="test-section">
              <div class="section-header">
                <h4>Description</h4>
                <button class="section-copy-btn" onclick="window.handleSectionCopy(this, '${escapeHtml(description)}', 'Description')">📋</button>
              </div>
              <p class="section-content">${description}</p>
            </div>
            
            <div class="test-section">
              <div class="section-header">
                <h4>Pre-conditions</h4>
                <button class="section-copy-btn" onclick="window.handleSectionCopy(this, '${escapeHtml(preConditions.join('\\n'))}', 'Pre-conditions')">📋</button>
              </div>
              <ul class="section-content">
                ${preConditions.map(condition => `<li>${condition}</li>`).join('')}
              </ul>
            </div>
            
            <div class="test-section">
              <div class="section-header">
                <h4>Steps</h4>
                <button class="section-copy-btn" onclick="window.handleSectionCopy(this, '${escapeHtml(steps.map((step, i) => `${i + 1}. ${step}`).join('\\n'))}', 'Steps')">📋</button>
              </div>
              <ol class="section-content">
                ${steps.map(step => `<li>${step}</li>`).join('')}
              </ol>
            </div>
            
            <div class="test-section">
              <div class="section-header">
                <h4>Expected Results</h4>
                <button class="section-copy-btn" onclick="window.handleSectionCopy(this, '${escapeHtml(expectedResults)}', 'Expected Results')">📋</button>
              </div>
              <p class="section-content">${expectedResults}</p>
            </div>
            
            <div class="test-section">
              <div class="section-header">
                <h4>Priority & Regression Info</h4>
                <button class="section-copy-btn" onclick="window.handleSectionCopy(this, 'Priority: ${escapeHtml(priority)}\\nRegression Candidate: ${escapeHtml(regressionCandidate)}', 'Priority & Regression Info')">📋</button>
              </div>
              <div class="section-content">
                <p><strong>Priority:</strong> ${priority}</p>
                <p><strong>Regression Candidate:</strong> ${regressionCandidate}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    return html;
  }

  // Helper function to escape HTML for safe injection
  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  // Function to extract test case data from DOM and convert to CSV
  function extractTestCasesForCSV() {
    const testCaseContainers = document.querySelectorAll('.test-case-container');
    const testCases = [];
    
    testCaseContainers.forEach((container, index) => {
      const testCaseId = `TC_${String(index + 1).padStart(3, '0')}`;
      
      // Extract title
      const titleElement = container.querySelector('.test-case-title');
      const title = titleElement ? titleElement.textContent.trim() : '';
      
      // Extract priority
      const priorityElement = container.querySelector('.test-case-priority');
      const priority = priorityElement ? priorityElement.textContent.trim() : 'Medium';
      
      // Extract description
      const descriptionElement = container.querySelector('.test-section:nth-child(1) .section-content');
      const description = descriptionElement ? descriptionElement.textContent.trim() : '';
      
      // Extract pre-conditions
      const preConditionsElement = container.querySelector('.test-section:nth-child(2) .section-content');
      const preConditions = preConditionsElement ? 
        Array.from(preConditionsElement.querySelectorAll('li')).map(li => li.textContent.trim()).join('; ') : '';
      
      // Extract steps
      const stepsElement = container.querySelector('.test-section:nth-child(3) .section-content');
      const steps = stepsElement ? 
        Array.from(stepsElement.querySelectorAll('li')).map((li, idx) => `${idx + 1}. ${li.textContent.trim()}`).join('; ') : '';
      
      // Extract expected results
      const expectedResultsElement = container.querySelector('.test-section:nth-child(4) .section-content');
      const expectedResults = expectedResultsElement ? expectedResultsElement.textContent.trim() : '';
      
      // Extract regression candidate info (if present)
      const regressionCandidateElement = container.querySelector('.test-section:nth-child(5) .section-content');
      const regressionCandidate = regressionCandidateElement ? regressionCandidateElement.textContent.trim() : '';
      
      // Determine if it's a regression candidate
      const isRegressionCandidate = regressionCandidate.toLowerCase().includes('yes') || 
                                  priority.toLowerCase() === 'critical' || 
                                  priority.toLowerCase() === 'high';
      
      const testCase = {
        'Existing Testcase ID': testCaseId,
        'Summary': title,
        'Priority': priority,
        'Description': description,
        'Tags': isRegressionCandidate ? 'Regression_candidate' : '',
        'Precondition': preConditions,
        'Test Steps': steps,
        'Expected Result': expectedResults
      };
      
      testCases.push(testCase);
    });
    
    return testCases;
  }

  // Function to convert test cases to CSV format
  function convertToCSV(testCases) {
    if (!testCases || testCases.length === 0) {
      return '';
    }
    
    const headers = Object.keys(testCases[0]);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    testCases.forEach(testCase => {
      const values = headers.map(header => {
        const value = testCase[header] || '';
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const escaped = value.replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') ? `"${escaped}"` : escaped;
      });
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
  }

  // Function to download CSV file
  function downloadCSV(csvContent, filename = 'test_cases.csv') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // Function to handle CSV export
  function handleCSVExport() {
    try {
      const testCases = extractTestCasesForCSV();
      
      if (testCases.length === 0) {
        showToast('No test cases found to export', 'error', 3000);
        return;
      }
      
      const csvContent = convertToCSV(testCases);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `test_cases_${timestamp}.csv`;
      
      downloadCSV(csvContent, filename);
      
      // Show success feedback
      showToast(`Exported ${testCases.length} test cases to ${filename}`, 'success', 3000);
      
      // Visual feedback on button
      const originalText = csvExportButton.textContent;
      csvExportButton.textContent = '✓ Exported';
      csvExportButton.classList.add('export-success');
      
      setTimeout(() => {
        csvExportButton.textContent = originalText;
        csvExportButton.classList.remove('export-success');
      }, 2000);
      
    } catch (error) {
      console.error('CSV export error:', error);
      showToast('Failed to export CSV', 'error', 3000);
    }
  }

  // Handle section copy functionality - Make it global
  window.handleSectionCopy = function(button, content, sectionName) {
    // Unescape the content
    const textToCopy = content.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
    
    // Copy to clipboard
    navigator.clipboard.writeText(textToCopy).then(() => {
      // Show success feedback
      showToast(`${sectionName} copied to clipboard!`, 'success', 2000);
      
      // Visual feedback on button
      const originalEmoji = button.textContent;
      button.textContent = '✓';
      button.style.backgroundColor = '#22c55e';
      button.style.color = 'white';
      
      setTimeout(() => {
        button.textContent = originalEmoji;
        button.style.backgroundColor = '';
        button.style.color = '';
      }, 1000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      showToast(`Failed to copy ${sectionName}`, 'error', 2000);
    });
  }

  // Handle test case collapse toggle - Make it global
  window.toggleTestCase = function(button) {
    const container = button.closest('.test-case-container');
    const isCollapsed = container.classList.contains('collapsed');
    
    if (isCollapsed) {
      container.classList.remove('collapsed');
      button.textContent = '▼';
      button.style.transform = 'rotate(0deg)';
    } else {
      container.classList.add('collapsed');
      button.textContent = '▶';
      button.style.transform = 'rotate(-90deg)';
    }
  }

  // PDF Text Extraction Function
  async function extractPdfText(dataUrl) {
    try {
      // Load PDF.js if not already loaded
      if (typeof pdfjsLib === 'undefined') {
        await loadPdfJs();
      }
      
      // Convert data URL to array buffer
      const response = await fetch(dataUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log('PDF loaded, pages:', pdf.numPages);
      
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
      }
      
      if (pdf.numPages > 10) {
        fullText += `\n... (PDF has ${pdf.numPages} total pages, showing first 10)`;
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract PDF text: ${error.message}`);
    }
  }

  // Video Frame Extraction Function
  async function extractVideoFrames(dataUrl, fileName) {
    return new Promise((resolve, reject) => {
      try {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const frames = [];
        
        video.src = dataUrl;
        video.muted = true;
        video.playsInline = true;
        
        video.onloadedmetadata = () => {
          const duration = video.duration;
          const frameCount = Math.min(6, Math.floor(duration)); // Extract max 6 frames
          let currentFrame = 0;
          
          // Set canvas size
          canvas.width = Math.min(video.videoWidth, 640); // Limit width to 640px
          canvas.height = Math.min(video.videoHeight, 480); // Limit height to 480px
          
          const extractFrame = () => {
            if (currentFrame >= frameCount) {
              resolve(frames);
              return;
            }
            
            const timePosition = (currentFrame / (frameCount - 1)) * duration;
            video.currentTime = timePosition;
          };
          
          video.onseeked = () => {
            try {
              // Draw video frame to canvas
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Convert to base64
              const frameData = canvas.toDataURL('image/jpeg', 0.8);
              frames.push({
                timestamp: video.currentTime,
                data: frameData,
                description: `Frame at ${Math.round(video.currentTime)}s from ${fileName}`
              });
              
              currentFrame++;
              extractFrame();
            } catch (frameError) {
              console.error('Frame extraction error:', frameError);
              currentFrame++;
              extractFrame();
            }
          };
          
          video.onerror = (error) => {
            console.error('Video loading error:', error);
            reject(new Error(`Failed to load video: ${fileName}`));
          };
          
          // Start extraction
          extractFrame();
        };
        
        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error('Video frame extraction timeout'));
        }, 30000);
        
      } catch (error) {
        console.error('Video extraction setup error:', error);
        reject(error);
      }
    });
  }

  // Load PDF.js library dynamically
  async function loadPdfJs() {
    return new Promise((resolve, reject) => {
      if (typeof pdfjsLib !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
  }

  // Generate test case function with improved animations
  async function generateTestCase(apiKey, prompt, files) {
    generateButton.disabled = true;
    loadingSpinner.style.display = 'inline-block';
    generateButton.classList.add('generating');
    resultDiv.style.display = 'none';
    copyButton.style.display = 'none';
    csvExportButton.style.display = 'none';
    
    // Show detailed loading information
    const fileCount = files.length;
    const imageCount = files.filter(f => f.isImage).length;
    const pdfCount = files.filter(f => f.isPdf).length;
    const videoCount = files.filter(f => f.isVideo).length;
    const extractedFrameCount = files.reduce((sum, f) => sum + (f.extractedFrames ? f.extractedFrames.length : 0), 0);
    
    let loadingText = 'Generating test cases...';
    if (fileCount > 0) {
      const visuals = imageCount + extractedFrameCount;
      const components = [];
      if (visuals > 0) components.push(`${visuals} visuals`);
      if (pdfCount > 0) components.push(`${pdfCount} documents`);
      if (components.length > 0) {
        loadingText = `Analyzing ${components.join(' & ')} and generating test cases...`;
      }
    }
    
    const originalButtonText = generateButton.textContent;
    generateButton.textContent = loadingText;
    
    try {
      // Separate files by type
      const imageFiles = files.filter(file => file.isImage);
      const pdfFiles = files.filter(file => file.isPdf);
      const videoFiles = files.filter(file => file.isVideo);
      
      // Collect all extracted video frames as additional images
      const extractedFrames = [];
      videoFiles.forEach(video => {
        if (video.extractedFrames && video.extractedFrames.length > 0) {
          extractedFrames.push(...video.extractedFrames);
        }
      });
      
      // Build enhanced file context with extracted content
      let fileContext = '';
      
      // Add PDF content
      if (pdfFiles.length > 0) {
        fileContext += `\n\n--- PDF DOCUMENTS CONTENT ---`;
        pdfFiles.forEach(pdf => {
          if (pdf.extractedContent) {
            fileContext += `\n\n**PDF: ${pdf.name}**\n${pdf.extractedContent}`;
          } else {
            fileContext += `\n\n**PDF: ${pdf.name}** (text extraction failed)`;
          }
        });
      }
      
      // Add video context
      if (videoFiles.length > 0) {
        fileContext += `\n\n--- VIDEO FILES ANALYSIS ---`;
        videoFiles.forEach(video => {
          if (video.extractedFrames && video.extractedFrames.length > 0) {
            fileContext += `\n\n**Video: ${video.name}**\n- Duration frames extracted: ${video.extractedFrames.length} frames\n- Frame timestamps: ${video.extractedFrames.map(f => `${Math.round(f.timestamp)}s`).join(', ')}\n- Visual content will be analyzed from extracted frames`;
          } else {
            fileContext += `\n\n**Video: ${video.name}** (frame extraction failed)`;
          }
        });
      }
      
      // Get settings for AI parameters
      const settingsResult = await new Promise(resolve => {
        chrome.storage.local.get(['settings'], resolve);
      });
      const settings = settingsResult.settings || getDefaultSettings();

      // Create the request to OpenAI API
      const requestData = {
        model: "gpt-4o",
        temperature: settings.temperature || 0.2,
        max_tokens: settings.maxTokens || 3000, // Allowing longer output for full test coverage
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
🚀 You are an expert hybrid AI persona combining the roles of:

- Lead QA Engineer with 10+ years in manual & automation testing
- Senior Product Manager with a strong understanding of business logic
- Senior Software Engineer familiar with frontend/backend architecture and QA best practices

🎯 Objective:
Your mission is to generate **real-world, production-ready test cases** for a software product — based on the **user-provided prompt** and **attached files** such as UI screenshots, product requirement documents (PDFs), and/or video screen recordings.

These test cases will be shown inside a **Chrome Extension UI** with **section-wise copy buttons**. Each section must be:
- Clearly labeled
- Structurally clean
- Easy to read
- Fully copyable

No JSON, no markdown, no explanations — just **plain, structured text**.

---

🧠 Context:
User prompt:  
"${prompt}"

${files.length > 0 ? `Additional context is provided through uploaded files:` : ''}  
${fileContext}

---

📂 File Usage Instructions:

- **UI Screenshots (Images):**  
  Extract button labels, input fields, dropdowns, form layouts, error messages, modal flows, and visual indicators.

- **PDF Documents:**  
  Use the extracted text to infer validations, form rules, user roles, conditional logic, edge-case handling, and business flows.

- **Video Frames (from recordings):**  
  Infer interaction sequences, timing-based validations, multi-screen flows, modals, transitions, and animated behaviors.

---

📝 Test Case Format:
Repeat the below structure for each test case. Every test case must be independent, comprehensive, and complete.

---

**TEST CASE TITLE:**  
[A short, one-line descriptive title for the test case]

**DESCRIPTION:**  
[Explain the purpose of this test case. What functionality is being tested? Why is it important to business/users?]

**PRE-CONDITIONS:**  
- [User role, login state, environment setup]  
- [Feature flags, data preconditions]  

**STEPS:**  
1. [Each user interaction step should be simple, clear, and sequential]  
2. [Include navigation, data entry, button clicks, and UI flows]  
3. [Use action verbs: click, enter, select, upload, submit]

**EXPECTED RESULTS:**  
[Clearly define what the system should do after executing the steps — success messages, UI transitions, data validation, redirection, backend responses, or visual feedback]

**PRIORITY:**  
[Critical / High / Medium / Low — based on feature importance, risk, and user impact]

**REGRESSION CANDIDATE:**  
[Yes / No]  
[One-line reason why it should or shouldn't be included in the regression suite]

---

🧪 What to Cover:
Each test case should consider the following dimensions (where applicable):
- Positive paths
- Negative inputs (validation errors, blocked flows)
- Role-based behavior (admin/user/viewer)
- UI behavior (states, loaders, modals)
- Form validation (mandatory fields, regex rules)
- Business logic (permissions, flows, multi-step)
- Error handling (invalid input, missing data, system downtime)
- Accessibility or performance edge cases (if visible)

---

OUTPUT RULES:
- DO NOT include JSON, markdown, code blocks or bullet symbols like "*", "#", or triple backticks
- DO NOT explain the test cases — JUST output the test cases
- DO NOT wrap anything in extra characters that might break parsing
- DO NOT summarize or add conclusion text

Your output MUST:
- Be in pure readable text
- Use the exact section titles: TEST CASE TITLE, DESCRIPTION, PRE-CONDITIONS, STEPS, EXPECTED RESULTS, PRIORITY, REGRESSION CANDIDATE
- Be structured cleanly with line breaks between sections
- Repeat the format for each test case
- Be copy-friendly for each section

---

Final Reminder:
These test cases will be presented inside a product-like Chrome Extension.  
Each section (like "STEPS" or "DESCRIPTION") will have a copy button beside it.  
So your format must allow direct section-based extraction.

**Begin generating test cases now. Output ONLY the test cases in the defined format.**
                `
              }
            ]
          }
        ]
      };
      
      // Add images and video frames to the request for visual analysis
      const allVisualContent = [];
      
      // Add regular images
      if (imageFiles.length > 0) {
        imageFiles.forEach(img => {
          allVisualContent.push({
            name: img.name,
            data: img.data.split(',')[1], // Remove data URL prefix
            type: 'image',
            source: 'uploaded_image'
          });
        });
      }
      
      // Add extracted video frames
      if (extractedFrames.length > 0) {
        extractedFrames.forEach(frame => {
          allVisualContent.push({
            name: frame.description,
            data: frame.data.split(',')[1], // Remove data URL prefix
            type: 'video_frame',
            source: 'video_extraction',
            timestamp: frame.timestamp
          });
        });
      }
      
      // Add all visual content to the request
      if (allVisualContent.length > 0) {
        console.log(`Sending ${allVisualContent.length} visual items to OpenAI:`, 
                   `${imageFiles.length} images, ${extractedFrames.length} video frames`);
        
        for (const visual of allVisualContent) {
          requestData.messages[0].content.push({
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${visual.data}`
            }
          });
        }
      }
      
      // Send request to OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData)
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        const generatedContent = cleanResponseText(responseData.choices[0].message.content);
        
        // Format the plain text response with copy buttons
        const formattedTestCases = formatPlainTextWithCopyButtons(generatedContent);
        resultDiv.innerHTML = formattedTestCases;
        
        // Show test case controls and output section
        testCaseControls.style.display = 'block';
        initializeTestCaseControls();
        
        // Show output section in fullscreen mode
        const outputSection = document.querySelector('.output-section');
        if (document.body.classList.contains('fullscreen-mode')) {
          outputSection.style.display = 'flex';
        } else {
          outputSection.style.display = 'block';
        }
        
        // Initialize test case statistics
        const containers = document.querySelectorAll('.test-case-container');
        updateTestCaseStats(containers.length, containers.length);
        
        // Smooth fade in for result
        resultDiv.style.display = 'block';
        resultDiv.style.opacity = '0';
        resultDiv.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
          resultDiv.style.opacity = '1';
          resultDiv.style.transform = 'translateY(0)';
        }, 10);
        
        copyButton.style.display = 'flex';
        csvExportButton.style.display = 'flex';
        showToast('Test cases generated successfully!');
      } else {
        throw new Error(responseData.error.message || 'Failed to generate test case');
      }
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
      resultDiv.style.display = 'block';
      copyButton.style.display = 'none';
      csvExportButton.style.display = 'none';
      showToast('Error generating test cases', 'error');
    } finally {
      generateButton.disabled = false;
      loadingSpinner.style.display = 'none';
      generateButton.classList.remove('generating');
      generateButton.textContent = originalButtonText;
      
      // Smooth scroll to result
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  
  // Add CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    body {
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .shake {
      animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
    }
    
    @keyframes shake {
      10%, 90% { transform: translate3d(-1px, 0, 0); }
      20%, 80% { transform: translate3d(2px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
      40%, 60% { transform: translate3d(3px, 0, 0); }
    }
    
    .pulse {
      animation: pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) forwards;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    
    .ripple {
      position: absolute;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.15);
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    }
    
    @keyframes ripple {
      to {
        transform: scale(2);
        opacity: 0;
      }
    }
    
    .generating {
      position: relative;
      overflow: hidden;
    }
    
    .generating::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg, 
        transparent, 
        rgba(255, 255, 255, 0.2), 
        transparent
      );
      animation: shine 1.5s infinite;
    }
    
    @keyframes shine {
      100% {
        left: 100%;
      }
    }
    
    .copy-success {
      background-color: var(--secondary) !important;
      transform: translateY(-3px) !important;
    }
    
    #result {
      transition: opacity 0.5s ease, transform 0.5s ease;
    }
  `;
  document.head.appendChild(style);
}); 