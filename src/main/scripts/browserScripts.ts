export const BROWSER_SCRIPTS = {
  CHATGPT: `
    var dataTransfer = new DataTransfer();
    dataTransfer.setData('text', TEXT_TO_SEND);
    var pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });

    var editorContent = document.querySelector('main div[id="prompt-textarea"]');
    editorContent.focus();
    editorContent.dispatchEvent(pasteEvent);

    setTimeout(() => {
      var buttons = document.querySelectorAll('main button[data-testid="send-button"]');
      if (buttons.length > 0) {
        buttons[buttons.length - 1].click();
      }
    }, 700);
  `,
  GEMINI: `
    try {
      console.log('Send to GEMINI');
      var textareaTag = document.querySelector('main div[contenteditable="true"]');
      const style = document.createElement('style');
      style.textContent = \`
      main div[contenteditable="true"]::before,
      main div[contenteditable="true"]::after {
        content: none !important;
        display: none !important;
      }
      \`;
      document.head.appendChild(style);
      
      textareaTag.textContent = TEXT_TO_SEND;
      textareaTag.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      setTimeout(() => {
        var sendButton = document.querySelector('main button.send-button');
        if (sendButton) {
          sendButton.click();
        }
      }, 700);
    } catch (error) {
      console.error('Error in GEMINI script:', error);
    }
  `,
  CLAUDE: `
    var textareaTags = document.querySelectorAll('div[contenteditable="true"] p');
    var textareaTag = textareaTags[textareaTags.length - 1];
    var dataTransfer = new DataTransfer();
    dataTransfer.setData('text', TEXT_TO_SEND);
    var pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });
    textareaTag.focus();
    textareaTag.dispatchEvent(pasteEvent);
    setTimeout(() => {
      var closedDivs = document.querySelectorAll('div[data-state="closed"]');
      if (closedDivs.length > 0) {
        var sendButtons = closedDivs[closedDivs.length - 1].querySelectorAll('button');
        var sendButton = sendButtons[sendButtons.length - 1];
        if (sendButton) {
          sendButton.click();
        }
      }
      console.log('closedDiv', closedDiv);
    }, 700);
  `,
  DEEPSEEK: `
    var textareaTag = document.querySelector('textarea[id="chat-input"]');
    var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
    nativeTextAreaValueSetter.call(textareaTag, TEXT_TO_SEND);
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    
    setTimeout(() => {
      var sendButtons = document.querySelectorAll('div[role="button"]');
      var sendButton = sendButtons[sendButtons.length - 1];
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
  GROK: `
    var textareaTags = document.querySelectorAll('main textarea');
    var textareaTag = textareaTags[textareaTags.length - 1];
    if (textareaTag) {
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      nativeTextAreaValueSetter.call(textareaTag, TEXT_TO_SEND);
      textareaTag.dispatchEvent(new Event('input', { bubbles: true }));

      setTimeout(() => {
        var buttons = Array.from(document.querySelectorAll('button[aria-label*="Grok"]'))
          .filter(button => button.getAttribute('aria-label') !== 'Grok 3 (beta)')
          .filter(button => button.getAttribute('aria-label') !== 'Grok 3');
        var sendButton = buttons.length > 0 ? buttons[buttons.length - 1] : null;
        if (sendButton) {
          sendButton.click();
        }
      }, 300);
    }
  `,
  PHIND: `
    var dataTransfer = new DataTransfer();
    dataTransfer.setData('text', TEXT_TO_SEND);

    var pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });

    var editorContent = document.querySelector('.public-DraftEditor-content');
    editorContent.focus();
    editorContent.dispatchEvent(pasteEvent);

    setTimeout(() => {
      var enterKeydownEvent = new KeyboardEvent('keydown', {
        key: 'Enter',    // 重要
        code: 'Enter',   // 重要
        which: 13,       // 一部レガシー
        keyCode: 13,     // 一部レガシー
        bubbles: true,   // イベントをバブルさせる
        cancelable: true
      });

      // keydown -> keyup など、連続イベントを投げる場合
      editorContent.dispatchEvent(enterKeydownEvent);

      var enterKeyupEvent = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        which: 13,
        keyCode: 13,
        bubbles: true,
        cancelable: true
      });

      editorContent.dispatchEvent(enterKeyupEvent);
    }, 1000);
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
    var textareaTag = document.querySelector('textarea[aria-label="Type something"]');
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
  CODY: `
    var textAreaTags = document.querySelectorAll('div[data-lexical-editor="true"]');
    console.log(textAreaTags);
    var textareaTag = textAreaTags[textAreaTags.length - 1];

    // Lexicalエディタのインスタンスを取得
    var editor = textareaTag.__lexicalEditor;
    console.log(editor);
    if (editor) {
      // 新しい状態をJSONとして構築
      const state = {
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text: TEXT_TO_SEND,
                  type: "text",
                  version: 1
                }
              ],
              direction: "ltr",
              format: "",
              indent: 0,
              type: "paragraph",
              version: 1
            }
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "root",
          version: 1
        }
      };

      const editorState = editor.parseEditorState(JSON.stringify(state));
      editor.setEditorState(editorState);
      
      // 入力イベントをディスパッチ
      textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    setTimeout(() => {
      var sendButtons = document.querySelectorAll('button[type="submit"]');
      console.log(sendButtons);
      var sendButton = sendButtons[sendButtons.length - 1];
      if (sendButton) {
        sendButton.click();
      }
    }, 100);
  `,
} as const;
