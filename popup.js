// Global variables
let selectedImages = [];
const MAX_IMAGES = 5;
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
        
        // Add screenshot to selected images and update UI
        if (selectedImages.length < MAX_IMAGES) {
          selectedImages.push(imageData);
          renderImagePreviews();
          updateImageCounter();
          showToast('Screenshot captured!');
        } else {
          showToast('Maximum image limit reached (5 images)', 'error');
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
      
      // Fade out images before removing them
      const previews = imagePreviewDiv.querySelectorAll('.image-preview-item');
      if (previews.length > 0) {
        previews.forEach(preview => {
          preview.style.opacity = '0';
          preview.style.transform = 'scale(0.8)';
        });
        
        setTimeout(() => {
          selectedImages = [];
          renderImagePreviews();
          updateImageCounter();
          clearImagesButton.style.display = 'none';
        }, 300);
      } else {
        selectedImages = [];
        renderImagePreviews();
        updateImageCounter();
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

  // Update image counter with animation
  function updateImageCounter() {
    if (selectedImages.length > 0) {
      imageCounter.style.display = 'flex';
      imageCount.textContent = selectedImages.length;
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
    if (selectedImages.length + files.length > MAX_IMAGES) {
      // Show elegant error feedback
      dropArea.classList.add('shake');
      setTimeout(() => {
        dropArea.classList.remove('shake');
      }, 600);
      
      showToast(`You can only upload up to ${MAX_IMAGES} images in total`, 'error');
      return;
    }

    [...files].forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        const imageData = {
          name: file.name,
          data: e.target.result,
          file: file
        };
        
        selectedImages.push(imageData);
        renderImagePreviews();
        updateImageCounter();
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

    generateTestCase(apiKey, prompt, selectedImages);
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

  // Render image previews with staggered animation
  function renderImagePreviews() {
    imagePreviewDiv.innerHTML = '';
    
    selectedImages.forEach((img, index) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'image-preview-item';
      previewItem.style.opacity = '0';
      previewItem.style.transform = 'scale(0.9)';
      
      const imgElement = document.createElement('img');
      imgElement.src = img.data;
      
      // Add caption for screenshots
      if (img.isScreenshot) {
        const badgeElement = document.createElement('div');
        badgeElement.style.position = 'absolute';
        badgeElement.style.bottom = '4px';
        badgeElement.style.left = '4px';
        badgeElement.style.backgroundColor = 'rgba(159, 122, 234, 0.6)';
        badgeElement.style.color = 'white';
        badgeElement.style.fontSize = '10px';
        badgeElement.style.padding = '2px 5px';
        badgeElement.style.borderRadius = '4px';
        badgeElement.style.backdropFilter = 'blur(4px)';
        badgeElement.textContent = 'Screenshot';
        previewItem.appendChild(badgeElement);
      }
      
      const removeButton = document.createElement('div');
      removeButton.className = 'remove-image';
      removeButton.innerHTML = '×';
      removeButton.onclick = function(e) {
        e.stopPropagation(); // Prevent event bubbling
        
        // Fade out animation before removing
        previewItem.style.opacity = '0';
        previewItem.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
          selectedImages.splice(index, 1);
          renderImagePreviews();
          updateImageCounter();
        }, 300);
      };
      
      // Add click event to preview image in modal
      previewItem.addEventListener('click', function() {
        openImageModal(img.data, img.name);
      });
      
      previewItem.appendChild(imgElement);
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
  async function generateTestCase(apiKey, prompt, images) {
    generateButton.disabled = true;
    loadingSpinner.style.display = 'inline-block';
    generateButton.classList.add('generating');
    resultDiv.style.display = 'none';
    copyButton.style.display = 'none';
    
    try {
      // Create the request to OpenAI API
      const requestData = {
        model: "gpt-4o", // Using gpt-4o which has built-in vision capabilities
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
Act as a Lead QA Manual and Automation Manager, Senior Product Manager, and Senior Product Developer with expertise in writing comprehensive and detailed test cases. Analyze the provided images thoroughly, carefully observing the UI layout, features, workflows, and potential risk areas. Based on ${images.length > 0 ? 'the provided images and ' : ''}the following prompt: "${prompt}", create a complete and exhaustive list of test cases, including at least one positive and one negative scenario. You must generate all possible valid and invalid test cases without any limitation on the number — covering every interaction, functionality, UI element, permission level, edge case, and potential failure point that can be tested. Every test case must be clear, precise, runnable, and directly executable by a QA engineer. Reference specific UI elements visible in the images where applicable. Follow strict formatting guidelines: number each test case clearly as "Test Case 1", "Test Case 2", and so on; use only basic characters such as letters, numbers, hyphens, commas, periods, and quotes; avoid using special characters like asterisks or curly braces; and maintain a clean, simple structure for easy copying into Jira.

For each test case, adhere to the following structure:

Test Case #: [Number - indicate if Positive or Negative]

Title: [A clear, concise title summarizing the test case]

Input:
- Description: [Detailed explanation of the feature being tested]
- Context: [Broader context of why this test is important]
${images.length > 0 ? '- UI Information: [Insights from the provided screenshots/images]' : ''}

Pre-conditions:
1. [Pre-condition 1]
2. [Pre-condition 2]
...

Steps:
1. [Detailed action step 1]
2. [Detailed action step 2]
...

Expectation:
- Expected Results: [What should happen after executing all steps]
- Validation Points: [Specific points to verify in the UI or system]
- Error Handling: [How edge cases should be handled]

Additional Information:
- Regression Candidate: [Yes/No] — Explain why or why not
- Priority: [Critical/High/Medium/Low] — Justify this priority level

${images.length > 0 
  ? 'Make sure to analyze the provided images deeply. Review the UI layout, workflows, interactive elements, permissions, error states, and all edge cases from the perspective of a Lead QA Manager, Senior Product Manager, and Senior Product Developer. Cover every functional, non-functional, and negative test case scenario, ensuring a complete QA and product validation checklist that leaves no element or user flow untested.' 
  : 'Create a full list of test cases based solely on the given context, ensuring you test all possible positive and negative scenarios, edge cases, and error conditions without limiting the number of cases. Cover functional, non-functional, and boundary validations comprehensively.'
}

IMPORTANT: Always start test steps from the very beginning of the user journey. Include login steps, navigation to the specific feature/page, and any prerequisite actions needed before reaching the main functionality being tested. Do not assume the user is already at a specific section of the application. This ensures test cases are complete and can be executed by any QA engineer without prior knowledge of the application state.

Remember to be extremely specific, detail-oriented, and focus on creating testable actions and verifiable outcomes that can directly be executed by QA engineers.
                `
              }
            ]
          }
        ],
        max_tokens: 2000
      };
      
      // Add images to the request if any are provided
      if (images.length > 0) {
        // First, encode all images to base64
        const imagePromises = images.map(async (img) => {
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