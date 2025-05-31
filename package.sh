#!/bin/bash

# Create a clean distribution directory
rm -rf dist
mkdir -p dist

# Copy all necessary files
cp -r manifest.json popup.html popup.js background.js images README.md dist/

# Create a zip file for Chrome Web Store submission
cd dist
zip -r ../jira-test-case-generator.zip *
cd ..

echo "Extension packaged successfully in jira-test-case-generator.zip" 