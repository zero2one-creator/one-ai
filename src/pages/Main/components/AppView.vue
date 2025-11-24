<template>
  <div class="app-view" @mousedown="handleActivatePane">
    <div
      class="app-view-header"
      :class="{ 'is-active': isActive }"
      draggable="true"
      @dragstart="handleDragStart"
      @dragover.prevent="handleDragOver"
      @drop="handleDrop"
    >
      <div class="header-left">
        <div class="header-main">
          <span v-if="isActive" class="header-active-dot"></span>
          <img
            v-if="tab && tab.app.logo"
            :src="tab.app.logo"
            :alt="tab.title"
            class="header-icon"
          />
          <span class="header-title">{{ tab?.title || "空白面板" }}</span>
        </div>
        <button
          v-if="tab"
          class="action-btn nav-btn"
          @click="handleBack"
          title="后退"
        >
          ←
        </button>
        <button
          v-if="tab"
          class="action-btn nav-btn"
          @click="handleForward"
          title="前进"
        >
          →
        </button>
        <button
          v-if="tab"
          class="action-btn refresh-btn"
          @click="handleRefresh"
          title="刷新页面"
        >
          ↻
        </button>
      </div>
      <div class="header-actions">
        <button
          class="action-btn"
          @click="handleClose"
          title="关闭"
          v-if="canClose"
        >
          ×
        </button>
      </div>
    </div>
    <div v-if="tab" class="app-view-content">
      <webview
        ref="webviewRef"
        :data-minapp-id="tab.app.id"
        allowpopups="true"
        partition="persist:webview"
        class="webview"
        :src="tab.app.url"
        nodeintegration="false"
        webpreferences="contextIsolation=yes, enableRemoteModule=no"
      ></webview>
    </div>
    <div v-else class="app-view-content empty">
      <div class="empty-content">
        <p>选择一个应用开始使用</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useAppStore } from "../../../store/appStore";
import type { AppSearchConfig } from "../../../store/appStore";
import { APP_NEW_SESSION_SELECTORS } from "../../../const/defaultConfig";

interface Props {
  tabId: string | null;
  paneId: string;
  canClose?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  canClose: false,
});

const appStore = useAppStore();
const webviewRef = ref<HTMLElement | null>(null);

const isActive = computed(() => appStore.getActivePaneId === props.paneId);

const tab = computed(() => {
  if (!props.tabId) return null;
  return appStore.getTabs.find((t: any) => t.id === props.tabId) || null;
});

const handleClose = (e: MouseEvent) => {
  e.stopPropagation();
  if (props.canClose) {
    appStore.closePane(props.paneId);
  }
};

const handleActivatePane = () => {
  appStore.setActivePane(props.paneId);
};

const handleWebviewActivate = () => {
  appStore.setActivePane(props.paneId);
};

const handleBack = () => {
  const webview = webviewRef.value as any;
  if (
    webview &&
    typeof webview.canGoBack === "function" &&
    typeof webview.goBack === "function" &&
    webview.canGoBack()
  ) {
    webview.goBack();
  }
};

const handleForward = () => {
  const webview = webviewRef.value as any;
  if (
    webview &&
    typeof webview.canGoForward === "function" &&
    typeof webview.goForward === "function" &&
    webview.canGoForward()
  ) {
    webview.goForward();
  }
};

const handleRefresh = () => {
  const webview = webviewRef.value as any;
  if (webview && webview.reload) {
    webview.reload();
  }
};

// 拖拽 header 改变 panel 顺序
const handleDragStart = (e: DragEvent) => {
  e.dataTransfer?.setData("text/plain", props.paneId);
};

const handleDragOver = (_e: DragEvent) => {
  // 只需要阻止默认行为以允许 drop（.prevent 已在模板中处理）
};

const handleDrop = (e: DragEvent) => {
  const sourceId = e.dataTransfer?.getData("text/plain");
  if (!sourceId || sourceId === props.paneId) return;
  appStore.movePane(sourceId, props.paneId);
};

// 监听刷新事件
const handleRefreshEvent = (event: CustomEvent) => {
  const { paneId } = event.detail || {};
  if (paneId === props.paneId) {
    handleRefresh();
  }
};

