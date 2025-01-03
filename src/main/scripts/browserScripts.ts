export const BROWSER_SCRIPTS = {
  CHATGPT: `
    var textareaTag = document.querySelector('main div[id="prompt-textarea"]');
    textareaTag.textContent = TEXT_TO_SEND;
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      var buttons = document.querySelectorAll('main button[data-testid="send-button"]');
      if (buttons.length > 0) {
        buttons[buttons.length - 1].click();
      }
    }, 700);
  `,
  GEMINI: `
    var textareaTag = document.querySelector('main rich-textarea div[role="textbox"] p');
    textareaTag.textContent = TEXT_TO_SEND;
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      var sendButton = document.querySelector('main div.send-button-container button.send-button');
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
  CLAUDE: `
    var textareaTags = document.querySelectorAll('div[contenteditable="true"] p');
    var textareaTag = textareaTags[textareaTags.length - 1];
    if (textareaTag) {
      textareaTag.textContent = TEXT_TO_SEND;
      textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setTimeout(() => {
      var sendButton = document.querySelector('div[data-value="new chat"] button');
      if (!sendButton) {
        sendButton = document.querySelector('button[aria-label="Send Message"]');
      }
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
  PHIND: `
    var textareaTag = document.querySelector('main form textarea');
    textareaTag.textContent = TEXT_TO_SEND;
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      var sendButton = document.querySelector('main form button[type="submit"]');
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
  PERPLEXITY: `
    var textareaTags = document.querySelectorAll('main textarea');
    var textareaTag = textareaTags[textareaTags.length - 1];
    if (textareaTag) {
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      nativeTextAreaValueSetter.call(textareaTag, TEXT_TO_SEND);
      textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        var buttons = document.querySelectorAll('main button[aria-label="Submit"]');
        var sendButton = buttons[buttons.length - 1];
        if (sendButton) {
          sendButton.click();
        }
      }, 300);
    }
  `,
  GENSPARK: `
    var textareaTag = document.querySelector('.search-input') || document.querySelector('textarea[id="searchInput"]');
    textareaTag.value = TEXT_TO_SEND;
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      var sendButton = document.querySelector('div.input-icon') || document.querySelector('div.enter-icon-wrapper');
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
  AISTUDIO: `
    var textareaTag = document.querySelector('textarea[aria-label="User text input"]');
    textareaTag.value = TEXT_TO_SEND;
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      var sendButton = document.querySelector('button.run-button');
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
  FELO: `
    var forms = document.querySelectorAll('form');
    var lastForm = forms[forms.length - 1];
    var textareaTags = lastForm.querySelectorAll('textarea');
    var textareaTag = textareaTags[textareaTags.length - 1];
    textareaTag.textContent = TEXT_TO_SEND;
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      var buttons = lastForm.querySelectorAll('button');
      var sendButton = buttons[buttons.length - 1];
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
  JENOVA: `
    var textareaTag = document.querySelector('textarea[name="message"]');
    var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
    nativeTextAreaValueSetter.call(textareaTag, TEXT_TO_SEND);
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    
    setTimeout(() => {
      var siblingDivs = textareaTag.parentElement.querySelectorAll(':scope > div');
      var sendButton = siblingDivs[siblingDivs.length - 1];
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
} as const;