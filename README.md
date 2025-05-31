# Jira Test Case Generator Chrome Extension

A Chrome extension that uses OpenAI's GPT-4o capabilities to generate Jira test cases from prompts and optional images.

## Features

- Modern, sleek dark mode UI designed for Gen Z users
- Generate test cases based on text prompts with optional image uploads
- Drag and drop support for easy image uploading (up to 5 images)
- Visual image counter showing image limit and usage
- Provide a prompt describing what needs to be tested
- Persistent popup window that won't close when uploading images
- One-click copy button for easy transfer to Jira
- Generate structured Jira test cases with:
  - Title
  - Description
  - Steps to Reproduce
  - Expected Results
  - Regression Candidate assessment
  - Priority level (Critical/High/Medium/Low) with justification
  - Detailed Steps
  - Result

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed and ready to use

## Usage

1. Click on the extension icon in Chrome
2. A popup window will open with a modern UI interface
3. Enter your OpenAI API key and save it (required for using the API)
4. Enter a prompt describing what functionality you want to test
5. Optionally, add images by:
   - Dragging and dropping images directly onto the upload area
   - Clicking the upload area to browse files
   - (Note: Maximum of 5 images supported)
6. Click "Generate Test Case"
7. Use the copy button to easily copy the generated test case
8. Paste the test case into your Jira ticket
9. When finished, click the X button in the top right to close the window

## Requirements

- Valid OpenAI API key with access to GPT-4o model
- Chrome browser
- Images of the UI or feature you want to test (optional)

## Note

Your OpenAI API key is stored locally in your browser's storage and is only used to communicate with the OpenAI API.

## License

MIT 