// 生成搜索注入脚本
const generateSearchScript = (
  searchText: string,
  config: AppSearchConfig
): string => {
  const escapedText = JSON.stringify(searchText);
  const { inputSelector, submitSelector, submitMethod = "enter" } = config;

  return `
    (async function() {
      const startTime = Date.now();
      try {
        console.log('🚀 搜索脚本开始执行，搜索内容:', ${escapedText});
        console.log('📍 当前 URL:', window.location.href);
        console.log('📍 document.readyState:', document.readyState);
        
        // 查找输入框（尝试多个选择器）
        const selectors = ${JSON.stringify(
          inputSelector.split(",").map((s) => s.trim())
        )};
        let input = null;
        for (const selector of selectors) {
          input = document.querySelector(selector);
          if (input) {
            console.log('✅ 找到输入框，选择器:', selector);
            break;
          }
        }
        if (!input) {
          console.warn('❌ 未找到输入框，尝试的选择器:', selectors);
          return;
        }

        console.log('找到输入框:', input.tagName, input.className);

        // 设置输入值
        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
          console.log('🔧 设置 textarea/input 的值...');
          
          const text = ${escapedText};
          
          // 关键：使用 React Native Setter（绕过框架检测）
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          ).set;
          
          // 先聚焦输入框
          input.focus();
          
          // 使用 native setter 设置值
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, text);
          } else {
            input.value = text;
          }
          
          // 触发 input 事件（必须用 InputEvent，带 inputType 和 data）
          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text
          });
          input.dispatchEvent(inputEvent);
          
          // 再触发一个简单的 input 事件（确保兼容性）
          input.dispatchEvent(new Event('input', { bubbles: true }));
          
          // 触发 change 事件
          input.dispatchEvent(new Event('change', { bubbles: true }));
          
          console.log('✅ textarea 值已设置，当前值:', input.value);
        } else if (input.isContentEditable || input.contentEditable === 'true') {
          // 对于 contenteditable 元素，使用多种方式尝试设置内容
          console.log('🔧 开始设置 contenteditable 内容...');
          
          const text = ${escapedText};
          
          // 方法1: 使用 textContent（避免 Trusted Types 限制）
          try {
            input.textContent = text;
            console.log('方法1 - textContent 设置后:', input.textContent);
          } catch (e) {
            console.warn('⚠️ textContent 设置失败:', e);
          }
          
          // 方法2: 如果 textContent 失败，尝试使用 DOM 操作
          if (!input.textContent || input.textContent.trim() === '') {
            console.log('方法1失败，尝试方法2 - DOM 操作...');
            try {
              // 清空内容
              while (input.firstChild) {
                input.removeChild(input.firstChild);
              }
              // 创建文本节点并添加
              const textNode = document.createTextNode(text);
              input.appendChild(textNode);
              console.log('方法2 - DOM 操作后:', input.textContent);
            } catch (e) {
              console.warn('⚠️ DOM 操作失败:', e);
            }
          }
          
          // 方法3: 如果还是失败，尝试使用 innerText
          if (!input.textContent || input.textContent.trim() === '') {
            console.log('方法2失败，尝试方法3 - innerText...');
            try {
              input.innerText = text;
              console.log('方法3 - innerText 设置后:', input.innerText);
            } catch (e) {
              console.warn('⚠️ innerText 设置失败:', e);
            }
          }
          
          // 聚焦输入框
          input.focus();
          
          // 设置光标到末尾
          try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(input);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            console.log('✅ 光标已设置到末尾');
          } catch (e) {
            console.warn('⚠️ 设置光标失败:', e);
          }
          
          // 触发输入事件（延迟一点，确保内容已设置）
          setTimeout(() => {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new InputEvent('input', { 
              bubbles: true, 
              cancelable: true,
              data: text
            }));
            console.log('✅ 已触发 input 事件');
          }, 50);
          
          console.log('✅ 最终 contenteditable 内容:', input.textContent || input.innerText);
        }

        // 提交搜索
        if (${submitMethod === "click" && submitSelector ? "true" : "false"}) {
          // 等待更长时间，确保输入内容已经设置好，且按钮状态已更新
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const submitSelectors = ${
            submitSelector
              ? JSON.stringify(submitSelector.split(",").map((s) => s.trim()))
              : "[]"
          };
          let submitBtn = null;
          
          // 多次尝试查找按钮（因为按钮可能需要时间从 disabled 变为可用）
          for (let attempt = 0; attempt < 5 && !submitBtn; attempt++) {
            if (attempt > 0) {
              console.log(\`🔄 第 \${attempt + 1} 次尝试查找发送按钮...\`);
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // 尝试使用选择器查找
            for (const selector of submitSelectors) {
              const elements = document.querySelectorAll(selector);
              
              // 智能筛选：查找包含"发送"、"提交"、"Send"等文本的按钮，或者纯图标按钮
              for (const el of elements) {
                const text = el.textContent?.trim() || '';
                const ariaLabel = el.getAttribute('aria-label') || '';
                const isDisabled = el.disabled || el.getAttribute('disabled') !== null;
                const hasSvg = el.querySelector('svg') !== null;
                
                // 判断是否为发送按钮：
                // 1. 文本包含关键词
                // 2. 或者是纯图标按钮（有 SVG 且文本为空）
                const isSubmitButton = (
                  text.includes('发送') || 
                  text.includes('提交') || 
                  text.includes('Send') ||
                  text.includes('Submit') ||
                  ariaLabel.includes('发送') ||
                  ariaLabel.includes('Send') ||
                  (hasSvg && text === '')  // 纯图标按钮
                );
                
                if (isSubmitButton) {
                  // 检查按钮的背景色类（判断是否激活）
                  const isActive = el.className.includes('bg-content-primary') || el.className.includes('bg-blue');
                  const isGray = el.className.includes('bg-fill-gray') || el.className.includes('bg-gray');
                  
                  // 优先选择激活状态且未禁用的按钮
                  if (!isDisabled && isActive) {
                    submitBtn = el;
                    console.log('✅ 找到发送按钮:', text || '(图标按钮)', 'disabled:', isDisabled, 'hasSvg:', hasSvg);
                    break;
                  } else if (!isDisabled && !isGray && !submitBtn) {
                    // 次选：未禁用且不是灰色的按钮
                    submitBtn = el;
                  }
                }
              }
              if (submitBtn) break;
            }
          }
          
          if (submitBtn) {
            console.log('🖱️ 点击发送按钮');
            // 尝试多种点击方式
            submitBtn.click();
            // 延迟触发 dispatchEvent 确保兼容性
            setTimeout(() => {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              submitBtn.dispatchEvent(clickEvent);
            }, 100);
          } else {
            console.warn('⚠️ 未找到发送按钮，尝试使用回车键提交');
            // 如果找不到按钮，尝试用回车键
            input.focus();
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              shiftKey: false,
              bubbles: true,
              cancelable: true,
              composed: true
            });
            input.dispatchEvent(enterEvent);
          }
        } else {
          // 使用回车键提交
          await new Promise(resolve => setTimeout(resolve, 300));
          
          console.log('触发回车键提交');
          input.focus();
          
          // 尝试 form 提交
          const form = input.closest('form');
          if (form && form.requestSubmit) {
            try {
              form.requestSubmit();
            } catch (e) {
              console.warn('⚠️ form 提交失败，使用回车键:', e);
            }
          }
          
          // 触发回车键事件
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: false,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          input.dispatchEvent(enterEvent);
          
          const enterEvent2 = new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: false,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          input.dispatchEvent(enterEvent2);
          
          const enterEvent3 = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: false,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          input.dispatchEvent(enterEvent3);
        }
        
        // OpenAI/ChatGPT: 会话 ID 目前仅用于日志，这里先保留 URL 即可
        let conversationId = null;
        let finalUrl = window.location.href;
        
        const endTime = Date.now();
        const result = {
          success: true,
          searchText: ${escapedText},
          executionTime: endTime - startTime,
          foundInput: !!input,
          inputType: input ? (input.tagName + '.' + input.className) : null,
          url: finalUrl,
          conversationId: conversationId,
          submitMethod: ${JSON.stringify(submitMethod)},
          submitAttempted: ${
            submitMethod === "click" && submitSelector ? "true" : "false"
          }
        };
        console.log('✅ 搜索脚本执行完成:', result);
        return result;
      } catch (error) {
        console.error('❌ 搜索脚本执行失败:', error);
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    })();
  `;
};

