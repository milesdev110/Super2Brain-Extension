import { getLastUpdateCheck, setLastUpdateCheck, setVersion } from "./storage.js";
import { captureVisibleTab } from "./utils.js";

const breathingLightStyle = `
@keyframes breathe {
        0% {
          box-shadow: inset -2px 0 50px rgba(255, 105, 180, 0.6),
            inset 50px 0 50px rgba(255, 105, 180, 0.6), inset 0 -1px 25px rgba(75, 0, 130, 0.3),
            inset 0 1px 25px rgba(75, 0, 130, 0.3), -10px 0 10px rgba(255, 105, 180, 0.3),
            10px 0 10px rgba(255, 105, 180, 0.3);
        }
        25% {
          box-shadow: inset -3px 0 55px rgba(255, 165, 0, 0.65),
            inset 55px 0 55px rgba(255, 165, 0, 0.65), inset 0 -2px 27px rgba(0, 191, 255, 0.35),
            inset 0 2px 27px rgba(0, 191, 255, 0.35), -12px 0 12px rgba(255, 165, 0, 0.35),
            12px 0 12px rgba(255, 165, 0, 0.35);
        }
        50% {
          box-shadow: inset -3px 0 60px rgba(50, 205, 50, 0.7),
            inset 60px 0 60px rgba(50, 205, 50, 0.7), inset 0 -2px 30px rgba(255, 0, 0, 0.4),
            inset 0 2px 30px rgba(255, 0, 0, 0.4), -15px 0 15px rgba(50, 205, 50, 0.4),
            15px 0 15px rgba(50, 205, 50, 0.4);
        }
        75% {
          box-shadow: inset -3px 0 55px rgba(255, 215, 0, 0.65),
            inset 55px 0 55px rgba(255, 215, 0, 0.65), inset 0 -2px 27px rgba(138, 43, 226, 0.35),
            inset 0 2px 27px rgba(138, 43, 226, 0.35), -12px 0 12px rgba(255, 215, 0, 0.35),
            12px 0 12px rgba(255, 215, 0, 0.35);
        }
        100% {
          box-shadow: inset -2px 0 50px rgba(255, 105, 180, 0.6),
            inset 50px 0 50px rgba(255, 105, 180, 0.6), inset 0 -1px 25px rgba(75, 0, 130, 0.3),
            inset 0 1px 25px rgba(75, 0, 130, 0.3), -10px 0 10px rgba(255, 105, 180, 0.3),
            10px 0 10px rgba(255, 105, 180, 0.3);
        }
      }


body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  animation: breathe 2.5s ease-in-out infinite;
  z-index: 2147483647;
  border-radius: 8px;
}`;

