#!/bin/bash

# Jira Test Case Generator - Build Script
# This script builds and packages the Chrome extension

echo "Building Jira Test Case Generator Chrome Extension..."

# Clean previous builds
npm run clean

# Build the extension
npm run build

# Package for Chrome Web Store
npm run package

echo "✅ Extension packaged successfully!"
echo "📦 File: jira-test-case-generator.zip"
echo "🚀 Ready for Chrome Web Store upload" 