# Jira Test Case Generator

A modern TypeScript web application with React frontend that uses OpenAI's GPT-4o capabilities to generate comprehensive Jira test cases from prompts and optional images.

## 🚀 Features

- **TypeScript Backend & Frontend**: Full TypeScript implementation for better type safety
- **React with Tailwind CSS**: Modern, responsive UI with beautiful styling
- **OpenAI GPT-4o Integration**: Generate comprehensive test cases using AI
- **Image Analysis**: Upload up to 9 images for context-aware test case generation
- **Dark/Light Theme**: Automatic theme switching with system preference detection
- **Export Functionality**: Export test cases to CSV format
- **Real-time Validation**: API key validation and error handling
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🛠️ Tech Stack

### Backend
- **TypeScript** - Type-safe server-side code
- **Express.js** - Web framework
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Compression** - Response compression

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe client-side code
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and dev server
- **Lucide React** - Beautiful icons
- **React Dropzone** - Drag & drop file uploads

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- OpenAI API Key

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Eswarr11/image-testcase-generator.git
   cd image-testcase-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This will install both server and client dependencies automatically.

3. **Build the application**
   ```bash
   npm run build
   ```

## 🚀 Running the Application

### Development Mode (Recommended)
Start both server and client in development mode:
```bash
npm run dev
```
This will start:
- Backend server on `http://localhost:3000`
- Frontend dev server on `http://localhost:5173`

### Production Mode
Build and start the production server:
```bash
npm run build
npm start
```
Access the application at `http://localhost:3000`

### Individual Commands
- **Server only**: `npm run dev:server`
- **Client only**: `npm run dev:client`
- **Build server**: `npm run build:server`
- **Build client**: `npm run build:client`

## 🔑 Configuration

1. **Get OpenAI API Key**
   - Go to [OpenAI API](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key (starts with `sk-`)

2. **Configure in Application**
   - Open the web application
   - Enter your API key in the configuration section
   - The key is stored locally in your browser

## 📖 Usage

1. **Enter API Key**: Configure your OpenAI API key in the application
2. **Write Prompt**: Describe the functionality you want to test
3. **Upload Images** (Optional): Add up to 9 screenshots or mockups
4. **Generate**: Click "Generate Test Case" to create comprehensive test cases
5. **Export**: Copy to clipboard or export as CSV

### Example Prompts
- "Test the login functionality with valid and invalid credentials"
- "Test the shopping cart checkout process with different payment methods"
- "Test the user registration form validation"

## 🎨 Features in Detail

### Test Case Generation
- **Comprehensive Structure**: ID, Title, Description, Pre-conditions, Steps, Expected Results, Priority
- **Multiple Scenarios**: Positive, negative, and edge cases
- **Context-Aware**: Uses uploaded images for better understanding
- **Professional Format**: Ready for Jira import

### Image Analysis
- **Multiple Formats**: PNG, JPG, JPEG, GIF, WebP
- **Smart Processing**: High-quality image analysis
- **Preview Interface**: Visual confirmation of uploaded images
- **Easy Management**: Add/remove images with simple controls

### User Experience
- **Real-time Feedback**: Toast notifications for all actions
- **Error Handling**: Comprehensive error messages and recovery
- **Responsive Design**: Works on all device sizes
- **Accessibility**: Keyboard navigation and screen reader support

## 🐛 Debugging

### VS Code Integration
The project includes VS Code configurations for debugging:

1. **Launch TypeScript Server**: Debug the backend in development mode
2. **Launch Compiled Server**: Debug the production build
3. **Debug React App**: Debug the frontend in Chrome
4. **Attach to Server**: Attach debugger to running server

### Available Tasks
- **dev**: Start development servers
- **build**: Build both server and client
- **type-check**: Run TypeScript type checking
- **lint**: Run ESLint on all files

## 🔒 Security

- **API Key Storage**: Keys are stored locally in browser, never on servers
- **Direct API Calls**: All OpenAI requests go directly from browser to OpenAI
- **Security Headers**: Helmet.js provides comprehensive security headers
- **Input Validation**: All inputs are validated and sanitized
- **CORS Protection**: Configured for development and production environments

## 📁 Project Structure

```
├── src/                          # TypeScript server source
│   └── server.ts                 # Express server
├── client/                       # React application
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── contexts/            # React contexts
│   │   ├── types/               # TypeScript types
│   │   ├── App.tsx              # Main App component
│   │   ├── main.tsx             # React entry point
│   │   └── index.css            # Global styles
│   ├── public/                  # Static assets
│   ├── tsconfig.json            # Client TypeScript config
│   └── vite.config.ts           # Vite configuration
├── .vscode/                     # VS Code configurations
├── dist/                        # Built server files
├── tsconfig.json                # Server TypeScript config
└── package.json                 # Root package.json
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Eswar A**
- GitHub: [@Eswarr11](https://github.com/Eswarr11)

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](https://github.com/Eswarr11/image-testcase-generator/issues) page
2. Create a new issue with detailed information
3. Include error messages, browser console logs, and steps to reproduce

## 🔄 Changelog

### Version 2.0.0
- **Complete Rewrite**: Migrated from vanilla JavaScript to TypeScript
- **React Frontend**: Modern React application with Tailwind CSS
- **Enhanced UI/UX**: Beautiful, responsive design with dark/light themes
- **Better Architecture**: Modular components and contexts
- **Improved Error Handling**: Comprehensive error management
- **VS Code Integration**: Full debugging support

### Version 1.0.0
- Initial release with vanilla JavaScript and HTML
- Basic OpenAI integration
- Image upload functionality
- CSV export capabilities