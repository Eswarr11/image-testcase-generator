// Import the correct default export from the module
const translate = require('@vitalets/google-translate-api').default;

async function testTranslation() {
  console.log('🔧 Testing Google Translate API...\n');

  try {
    console.log('Attempting to translate "hello" to Hindi...');

    const result = await translate('hello', { from: 'en', to: 'hi' });

    console.log('✅ Success!');
    console.log('Original:', 'hello');
    console.log('Translated:', result.text);
    console.log('Detected language:', result.from.language.iso);

  } catch (error) {
    console.log('❌ Error details:');
    console.log('Error message:', error.message);
    console.log('Error code:', error.code);
    console.log('Full error:', error);
  }
}

testTranslation();