// 执行搜索
const executeSearch = async (
  searchText: string,
  config: AppSearchConfig
): Promise<void> => {
  console.log("🎯 [AppView] executeSearch 被调用:", {
    searchText,
    config,
    paneId: props.paneId,
    tabId: props.tabId,
    hasWebview: !!webviewRef.value,
  });

  const webview = webviewRef.value as any;
  if (!webview) {
    console.warn("⚠️ [AppView] Webview 未找到");
    return;
  }

  try {
    const script = generateSearchScript(searchText, config);
    console.log("📝 [AppView] 生成的脚本长度:", script.length);

    // 检查 webview 是否已加载
    const isLoading =
      webview.isLoading && typeof webview.isLoading === "function"
        ? webview.isLoading()
        : false;
    console.log("🔄 [AppView] webview 加载状态:", isLoading);

    if (!isLoading) {
      // 已加载完成，直接执行
      console.log("✅ [AppView] webview 已加载，直接执行脚本");
      try {
        const result = await webview.executeJavaScript(script);
        console.log("✅ [AppView] 脚本执行完成，返回值:", result);
      } catch (err) {
        console.error("❌ [AppView] 脚本执行出错:", err);
        throw err;
      }
    } else {
      // 等待加载完成
      console.log("⏳ [AppView] webview 正在加载，等待完成...");
      const executeWhenReady = () => {
        console.log("🚀 [AppView] 执行搜索脚本...");
        webview
          .executeJavaScript(script)
          .then((result: any) => {
            console.log("✅ [AppView] 脚本执行完成（延迟），返回值:", result);
          })
          .catch((err: any) => {
            console.error("❌ [AppView] 执行搜索脚本失败:", err);
          });
      };

      if (webview.addEventListener) {
        const handler = () => {
          console.log("✅ [AppView] webview 加载完成事件触发");
          executeWhenReady();
          webview.removeEventListener("did-finish-load", handler);
        };
        webview.addEventListener("did-finish-load", handler);

        // 如果已经加载完成，立即执行
        setTimeout(() => {
          const stillLoading =
            webview.isLoading && typeof webview.isLoading === "function"
              ? webview.isLoading()
              : false;
          if (!stillLoading) {
            console.log("✅ [AppView] 延迟检查：webview 已加载完成");
            executeWhenReady();
            webview.removeEventListener("did-finish-load", handler);
          }
        }, 500);
      } else {
        // 如果没有事件监听器，延迟执行
        console.log("⏰ [AppView] 没有事件监听器，延迟执行");
        setTimeout(executeWhenReady, 1000);
      }
    }
  } catch (error) {
    console.error("❌ [AppView] 执行搜索失败:", error);
  }
};

