export const BROWSER_SCRIPTS = {
  CHATGPT: `
    (function () {
      var text = TEXT_TO_SEND;
      // ログイン時: form 内の ProseMirror（旧UIは #prompt-textarea）、未ログイン時: textarea[name="prompt"]
      var editor =
        document.querySelector('main form div.ProseMirror[contenteditable="true"]') ||
        document.querySelector('main #prompt-textarea') ||
        document.querySelector('main textarea[name="prompt"]');
      if (!editor) {
        console.log('ChatGPT: editor not found');
        return;
      }

      editor.focus();
      if (editor.tagName === 'TEXTAREA') {
        var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        ).set;
        nativeTextAreaValueSetter.call(editor, text);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        var dataTransfer = new DataTransfer();
        dataTransfer.setData('text', text);
        editor.dispatchEvent(new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true
        }));
      }

      // 送信ボタンは入力後に出現する。生成中の停止ボタンは type="button" なので対象外
      var scope = editor.closest('form') || document.querySelector('main') || document;
      var selectors = [
        'button[data-testid="send-button"]',
        '#composer-submit-button',
        'button[data-composer-submit]',
        'button[type="submit"]'
      ];
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        var sendButton = null;
        for (var i = 0; i < selectors.length && !sendButton; i++) {
          sendButton = scope.querySelector(selectors[i]);
        }
        if (sendButton && !sendButton.disabled && sendButton.getAttribute('aria-disabled') !== 'true') {
          clearInterval(timer);
          sendButton.click();
        } else if (tries >= 50) {
          clearInterval(timer);
          console.log('ChatGPT: send button not found');
        }
      }, 100);
    })();
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
        var sendButton = document.querySelector('button.send-button') || document.querySelector('button[aria-label="プロンプトを送信"]');
        if (sendButton) {
          sendButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          sendButton.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
      // data-state="closed" だけを持つ <div> をまず厳密に抽出
      var allClosedDivs = Array.from(document.querySelectorAll('div[data-state="closed"]')).filter(function (el) {
        // この要素が持つ属性名の一覧を取得し、'data-state' のみを許容
        var attrNames = el.getAttributeNames();
        return attrNames.length === 1 && attrNames[0] === 'data-state' && el.getAttribute('data-state') === 'closed';
      });

      // 祖先に <main> を持つ要素のみを優先
      var closedDivsInMain = allClosedDivs.filter(function (el) {
        // closest('main') が見つかれば true（= <main> 配下）
        return !!el.closest('main');
      });

      // <main> 配下の候補があればそれを、無ければ全件を採用
      var closedDivs = closedDivsInMain.length > 0 ? closedDivsInMain : allClosedDivs;

      if (closedDivs.length > 0) {
        var sendButtons = closedDivs[closedDivs.length - 1].querySelectorAll('button');
        var sendButton = sendButtons[sendButtons.length - 1];
        if (sendButton) {
          sendButton.click();
        }
      }
      console.log('closedDivs', closedDivs);
    }, 700);
  `,
  DEEPSEEK: `
    var textareaTags = document.querySelectorAll('textarea');
    var textareaTag = textareaTags[textareaTags.length - 1];
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
    if (textareaTag) {
      setTimeout(() => {
        var buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
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
    var dataTransfer = new DataTransfer();
    var text = TEXT_TO_SEND;
    dataTransfer.setData('text', text);
    var pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });

    var textareaTag = null;
    var textareaTags = document.querySelectorAll('div[contenteditable="true"] p');
    if (textareaTags.length == 0) {
      textareaTags = document.querySelectorAll('textarea[id="ask-input"]');
      var textareaTag = textareaTags[textareaTags.length - 1];
      if (textareaTag) {
        textareaTag.value = text;
        textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    console.log(textareaTags);
    var textareaTag = textareaTags[textareaTags.length - 1];
    if (textareaTag) {
      textareaTag.focus();
      textareaTag.dispatchEvent(pasteEvent);

      setTimeout(() => {
        var buttons = document.querySelectorAll('button[aria-label="Submit"], button[aria-label="送信"]');
        var sendButton = buttons[buttons.length - 1];
        if (sendButton) {
          sendButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          sendButton.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      }, 300);
    } else {
      console.log('No textarea tag found');
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
    var textareaTag = document.querySelector('textarea');
    textareaTag.value = TEXT_TO_SEND;
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      var sendButton = document.querySelector('button[type="submit"]') || document.querySelector('button.run-button');
      if (sendButton) {
        sendButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        sendButton.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
  NANI: `
    (function () {
      // トップページ: #basic-input-main、翻訳結果ページ: #basic-input-form
      var textareaTag =
        document.querySelector('textarea[data-main-input="true"]') ||
        document.querySelector('textarea[id^="basic-input"]');
      if (!textareaTag) {
        // aria-hidden の textarea は自動リサイズ用のダミーなので除外
        var textareas = document.querySelectorAll('textarea:not([aria-hidden="true"])');
        textareaTag = textareas[textareas.length - 1];
      }
      if (!textareaTag) {
        console.log('Nani: textarea not found');
        return;
      }

      var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      ).set;
      nativeTextAreaValueSetter.call(textareaTag, TEXT_TO_SEND);
      textareaTag.dispatchEvent(new Event('input', { bubbles: true }));

      // textarea から祖先をたどり、最も近い送信ボタンを探す
      function findLabeledButton() {
        var el = textareaTag.parentElement;
        for (var depth = 0; el && depth < 6; depth++, el = el.parentElement) {
          var button = el.querySelector('button[aria-label="送信"], button[aria-label="Send"]');
          if (button) return button;
        }
        return null;
      }

      // ラベルで見つからない言語向けのフォールバック: 最も近い祖先内の最後の submit ボタン
      function findLastSubmitButton() {
        var el = textareaTag.parentElement;
        for (var depth = 0; el && depth < 6; depth++, el = el.parentElement) {
          var submits = Array.from(el.querySelectorAll('button')).filter(function (b) {
            return b.type === 'submit';
          });
          if (submits.length > 0) return submits[submits.length - 1];
        }
        return null;
      }

      // 送信ボタンは入力が反映されるまで disabled なので、有効になるまで待つ
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        var sendButton = findLabeledButton();
        if (!sendButton && tries >= 30) {
          sendButton = findLastSubmitButton();
        }
        if (sendButton && !sendButton.disabled) {
          clearInterval(timer);
          sendButton.click();
        } else if (tries >= 50) {
          clearInterval(timer);
          console.log('Nani: send button not found');
        }
      }, 100);
    })();
  `,
  SAKANA: `
    var textareaTag = document.querySelector('form textarea');
    var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set;
    nativeTextAreaValueSetter.call(textareaTag, TEXT_TO_SEND);
    textareaTag.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      var sendButton = document.querySelector('form button[type="submit"]');
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
  KIMI: `
    var textareaTag = document.querySelector('div.chat-input-editor');
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
      var sendButton = document.querySelector('div.send-button-container');
      if (sendButton) {
        sendButton.click();
      }
    }, 700);
  `,
} as const;