chrome.runtime.onInstalled.addListener(async function (details) {
  if (details.reason === "install" || details.reason === "update") {
    if (details.reason === "install") {
      chrome.tabs.create({
        url: chrome.runtime.getURL("welcome.html"),
        active: true,
      });
    }

    const manifest = chrome.runtime.getManifest();
    await setLastUpdateCheck(new Date().getTime());
    await setVersion(manifest.version);

    chrome.contextMenus.create({
      id: "generateMindmap",
      title: "生成当页思维导图",
      contexts: ["page"],
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "openSidebar") {
    chrome.sidePanel.setOptions({
      enabled: true,
      path: "sidepanel.html",
    });
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CAPTURE_SCREENSHOT") {
    captureVisibleTab()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CAPTURE_SELECTED_AREA") {
    (async () => {
      try {
        const tab = sender.tab;
        const { x, y, width, height, devicePixelRatio } = request.payload;

        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png",
        });

        const offscreenCanvas = new OffscreenCanvas(
          width * devicePixelRatio,
          height * devicePixelRatio
        );
        const ctx = offscreenCanvas.getContext("2d");

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);

        ctx.drawImage(
          bitmap,
          x * devicePixelRatio,
          y * devicePixelRatio,
          width * devicePixelRatio,
          height * devicePixelRatio,
          0,
          0,
          width * devicePixelRatio,
          height * devicePixelRatio
        );

        const croppedBlob = await offscreenCanvas.convertToBlob({
          type: "image/png",
        });

        const reader = new FileReader();
        reader.readAsDataURL(croppedBlob);
        reader.onloadend = () => {
          chrome.tabs.sendMessage(tab.id, {
            type: "SCREENSHOT_CAPTURED",
            payload: {
              dataUrl: reader.result,
            },
          });

          chrome.runtime.sendMessage({
            type: "SCREENSHOT_CAPTURED",
            payload: {
              dataUrl: reader.result,
            },
          });
        };

        sendResponse({ success: true });
      } catch (error) {
        console.error("截图失败:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

async function extractPageContent(url) {
  let tab = null;
  let timeoutId = null;

  try {
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      return { url, content: "" };
    }

    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("页面加载超时(15秒)"));
      }, 15000);
    });

    const extractPromise = (async () => {
      tab = await chrome.tabs.create({
        url,
        active: false,
      });

      // 使用内容可读性检测而非等待完全加载
      await new Promise((resolve) => {
        // 检测页面是否包含足够的可读内容
        const checkReadability = async (tabId) => {
          if (tabId !== tab.id) return;

          try {
            const readabilityResult = await chrome.scripting.executeScript({
              target: { tabId },
              func: () => {
                // 检查页面是否有足够的文本内容
                const textContent = document.body.innerText;
                const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;

                // 检查主要内容元素是否已加载
                const hasMainContent = Boolean(
                  document.querySelector("article") ||
                    document.querySelector("main") ||
                    document.querySelector(".content") ||
                    document.querySelector("#content") ||
                    document.querySelectorAll("p").length > 3
                );

                return {
                  wordCount,
                  hasMainContent,
                  isReadable: wordCount > 100 && hasMainContent,
                };
              },
            });

            const { isReadable } = readabilityResult[0]?.result || { isReadable: false };

            if (isReadable) {
              resolve();
            } else {
              // 如果内容还不够可读，稍后再检查
              setTimeout(() => checkReadability(tabId), 300);
            }
          } catch (error) {
            // 出错时默认解析
            resolve();
          }
        };

        // 监听DOM内容加载完成事件，这通常比load事件更早
        const domContentLoadedCheck = (tabId, changeInfo) => {
          // 当DOM内容加载完成或页面状态变为complete时开始检查可读性
          if (
            tabId === tab.id &&
            (changeInfo.status === "complete" || changeInfo.status === "loading")
          ) {
            // 开始检查页面可读性
            setTimeout(() => checkReadability(tabId), 500);
          }
        };

        chrome.tabs.onUpdated.addListener(domContentLoadedCheck);

        // 设置一个备用计时器，即使内容检测失败也能继续
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(domContentLoadedCheck);
          resolve();
        }, 5000);
      });

      const content = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          const extractContent = () => {
            try {
              const turndownService = new TurndownService();
              const rules = [
                {
                  name: "truncate-svg",
                  filter: "svg",
                  replacement: () => "",
                },
                {
                  name: "header",
                  filter: ["h1", "h2", "h3"],
                  replacement: (content, node) => {
                    const h1s = document.getElementsByTagName("h1");
                    const h2s = document.getElementsByTagName("h2");
                    const h3s = document.getElementsByTagName("h3");

                    if (h1s.length > 0 && node.tagName === "H1") {
                      return `# ${content}\n\n`;
                    } else if (h1s.length === 0 && h2s.length > 0 && node.tagName === "H2") {
                      return `# ${content}\n\n`;
                    } else if (h1s.length === 0 && h2s.length === 0 && node.tagName === "H3") {
                      return `# ${content}\n\n`;
                    }
                    return `${content}\n\n`;
                  },
                },
                {
                  name: "absolute-image-paths",
                  filter: "img",
                  replacement: () => ``,
                },
              ];

              rules.forEach((rule) => turndownService.addRule(rule.name, rule));

              const reader = new Readability(document.cloneNode(true), {
                charThreshold: 0,
                keepClasses: true,
                nbTopCandidates: 10,
                keepImages: false,
                keepLinks: false,
              });

              const article = reader.parse();

              if (!article?.content) {
                const mainContent = document.body.innerText
                  .split("\n")
                  .filter((line) => line.trim().length > 0)
                  .join("\n");
                return { content: mainContent };
              }

              return {
                content: turndownService.turndown(article.content),
                title: article.title,
              };
            } catch (error) {
              console.error("Content extraction error:", error);
              return { content: "", error: error.message };
            }
          };

          return extractContent();
        },
      });

      const { content: extractedContent, title } = content[0]?.result || { content: "", title: "" };
      return { url, content: extractedContent, title };
    })();

    return await Promise.race([timeout, extractPromise]);
  } catch (error) {
    console.error("提取页面内容时出错:", error, "URL:", url);
    return { url, content: "", error: error.message };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (tab?.id) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (e) {
        console.error("关闭标签页失败:", e);
      }
    }
  }
}

