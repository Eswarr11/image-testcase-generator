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
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const promptTextarea = document.getElementById('prompt');
  const imageUploadInput = document.getElementById('imageUpload');
  const imagePreviewDiv = document.getElementById('imagePreview');
  const generateButton = document.getElementById('generate');
  const resultDiv = document.getElementById('result');
  const loadingSpinner = document.getElementById('loading');
  const closeButton = document.getElementById('closeButton');
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

  // Apply smooth entrance animations for a premium feel
  setTimeout(() => {
    document.body.style.opacity = '1';
  }, 100);

  // Close button functionality
  closeButton.addEventListener('click', function() {
    // Smooth fade out animation before closing
    document.body.style.opacity = '0';
    setTimeout(() => {
      window.close();
    }, 300);
  });

  // Screenshot button functionality
  screenshotButton.addEventListener('click', captureScreenshot);

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
      const text = resultDiv.textContent;
      navigator.clipboard.writeText(text).then(() => {
        // Show success feedback with animation
        copyButton.classList.add('copy-success');
        copyButton.innerHTML = '✓';
        setTimeout(() => {
          copyButton.innerHTML = '📋';
          copyButton.classList.remove('copy-success');
        }, 1500);
      });
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

  // Load API key from storage if available
  chrome.storage.local.get(['openai_api_key'], function(result) {
    if (result.openai_api_key) {
      apiKeyInput.value = result.openai_api_key;
    }
  });

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
        }, 1500);
      });
    } else {
      apiKeyInput.classList.add('shake');
      setTimeout(() => {
        apiKeyInput.classList.remove('shake');
      }, 600);
      alert('Please enter a valid API key.');
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
    const dt = e.dataTransfer;
    const files = dt.files;
    
    handleFiles(files);
  }

  function handleFiles(files) {
    if (selectedFiles.length + files.length > MAX_FILES) {
      // Show elegant error feedback
      dropArea.classList.add('shake');
      setTimeout(() => {
        dropArea.classList.remove('shake');
      }, 600);
      
      showToast(`You can only upload up to ${MAX_FILES} files in total`, 'error');
      return;
    }

    [...files].forEach(file => {
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
      
      const reader = new FileReader();
      reader.onload = function(e) {
        const fileData = {
          name: file.name,
          data: e.target.result,
          file: file,
          type: file.type,
          size: file.size,
          isImage: file.type.startsWith('image/'),
          isPdf: file.type === 'application/pdf',
          isVideo: file.type.startsWith('video/')
        };
        
        selectedFiles.push(fileData);
        renderFilePreviews();
        updateFileCounter();
      };
      reader.readAsDataURL(file);
    });
  }

  // Click to upload functionality with ripple effect
  dropArea.addEventListener('click', function(e) {
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
    
    imageUploadInput.click();
  });

  // Handle image selection through input
  imageUploadInput.addEventListener('change', function(e) {
    handleFiles(e.target.files);
  });

  // Generate test case button click with elegant loading state
  generateButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    const prompt = promptTextarea.value.trim();
    
    if (!apiKey) {
      apiKeyInput.classList.add('shake');
      setTimeout(() => {
        apiKeyInput.classList.remove('shake');
      }, 600);
      showToast('Please enter your OpenAI API key', 'error');
      return;
    }
    
    if (!prompt) {
      promptTextarea.classList.add('shake');
      setTimeout(() => {
        promptTextarea.classList.remove('shake');
      }, 600);
      showToast('Please enter a test case prompt', 'error');
      return;
    }

    generateTestCase(apiKey, prompt, selectedFiles);
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
        pdfIcon.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#e74c3c">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
          <span>PDF</span>
        `;
        previewItem.appendChild(pdfIcon);
      } else if (file.isVideo) {
        const videoIcon = document.createElement('div');
        videoIcon.className = 'file-icon video-icon';
        videoIcon.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#9b59b6">
            <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/>
          </svg>
          <span>VIDEO</span>
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

  // Generate test case function with improved animations
  async function generateTestCase(apiKey, prompt, files) {
    generateButton.disabled = true;
    loadingSpinner.style.display = 'inline-block';
    generateButton.classList.add('generating');
    resultDiv.style.display = 'none';
    copyButton.style.display = 'none';
    
    try {
      // Separate files by type
      const imageFiles = files.filter(file => file.isImage);
      const pdfFiles = files.filter(file => file.isPdf);
      const videoFiles = files.filter(file => file.isVideo);
      
      // Build file context description
      let fileContext = '';
      if (pdfFiles.length > 0) {
        fileContext += `\n\nPDF Documents attached (${pdfFiles.length}): ${pdfFiles.map(f => f.name).join(', ')}`;
      }
      if (videoFiles.length > 0) {
        fileContext += `\n\nVideo Files attached (${videoFiles.length}): ${videoFiles.map(f => f.name).join(', ')}`;
      }
      
      // Create the request to OpenAI API
      const requestData = {
        model: "gpt-4o",
        temperature: 0.2, // low temp for consistency
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
Act as a Lead QA Manual and Automation Manager, Senior Product Manager, and Senior Product Developer. Your objective is to write a **complete, exhaustive, and production-grade suite of test cases** based on the input materials provided.

You are expected to analyze the provided files thoroughly — including images, PDFs, and video files — by carefully observing UI layout, workflows, features, permission controls, and risk areas.

Based on ${files.length > 0 ? 'the provided files and ' : ''}the following prompt: "${prompt}", generate test cases that comprehensively cover:

- All positive and negative user scenarios
- All possible valid and invalid inputs
- UI functionality, form validations, data boundaries, permission-level access
- Non-functional considerations (e.g., performance, error messages)
- Edge cases and exception handling
- Role-based behavior variations (admin, editor, viewer, etc.)
- System response and behavior across devices or states

Each test case should follow the format below and be easily copy-pasteable into Jira:

---

**Test Case #:** [Number – indicate Positive or Negative]  
**Title:** [Short, descriptive title]

**Input:**  
- Description: [What is being tested]  
- Context: [Why this test matters from a business or technical perspective]  
${imageFiles.length > 0 ? '- UI Information: [Details from screenshots/images]' : ''}
${pdfFiles.length > 0 ? '- PDF Documents: [Relevant notes from PDF files]' : ''}
${videoFiles.length > 0 ? '- Video Files: [Key flows observed from video]' : ''}

**Pre-conditions:**  
1. [Pre-condition 1, e.g., user role or system state]  
2. [Pre-condition 2, e.g., required test data]  
...

**Steps:**  
1. Log in as [specific role] using valid credentials  
2. Navigate to [specific feature/module] from homepage/dashboard  
3. Perform the following actions: [clear user interactions]  
...  
n. Submit or complete the action

**Expectation:**  
- Expected Results: [What should happen after performing all steps]  
- Validation Points: [What to check on UI/backend/API/logs]  
- Error Handling: [How the system should respond in edge/failure cases]

**Additional Information:**  
- Regression Candidate: [Yes/No – justify why this test should or shouldn't be part of the regression suite]  
- Priority: [Critical/High/Medium/Low – based on business/user risk]

---

${files.length > 0
  ? 'Use the attached files to extract real UI workflows, actions, and validations. Reference specific button names, input labels, dropdowns, modals, error banners, and system flows observed.'
  : 'Use only the provided prompt to infer workflows and generate maximum test coverage across UI, backend, and business logic.'}

🚨 **IMPORTANT:**  
- Always begin from the start of the user journey: login → navigation → interaction → validation.  
- Do not assume the user is already at the feature page.  
- Every test case should be complete, independent, and executable by any QA engineer without needing prior state knowledge.  
- Use clean structure and Jira-safe characters: letters, numbers, hyphens, commas, and periods only (no emojis, asterisks, or markdown).  
- Be extremely specific, QA-minded, and leave no area untested.

Your output should represent a **full validation checklist** from a product, engineering, and QA perspective. Think like a Release Manager signing off a feature for production.
                `
              }
            ]
          }
        ]
      };
      
      // Add images to the request if any are provided (only actual images, not PDFs or videos)
      if (imageFiles.length > 0) {
        // First, encode all images to base64
        const imagePromises = imageFiles.map(async (img) => {
          return {
            name: img.name,
            data: img.data.split(',')[1] // Remove data URL prefix
          };
        });
        
        const processedImages = await Promise.all(imagePromises);
        
        // Add images to the request
        for (const img of processedImages) {
          requestData.messages[0].content.push({
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${img.data}`
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
        const generatedTestCase = cleanResponseText(responseData.choices[0].message.content);
        resultDiv.textContent = generatedTestCase;
        
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