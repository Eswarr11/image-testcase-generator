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

  // Function to handle individual section copying
  window.handleSectionCopy = function(button, content, sectionName) {
    // Decode the escaped content
    const decodedContent = content.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
    
    navigator.clipboard.writeText(decodedContent).then(() => {
      // Show success feedback with animation
      button.classList.add('copy-success');
      button.innerHTML = '✓';
      setTimeout(() => {
        button.innerHTML = '📋';
        button.classList.remove('copy-success');
      }, 1500);
      
      // Access showToast from the global scope
      if (window.showToastGlobal) {
        window.showToastGlobal(`${sectionName} copied to clipboard!`, 'success', 1500);
      }
    }).catch(err => {
      console.error('Failed to copy:', err);
      if (window.showToastGlobal) {
        window.showToastGlobal('Failed to copy to clipboard', 'error');
      }
    });
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
    
    // Split content by test case separators (---)
    const testCaseSections = content.split('---').filter(section => section.trim());
    
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
      const lines = section.trim().split('\n').filter(line => line.trim());
      
      let title = '';
      let description = '';
      let preConditions = [];
      let steps = [];
      let expectedResults = '';
      let priority = '';
      let regressionCandidate = '';
      
      let currentSection = '';
      
      for (let line of lines) {
        line = line.trim();
        
        if (line.startsWith('**TEST CASE TITLE:**')) {
          title = line.replace('**TEST CASE TITLE:**', '').trim();
          currentSection = 'title';
        } else if (line.startsWith('**DESCRIPTION:**')) {
          description = line.replace('**DESCRIPTION:**', '').trim();
          currentSection = 'description';
        } else if (line.startsWith('**PRE-CONDITIONS:**')) {
          currentSection = 'preConditions';
        } else if (line.startsWith('**STEPS:**')) {
          currentSection = 'steps';
        } else if (line.startsWith('**EXPECTED RESULTS:**')) {
          expectedResults = line.replace('**EXPECTED RESULTS:**', '').trim();
          currentSection = 'expectedResults';
        } else if (line.startsWith('**PRIORITY:**')) {
          priority = line.replace('**PRIORITY:**', '').trim();
          currentSection = 'priority';
        } else if (line.startsWith('**REGRESSION CANDIDATE:**')) {
          regressionCandidate = line.replace('**REGRESSION CANDIDATE:**', '').trim();
          currentSection = 'regressionCandidate';
        } else if (line) {
          // Handle content under sections
          if (currentSection === 'description' && description === '') {
            description = line;
          } else if (currentSection === 'description') {
            description += ' ' + line;
          } else if (currentSection === 'preConditions' && (line.startsWith('-') || line.startsWith('•'))) {
            preConditions.push(line.replace(/^[-•]\s*/, ''));
          } else if (currentSection === 'steps' && /^\d+\./.test(line)) {
            steps.push(line.replace(/^\d+\.\s*/, ''));
          } else if (currentSection === 'expectedResults' && expectedResults === '') {
            expectedResults = line;
          } else if (currentSection === 'expectedResults') {
            expectedResults += ' ' + line;
          }
        }
      }
      
      // Default values
      if (!title) title = `Test Case ${index + 1}`;
      if (!description) description = 'No description provided';
      if (preConditions.length === 0) preConditions = ['No pre-conditions specified'];
      if (steps.length === 0) steps = ['No steps specified'];
      if (!expectedResults) expectedResults = 'No expected results specified';
      if (!priority) priority = 'Medium';
      if (!regressionCandidate) regressionCandidate = 'Not specified';
      
      const priorityClass = priority.toLowerCase();
      
      html += `
        <div class="test-case-container">
          <div class="test-case-header">
            <div class="test-case-meta">
              <span class="test-case-id">TC_${String(index + 1).padStart(3, '0')}</span>
              <span class="test-case-priority ${priorityClass}">${priority}</span>
            </div>
            <div class="section-header">
              <h3 class="test-case-title section-title">${title}</h3>
              <button class="section-copy-btn" onclick="handleSectionCopy(this, '${escapeHtml(title)}', 'Title')">📋</button>
            </div>
          </div>
          
          <div class="test-case-body">
            <div class="section-container">
              <div class="section-header">
                <h4 class="section-title">Description</h4>
                <button class="section-copy-btn" onclick="handleSectionCopy(this, '${escapeHtml(description)}', 'Description')">📋</button>
              </div>
              <div class="test-details">
                <p>${description}</p>
              </div>
            </div>
            
            <div class="section-container">
              <div class="section-header">
                <h4 class="section-title">Pre-conditions</h4>
                <button class="section-copy-btn" onclick="handleSectionCopy(this, '${escapeHtml(preConditions.join('\\n'))}', 'Pre-conditions')">📋</button>
              </div>
              <ul class="pre-conditions-list">
                ${preConditions.map(condition => `<li>${condition}</li>`).join('')}
              </ul>
            </div>
            
            <div class="section-container">
              <div class="section-header">
                <h4 class="section-title">Steps</h4>
                <button class="section-copy-btn" onclick="handleSectionCopy(this, '${escapeHtml(steps.map((step, i) => `${i + 1}. ${step}`).join('\\n'))}', 'Steps')">📋</button>
              </div>
              <ol class="steps-list">
                ${steps.map(step => `<li>${step}</li>`).join('')}
              </ol>
            </div>
            
            <div class="section-container">
              <div class="section-header">
                <h4 class="section-title">Expected Results</h4>
                <button class="section-copy-btn" onclick="handleSectionCopy(this, '${escapeHtml(expectedResults)}', 'Expected Results')">📋</button>
              </div>
              <div class="expected-results">
                <p>${expectedResults}</p>
              </div>
            </div>
            
            <div class="section-container">
              <div class="section-header">
                <h4 class="section-title">Priority & Regression Info</h4>
                <button class="section-copy-btn" onclick="handleSectionCopy(this, 'Priority: ${escapeHtml(priority)}\\nRegression Candidate: ${escapeHtml(regressionCandidate)}', 'Priority & Regression Info')">📋</button>
              </div>
              <div class="additional-info">
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
      
      // Create the request to OpenAI API
      const requestData = {
        model: "gpt-4o",
        temperature: 0.2,
        max_tokens: 3000, // Allowing longer output for full test coverage
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
        
        // Show output section in fullscreen mode
        const outputSection = document.querySelector('.output-section');
        if (document.body.classList.contains('fullscreen-mode')) {
          outputSection.style.display = 'flex';
        } else {
          outputSection.style.display = 'block';
        }
        
        // Smooth fade in for result
        resultDiv.style.display = 'block';
        resultDiv.style.opacity = '0';
        resultDiv.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
          resultDiv.style.opacity = '1';
          resultDiv.style.transform = 'translateY(0)';
        }, 10);
        
        copyButton.style.display = 'flex';
        showToast('Test cases generated successfully!');
      } else {
        throw new Error(responseData.error.message || 'Failed to generate test case');
      }
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
      resultDiv.style.display = 'block';
      copyButton.style.display = 'none';
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