// 生成新建会话注入脚本
/**
 * 生成注入到 webview 中的新建会话脚本
 * 从配置文件中读取选择器，支持多种选择器类型
 */
const generateNewSessionScript = (appId: string): string => {
  // 从配置文件中获取选择器（如果没有配置，使用默认值）
  const selectors =
    APP_NEW_SESSION_SELECTORS[appId] || APP_NEW_SESSION_SELECTORS.default;

  return `
    (async function() {
      try {
        // 辅助函数：向上查找可点击的父元素
        function findClickableParent(element, maxDepth = 10) {
          let current = element;
          let depth = 0;
          
          while (current && depth < maxDepth) {
            const style = window.getComputedStyle(current);
            const isClickable = 
              current.tagName === 'BUTTON' ||
              current.tagName === 'A' ||
              current.getAttribute('role') === 'button' ||
              current.onclick !== null ||
              style.cursor === 'pointer' ||
              current.getAttribute('data-testid') ||
              current.hasAttribute('data-v-') ||
              current.hasAttribute('data-spm-click');
            
            if (isClickable) {
              return current;
            }
            
            current = current.parentElement;
            depth++;
          }
          
          return null;
        }
        
        // 尝试查找新建会话按钮
        const selectors = ${JSON.stringify(selectors)};
        let button = null;
        
        for (const selector of selectors) {
          // 处理 :navigate-to() 伪选择器（直接导航到指定路径）
          if (selector.includes(':navigate-to(')) {
            const match = selector.match(/:navigate-to\\("([^"]+)"\\)/);
            if (match) {
              const [, path] = match;
              const currentOrigin = window.location.origin;
              const targetUrl = currentOrigin + path;
              window.location.href = targetUrl;
              return { success: true, message: '通过导航创建新会话' };
            }
          }
          // 处理 :has() 伪选择器（手动实现）
          else if (selector.includes(':has(')) {
            const match = selector.match(/^(\w+):has\(([^)]+)\)$/);
            if (match) {
              const [, tag, innerSelector] = match;
              const candidates = Array.from(document.querySelectorAll(tag));
              const element = candidates.find(el => el.querySelector(innerSelector));
              
              if (element) {
                button = findClickableParent(element) || element;
                if (button) break;
              }
            }
          }
          // 处理 :scope-text 伪选择器（查找包含指定文本的元素及其可点击父元素）
          else if (selector.includes(':scope-text')) {
            const match = selector.match(/:scope-text\\("([^"]+)"\\)/);
            if (match) {
              const [, text] = match;
              
              // 查找包含文本的所有元素
              const allElements = Array.from(document.querySelectorAll('*'));
              const matchingElements = allElements.filter(el => {
                // 只匹配直接文本内容或仅有少量子元素的元素
                const directText = Array.from(el.childNodes)
                  .filter(node => node.nodeType === Node.TEXT_NODE)
                  .map(node => node.textContent?.trim())
                  .join('');
                return el.textContent?.trim() === text || directText === text;
              });
              
              // 优先选择可见的元素
              const targetElement = matchingElements.find(el => 
                el.offsetWidth > 0 && el.offsetHeight > 0
              ) || matchingElements[0];
              
              if (targetElement) {
                button = findClickableParent(targetElement) || targetElement;
                if (button) break;
              }
            }
          } 
          // 处理 :has-text 伪选择器（兼容旧版）
          else if (selector.includes(':has-text')) {
            const match = selector.match(/^(\\w+):has-text\\("([^"]+)"\\)$/);
            if (match) {
              const [, tag, text] = match;
              const elements = Array.from(document.querySelectorAll(tag));
              button = elements.find(el => el.textContent?.includes(text));
              if (button) break;
            }
          } 
          // 普通 CSS 选择器（包括 button.class, .class, #id, [attr] 等）
          else {
            try {
              const element = document.querySelector(selector);
              if (element) {
                // 如果元素本身不可点击，向上查找可点击的父元素（最多5层）
                button = findClickableParent(element, 5);
                if (button) break;
              }
            } catch (error) {
              console.warn('选择器错误:', selector, error.message);
            }
          }
        }
        
        if (!button) {
          // 检查是否有 :fallback-navigate 备选方案
          const fallbackNavigate = selectors.find(s => s.includes(':fallback-navigate('));
          if (fallbackNavigate) {
            const match = fallbackNavigate.match(/:fallback-navigate\\("([^"]+)"\\)/);
            if (match) {
              const [, path] = match;
              const targetUrl = window.location.origin + path;
              window.location.href = targetUrl;
              return { success: true, message: '通过备选导航创建新会话' };
            }
          }
          
          // 千问特殊处理：如果找不到按钮，尝试导航到 /chat 页面（新建会话）
          if ('${appId}' === 'dashscope') {
            const currentUrl = window.location.href;
            if (currentUrl.includes('/chat/')) {
              window.location.href = window.location.origin + '/chat';
              return { success: true, message: '通过导航创建新会话' };
            }
          }
          
          return { success: false, message: '未找到新建会话按钮' };
        }
        
        button.click();
        return { success: true };
      } catch (error) {
        console.error('❌ 新建会话失败:', error);
        return { success: false, message: error.message };
      }
    })();
  `;
};