async function extractMultiplePages(urls) {
  try {
    const results = await Promise.all(urls.map((url) => extractPageContent(url)));

    return results.filter((result) => result.content);
  } catch (error) {
    console.error("批量提取内容时出错:", error);
    return [];
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractMultipleContents") {
    extractMultiplePages(message.urls)
      .then((contents) => sendResponse({ success: true, contents }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

function compareVersions(v1, v2) {
  const v1Parts = v1.split(".").map(Number);
  const v2Parts = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  return 0;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkUpdate") {
    (async () => {
      const lastUpdateCheck = await getLastUpdateCheck();
      const now = new Date().getTime();
      if (now - lastUpdateCheck < 24 * 60 * 60 * 1000) {
        sendResponse({
          updateAvailable: false,
        });
      } else {
        await setLastUpdateCheck(now);
      }
      try {
        const currentVersion = chrome.runtime.getManifest().version;
        const response = await fetch(
          "https://extension-update.oss-cn-beijing.aliyuncs.com/version.json"
        );

        if (!response.ok) {
          throw new Error("获取版本信息失败");
        }

        const data = await response.json();
        const hasUpdate = compareVersions(data.version, currentVersion) > 0;

        sendResponse({
          updateAvailable: hasUpdate,
          version: data.version,
          currentVersion,
          releaseNotes: data.releaseNotes,
          fixNotes: data.fixNotes,
          choremUpdateUrl: data.choremUpdateUrl,
          edgeUpdateUrl: data.edgeUpdateUrl,
          updateDocs: data.updateDocs,
        });
      } catch (error) {
        console.error("检查更新失败:", error);
        sendResponse({
          updateAvailable: false,
          error: error.message,
        });
      }
    })();
    return true;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "refreshAllTabs") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({});

        const refreshableTabs = tabs.filter(
          (tab) =>
            !tab.url.startsWith("chrome://") &&
            !tab.url.startsWith("chrome-extension://") &&
            !tab.url.startsWith("edge://") &&
            !tab.url.startsWith("about:") &&
            !tab.url.startsWith("https://www.zima.pet/")
        );

        await Promise.all(
          refreshableTabs.map((tab) =>
            chrome.tabs.reload(tab.id, { bypassCache: message.bypassCache })
          )
        );

        sendResponse({
          success: true,
          refreshedCount: refreshableTabs.length,
        });
      } catch (error) {
        console.error("刷新标签页时出错:", error);
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    })();
    return true;
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generateMindmap") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openMindmap") {
    chrome.tabs.create({ url: chrome.runtime.getURL("markmap.html") }, (newTab) => {
      chrome.storage.local.set({ mindmapTabId: newTab.id });
    });
  } else if (message.action === "updateMindmap") {
    chrome.storage.local.get("mindmapTabId", (data) => {
      if (data.mindmapTabId) {
        chrome.tabs.sendMessage(data.mindmapTabId, {
          action: "updateContent",
          content: message.content,
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleBreathingLight") {
    (async () => {
      try {
        const { tabId, enable } = message;

        if (enable) {
          await chrome.scripting.insertCSS({
            target: { tabId },
            css: breathingLightStyle,
          });
          setTimeout(async () => {
            await chrome.scripting.removeCSS({
              target: { tabId },
              css: breathingLightStyle,
            });
          }, 15000);
        } else {
          await chrome.scripting.removeCSS({
            target: { tabId },
            css: breathingLightStyle,
          });
        }

        sendResponse({ success: true });
      } catch (error) {
        console.error("切换呼吸灯效果失败:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});
