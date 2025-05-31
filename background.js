// Store a reference to the window object
let popupWindow = null;

// Function to open the popup window
function openPopup() {
  // If a popup window is already open, focus it
  if (popupWindow && !popupWindow.closed) {
    popupWindow.focus();
    return;
  }

  // Get the popup URL
  const popupURL = chrome.runtime.getURL('popup.html');

  // Open a new popup window
  chrome.windows.create({
    url: popupURL,
    type: 'popup',
    width: 450,
    height: 680,
    focused: true
  }, (window) => {
    popupWindow = window;
  });
}

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener(openPopup); 