// 执行新建会话
/**
 * 执行新建会话操作
 *
 * 向 webview 注入 JavaScript 脚本，自动查找并点击"新建会话"按钮
 * 脚本会根据不同的 AI 应用使用不同的选择器策略
 */
const executeNewSession = async () => {
  const webview = webviewRef.value as any;
  if (!webview || !tab.value) {
    return;
  }

  try {
    // 等待 webview 加载完成（避免在页面未加载时执行脚本）
    const isLoading = webview.isLoading();
    if (isLoading) {
      await new Promise<void>((resolve) => {
        const loadHandler = () => {
          webview.removeEventListener("did-finish-load", loadHandler);
          resolve();
        };
        webview.addEventListener("did-finish-load", loadHandler);
        // 设置超时避免无限等待
        setTimeout(() => {
          webview.removeEventListener("did-finish-load", loadHandler);
          resolve();
        }, 5000);
      });
    }

    // 生成并执行新建会话脚本
    const script = generateNewSessionScript(tab.value.app.id);
    const result = await webview.executeJavaScript(script);

    if (result && !result.success) {
      console.error("[AppView] 新建会话失败:", result.message);
    }
  } catch (error) {
    console.error("[AppView] 新建会话失败:", (error as Error).message);
  }
};

/**
 * 处理全局新建会话事件
 *
 * 当用户点击顶部的"新建会话"按钮时，会触发此事件
 * 每个 AppView 组件会检查事件的 paneId 是否匹配自己，匹配则执行新建会话操作
 */
const handleNewSessionEvent = (event: CustomEvent) => {
  const { paneId } = event.detail;
  if (paneId === props.paneId && tab.value) {
    executeNewSession();
  }
};

