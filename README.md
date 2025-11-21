# Jira Test Case Generator Web Application

A modern web application that uses OpenAI's GPT-4o capabilities to generate comprehensive Jira test cases from text prompts and optional images.

## Features

- 🎨 Modern, sleek dark/light mode UI designed for optimal user experience
- 🤖 AI-powered test case generation using OpenAI's GPT-4o model
- 📸 Image upload support with drag and drop functionality (up to 9 images)
- 📋 Template system for different types of testing scenarios
- 📊 CSV export functionality for easy integration with Jira
- ⚙️ Customizable settings and preferences
- 📱 Responsive design that works on all devices
- 🔒 Secure API key storage using browser's localStorage
- 🎯 Generate structured test cases with:
  - Title and Description
  - Pre-conditions and Post-conditions
  - Detailed Test Steps
  - Expected Results
  - Priority Level assessment
  - Test data requirements
  - Error handling scenarios

## Prerequisites

- Node.js (version 14.0.0 or higher)
- Valid OpenAI API key with access to GPT-4o model
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Eswarr11/image-testcase-generator.git
   cd image-testcase-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the web application:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Getting Started

1. **Configure API Key**: 
   - On first launch, enter your OpenAI API key in the provided field
   - Click "Save API Key" to store it securely in your browser
   - The key is stored locally and only used to communicate with OpenAI's API

2. **Create Test Cases**:
   - Enter a detailed prompt describing the functionality you want to test
   - Optionally upload images (screenshots, mockups, UI elements) by:
     - Dragging and dropping files onto the upload area
     - Clicking the upload area to browse and select files
     - Maximum of 9 images supported (PNG, JPG, JPEG, GIF)
   - Click "Generate Test Case" to create comprehensive test cases

3. **Use Templates**:
   - Click the settings button (⚙️) to access templates
   - Choose from predefined templates for common testing scenarios
   - Templates include login, registration, e-commerce, forms, APIs, and more

4. **Export and Copy**:
   - Use the "Copy to Clipboard" button to copy generated test cases
   - Export to CSV format for easy import into Jira or other tools
   - Paste directly into your Jira tickets

### Customization

- **Theme**: Toggle between dark and light modes using the theme button (🌙/☀️)
- **Compact Mode**: Enable compact mode in settings for a more condensed interface
- **Templates**: Load predefined templates for different testing scenarios

## API Key Security

- Your OpenAI API key is stored locally in your browser's localStorage
- The key is never transmitted to any server except OpenAI's official API
- You can change or remove your API key at any time using the "Change API Key" button

## Supported Image Formats

- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- WebP (.webp)

## Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

This creates a `dist` folder with all the necessary files for deployment.

### Project Structure

```
├── index.html          # Main web application page
├── main.js             # Core application logic
├── server.js           # Express server for serving the app
├── package.json        # Node.js dependencies and scripts
├── images/             # Application icons and assets
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
└── README.md           # This file
```

## Deployment

The application can be deployed to any platform that supports Node.js:

### Heroku
```bash
heroku create your-app-name
git push heroku main
```

### Vercel
```bash
npx vercel
```

### Docker
```dockerfile
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **API Key Issues**:
   - Ensure your OpenAI API key is valid and has access to GPT-4o
   - Check that you have sufficient credits in your OpenAI account
   - Verify the API key doesn't have any restrictions

2. **Image Upload Issues**:
   - Ensure images are in supported formats (PNG, JPG, JPEG, GIF)
   - Check that individual image files are not too large (recommended < 10MB)
   - Maximum of 9 images can be uploaded at once

3. **Network Issues**:
   - Check your internet connection
   - Ensure OpenAI's API (api.openai.com) is accessible from your network
   - Some corporate firewalls may block external API calls

### Error Messages

- **"API Key not configured"**: Enter your OpenAI API key in the settings
- **"Please enter a prompt"**: Add a description of what you want to test
- **"Maximum 9 images allowed"**: Remove some images before adding more
- **"Only image files are allowed"**: Ensure you're uploading image files only

## Requirements

- **OpenAI API Key**: Required for generating test cases
- **Modern Browser**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Internet Connection**: Required for API communication
- **Node.js**: Version 14.0.0 or higher for running the server

## Privacy & Security

- All data processing happens client-side in your browser
- Images and prompts are only sent to OpenAI's API for processing
- No user data is stored on any servers
- API keys are stored locally in your browser only

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues, questions, or feature requests, please:
- Open an issue on GitHub: https://github.com/Eswarr11/image-testcase-generator/issues
- Check the troubleshooting section above
- Ensure you're using a compatible browser and have a valid API key

## Changelog

### Version 1.0.0
- Initial web application release
- Converted from Chrome extension to standalone web app
- Added Express server for easy deployment
- Maintained all original functionality
- Added responsive design for mobile devices
- Enhanced error handling and user feedback