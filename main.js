// Global variables
let selectedFiles = [];
const MAX_FILES = 9;

// Web storage wrapper to replace chrome.storage
const webStorage = {
  local: {
    get: function(keys, callback) {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              result[key] = JSON.parse(value);
            } catch (e) {
              result[key] = value;
            }
          }
        });
      } else if (typeof keys === 'string') {
        const value = localStorage.getItem(keys);
        if (value) {
          try {
            result[keys] = JSON.parse(value);
          } catch (e) {
            result[keys] = value;
          }
        }
      } else if (typeof keys === 'object') {
        Object.keys(keys).forEach(key => {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              result[key] = JSON.parse(value);
            } catch (e) {
              result[key] = value;
            }
          } else {
            result[key] = keys[key]; // default value
          }
        });
      }
      callback(result);
    },
    set: function(items, callback) {
      Object.keys(items).forEach(key => {
        localStorage.setItem(key, JSON.stringify(items[key]));
      });
      if (callback) callback();
    }
  }
};

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
  console.log('Web app loaded');
  
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
  const copyButton = document.getElementById('copyButton');
  const dropArea = document.getElementById('dropArea');
  const imageCounter = document.getElementById('imageCounter');
  const imageCount = document.getElementById('imageCount');
  const clearImagesButton = document.getElementById('clearImages');
  const toast = document.getElementById('toast');
  const csvExportButton = document.getElementById('csvExportButton');
  const resultControls = document.getElementById('resultControls');
  
  // New UI elements
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const settingsButton = document.getElementById('settingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const settingsClose = document.getElementById('settingsClose');
  const templateSelect = document.getElementById('templateSelect');
  const loadTemplateButton = document.getElementById('loadTemplate');
  const compactModeCheckbox = document.getElementById('compactMode');
  
  // Initialize
  initializeApiKey();
  initializeTheme();
  initializeSettings();
  initializeTemplates();
  initializeEventListeners();

  // API Key Management Functions
  function initializeApiKey() {
    webStorage.local.get(['openai_api_key'], function(result) {
      if (result.openai_api_key && result.openai_api_key.trim()) {
        hideApiKeyInput();
        console.log('API key found in storage');
      } else {
        showApiKeyInput();
        console.log('No API key found, showing input');
      }
    });
  }

  function hideApiKeyInput() {
    const apiKeyInputGroup = document.getElementById('apiKeyInputGroup');
    const apiKeyIndicator = document.getElementById('apiKeyIndicator');
    
    apiKeyInputGroup.style.display = 'none';
    changeApiKeyButton.classList.remove('hidden');
    apiKeyStatus.textContent = 'API Key configured ✓';
    apiKeyIndicator.classList.add('success');
    generateButton.disabled = false;
  }

  function showApiKeyInput() {
    const apiKeyInputGroup = document.getElementById('apiKeyInputGroup');
    const apiKeyIndicator = document.getElementById('apiKeyIndicator');
    
    apiKeyInputGroup.style.display = 'block';
    changeApiKeyButton.classList.add('hidden');
    apiKeyStatus.textContent = 'API Key not configured';
    apiKeyIndicator.classList.remove('success');
    generateButton.disabled = true;
  }

  // Theme Management Functions
  function initializeTheme() {
    webStorage.local.get(['theme'], function(result) {
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
      body.setAttribute('data-theme', 'dark');
      updateThemeIcon('dark');
    }
  }

  function updateThemeIcon(theme) {
    if (theme === 'light') {
      themeIcon.textContent = '☀️';
    } else {
      themeIcon.textContent = '🌙';
    }
  }

  // Settings Management Functions
  function initializeSettings() {
    webStorage.local.get(['settings'], function(result) {
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
      theme: document.body.getAttribute('data-theme') || 'dark',
      compactMode: compactModeCheckbox?.checked || false,
      defaultTemplate: '',
      autoExpand: true,
      enableTooltips: true,
      exportFormat: 'csv',
      saveHistory: true,
      maxTokens: 3000,
      temperature: 0.2
    };

    webStorage.local.set({ settings }, function() {
      loadSettings(settings);
      showToast('Settings saved successfully!', 'success', 2000);
      closeSettingsModal();
    });
  }

  // Templates Management Functions
  function initializeTemplates() {
    if (templateSelect && loadTemplateButton) {
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
  }

  function getTemplate(type) {
    const templates = {
      default: `Please generate comprehensive test cases for the functionality shown in the provided images and described in the prompt. Include:

1. Test case title
2. Test case description
3. Pre-conditions
4. Test steps (detailed, step-by-step)
5. Expected results
6. Priority level (Critical/High/Medium/Low)
7. Test data requirements
8. Post-conditions

Focus on both positive and negative test scenarios, edge cases, and user experience aspects.`,

      detailed: `Create detailed test cases with the following comprehensive structure:

**Test Case Information:**
- Test Case ID
- Test Case Title
- Module/Feature
- Priority Level
- Test Type (Functional/UI/Integration/etc.)

**Test Details:**
- Objective
- Pre-conditions
- Test Environment
- Test Data
- Detailed Test Steps
- Expected Results
- Actual Results
- Pass/Fail Status
- Notes/Comments

**Additional Considerations:**
- Browser/Device compatibility
- Performance considerations
- Security aspects
- Accessibility requirements
- Error handling scenarios`,

      simple: `Generate simple, focused test cases covering:

1. Basic functionality test
2. Input validation test
3. Error handling test
4. User interface test
5. Integration test

Keep each test case concise but complete with:
- Clear test steps
- Expected outcomes
- Pass/fail criteria`
    };

    return templates[type] || templates.default;
  }

  // Event Listeners
  function initializeEventListeners() {
    // API Key Events
    saveApiKeyButton.addEventListener('click', function() {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        webStorage.local.set({ openai_api_key: apiKey }, function() {
          hideApiKeyInput();
          showToast('API Key saved successfully!', 'success');
        });
      } else {
        showToast('Please enter a valid API key', 'error');
      }
    });

    changeApiKeyButton.addEventListener('click', function() {
      showApiKeyInput();
      apiKeyInput.value = '';
      apiKeyInput.focus();
    });

    // Theme Toggle
    themeToggle.addEventListener('click', function() {
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      webStorage.local.set({ theme: newTheme });
    });

    // Settings Modal
    settingsButton.addEventListener('click', function() {
      settingsModal.style.display = 'block';
    });

    settingsClose.addEventListener('click', closeSettingsModal);

    settingsModal.addEventListener('click', function(e) {
      if (e.target === settingsModal) {
        closeSettingsModal();
      }
    });

    // Compact Mode
    if (compactModeCheckbox) {
      compactModeCheckbox.addEventListener('change', saveSettings);
    }

    // Image Upload Events
    dropArea.addEventListener('click', function() {
      imageUploadInput.click();
    });

    dropArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropArea.classList.add('drag-over');
    });

    dropArea.addEventListener('dragleave', function(e) {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
    });

    dropArea.addEventListener('drop', function(e) {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });

    imageUploadInput.addEventListener('change', function(e) {
      handleFiles(e.target.files);
    });

    clearImagesButton.addEventListener('click', function() {
      selectedFiles = [];
      updateImagePreview();
      updateImageCounter();
    });

    // Generate Button
    generateButton.addEventListener('click', generateTestCase);

    // Copy Button
    copyButton.addEventListener('click', function() {
      navigator.clipboard.writeText(resultDiv.textContent).then(function() {
        showToast('Test case copied to clipboard!', 'success');
      });
    });

    // CSV Export Button
    csvExportButton.addEventListener('click', exportToCSV);

    // Prompt textarea auto-resize
    promptTextarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
  }

  function closeSettingsModal() {
    settingsModal.style.display = 'none';
  }

  // File Handling Functions
  function handleFiles(files) {
    const fileArray = Array.from(files);
    
    for (let file of fileArray) {
      if (selectedFiles.length >= MAX_FILES) {
        showToast(`Maximum ${MAX_FILES} images allowed`, 'warning');
        break;
      }
      
      if (file.type.startsWith('image/')) {
        selectedFiles.push(file);
      } else {
        showToast('Only image files are allowed', 'warning');
      }
    }
    
    updateImagePreview();
    updateImageCounter();
  }

  function updateImagePreview() {
    imagePreviewDiv.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
      const imageItem = document.createElement('div');
      imageItem.className = 'image-item';
      
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = `Preview ${index + 1}`;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'image-remove';
      removeBtn.innerHTML = '×';
      removeBtn.onclick = () => removeImage(index);
      
      imageItem.appendChild(img);
      imageItem.appendChild(removeBtn);
      imagePreviewDiv.appendChild(imageItem);
    });
  }

  function removeImage(index) {
    selectedFiles.splice(index, 1);
    updateImagePreview();
    updateImageCounter();
  }

  function updateImageCounter() {
    imageCount.textContent = selectedFiles.length;
    clearImagesButton.style.display = selectedFiles.length > 0 ? 'block' : 'none';
  }

  // Test Case Generation
  async function generateTestCase() {
    const prompt = promptTextarea.value.trim();
    
    if (!prompt) {
      showToast('Please enter a prompt', 'warning');
      return;
    }

    webStorage.local.get(['openai_api_key'], async function(result) {
      const apiKey = result.openai_api_key;
      
      if (!apiKey) {
        showToast('Please configure your OpenAI API key first', 'error');
        return;
      }

      try {
        generateButton.disabled = true;
        loadingSpinner.style.display = 'block';
        resultDiv.classList.add('hidden');
        resultControls.classList.add('hidden');

        const requestBody = {
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a QA expert specializing in creating comprehensive Jira test cases. Generate detailed, professional test cases that include: Title, Description, Pre-conditions, Test Steps, Expected Results, Priority Level, and additional relevant testing criteria. Format the output in a clean, readable structure suitable for Jira."
            },
            {
              role: "user",
              content: selectedFiles.length > 0 ? 
                [
                  { type: "text", text: prompt },
                  ...await Promise.all(selectedFiles.map(async (file) => ({
                    type: "image_url",
                    image_url: {
                      url: await fileToBase64(file)
                    }
                  })))
                ] : prompt
            }
          ],
          max_tokens: 3000,
          temperature: 0.2
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const testCase = data.choices[0].message.content;

        resultDiv.textContent = testCase;
        resultDiv.classList.remove('hidden');
        resultControls.classList.remove('hidden');
        
        showToast('Test case generated successfully!', 'success');

      } catch (error) {
        console.error('Error generating test case:', error);
        showToast('Error generating test case: ' + error.message, 'error');
      } finally {
        generateButton.disabled = false;
        loadingSpinner.style.display = 'none';
      }
    });
  }

  // Utility Functions
  function fileToBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  function showToast(message, type = 'info', duration = 3000) {
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    
    // Remove existing type classes
    toast.classList.remove('success', 'error', 'warning', 'info');
    toast.classList.add(type);
    
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  function exportToCSV() {
    const testCaseText = resultDiv.textContent;
    if (!testCaseText) {
      showToast('No test case to export', 'warning');
      return;
    }

    const csvContent = `"Test Case","Content"\n"Generated Test Case","${testCaseText.replace(/"/g, '""')}"`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-case.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Test case exported to CSV', 'success');
  }
});