// 监听搜索事件
const handleSearchEvent = (event: CustomEvent) => {
  const { paneId, searchText, config } = event.detail;
  if (paneId === props.paneId && tab.value) {
    executeSearch(searchText, config as AppSearchConfig);
  }
};

onMounted(() => {
  window.addEventListener("search-pane", handleSearchEvent as EventListener);
  window.addEventListener("refresh-pane", handleRefreshEvent as EventListener);
  window.addEventListener(
    "new-session-pane",
    handleNewSessionEvent as EventListener
  );

  // 监听 webview 的控制台消息
  const webview = webviewRef.value as any;
  if (webview) {
    // 点击 / 聚焦 webview 时，标记当前面板为激活
    webview.addEventListener("focus", handleWebviewActivate);
    webview.addEventListener("mousedown", handleWebviewActivate);

    webview.addEventListener("console-message", (e: any) => {
      const prefix = `[Webview-${tab.value?.app.name}]`;
      if (e.level === 0) {
        console.log(prefix, e.message);
      } else if (e.level === 1) {
        console.warn(prefix, e.message);
      } else if (e.level === 2) {
        console.error(prefix, e.message);
      }
    });

    webview.addEventListener("did-fail-load", (e: any) => {
      console.error("❌ [AppView] webview 加载失败:", e);
    });

    // 监听 webview 崩溃
    webview.addEventListener("crashed", () => {
      console.error("❌ [AppView] Webview 崩溃:", tab.value?.app.name);
    });

    // 监听 GPU 进程崩溃
    webview.addEventListener("gpu-crashed", () => {
      console.error("❌ [AppView] GPU 进程崩溃:", tab.value?.app.name);
    });

    // 页面加载完成后清理历史记录，释放内存
    webview.addEventListener("did-finish-load", () => {
      webview.clearHistory();
    });
  }
});

onUnmounted(() => {
  window.removeEventListener("search-pane", handleSearchEvent as EventListener);
  window.removeEventListener(
    "refresh-pane",
    handleRefreshEvent as EventListener
  );
  window.removeEventListener(
    "new-session-pane",
    handleNewSessionEvent as EventListener
  );

  const webview = webviewRef.value as any;
  if (webview) {
    webview.removeEventListener("focus", handleWebviewActivate);
    webview.removeEventListener("mousedown", handleWebviewActivate);
  }
});
</script>

<style scoped lang="scss">
.app-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #ffffff;
  border: 1px solid #e0e0e0;

  .app-view-content.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f8f9fa;

    .empty-content {
      color: #999999;
      font-size: 14px;
    }
  }

  .app-view-header {
    height: 32px;
    background-color: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    flex-shrink: 0;

    .header-left {
      display: flex;
      align-items: center;
      gap: 6px;

      .header-main {
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .header-active-dot {
        position: absolute;
        top: -2px;
        left: -2px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #18a058;
        box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.12);
        pointer-events: none;
      }

      .header-icon {
        width: 16px;
        height: 16px;
        border-radius: 2px;
      }

      .header-title {
        font-size: 12px;
        color: #333333;
        font-weight: 500;
      }

      .nav-btn {
        width: 22px;
        height: 22px;
        border: none;
        background-color: #f1f3f4;
        color: #5f6368;
        cursor: pointer;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 1;
        padding: 0;
        margin-left: 2px;
        transition: background-color 0.15s ease, color 0.15s ease,
          transform 0.1s ease;

        &:hover {
          background-color: #e0e3e7;
          color: #202124;
        }

        &:active {
          transform: scale(0.96);
          background-color: #d2d5da;
        }
      }

      .refresh-btn {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: none;
        background-color: #f1f3f4;
        color: #5f6368;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
        margin-left: 4px;
        transition: background-color 0.15s ease, color 0.15s ease,
          transform 0.1s ease;

        &:hover {
          background-color: #e0e3e7;
          color: #202124;
        }

        &:active {
          transform: scale(0.96);
          background-color: #d2d5da;
        }
      }
    }

    .header-actions {
      display: flex;
      gap: 4px;

      .action-btn {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: #666666;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 0.2s;

        &:hover {
          background-color: #e3f2fd;
          color: #4a90e2;
        }
      }
    }
  }

  .app-view-content {
    flex: 1;
    overflow: hidden;
    position: relative;

    .webview {
      width: 100%;
      height: 100%;
      background-color: #ffffff;
      display: inline-flex;
      overflow: auto;
    }
  }
}
</style>
