import { captureVisibleTab } from "./utils.js";
import {
  setLastUpdateCheck,
  getLastUpdateCheck,
  setVersion,
  setZhihuCookies,
  getZhihuCookies,
  setXhsCookies,
  getXhsCookies,
  getUserInput,
  removeXhsCookies,
  removeZhihuCookies,
} from "./storage.js";

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

const analyzeImages = async (images) => {
  const userInput = await getUserInput();
  const tokenResponse = await fetch("https://s2bapi.zima.pet/ocr/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userInput}`,
    },
  });
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.data.access_token;

  // 添加延迟函数
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const imageTexts = [];
  for (const imageUrl of images) {
    try {
      await delay(500);

      const response = await fetch(
        "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `access_token=${accessToken}&url=${encodeURIComponent(
            imageUrl
          )}`,
        }
      );

      const result = await response.json();

      // 处理可能的错误响应
      if (result.error_code) {
        console.error(`OCR API 错误: ${result.error_msg}`);
        continue;
      }

      const text =
        result.words_result?.map((item) => item.words).join("\n") || "";
      if (text) {
        imageTexts.push(text);
      }
    } catch (error) {
      console.error("OCR分析失败:", error);
    }
  }

  return imageTexts.join("\n\n");
};

async function extractPageContent(url) {
  try {
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      return { url, content: "" };
    }

    const tab = await chrome.tabs.create({
      url,
      active: false,
    });

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("页面加载超时(30秒)")), 30000);
    });

    const pageLoad = new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });

    try {
      await Promise.race([pageLoad, timeout]);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const content = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
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
                } else if (
                  h1s.length === 0 &&
                  h2s.length > 0 &&
                  node.tagName === "H2"
                ) {
                  return `# ${content}\n\n`;
                } else if (
                  h1s.length === 0 &&
                  h2s.length === 0 &&
                  node.tagName === "H3"
                ) {
                  return `# ${content}\n\n`;
                }
                return `${content}\n\n`;
              },
            },
            {
              name: "absolute-image-paths",
              filter: "img",
              replacement: (content, node) => {
                return ``;
              },
            },
          ];
          try {
            const turndownService = new TurndownService();
            rules.forEach((rule) => turndownService.addRule(rule.name, rule));
            const reader = new Readability(document.cloneNode(true), {
              charThreshold: 0,
              keepClasses: true,
              nbTopCandidates: 10,
              keepImages: false,
              keepLinks: false,
            });
            const article = reader.parse();
            await new Promise((resolve) => setTimeout(resolve, 2000));

            return {
              content: turndownService.turndown(article?.content || ""),
            };
          } catch (error) {
            console.error("Content extraction error:", error);
            return { content: "" };
          }
        },
      });
      const { content: extractedContent, imgList } = content[0]?.result || {
        content: "",
      };

      return { url, content: extractedContent };
    } catch (error) {
      console.error(`页面处理失败: ${error.message}`);
      return { url, content: "" };
    } finally {
      await chrome.tabs.remove(tab.id);
    }
  } catch (error) {
    console.error("提取页面内容时出错:", error, "URL:", url);
    return { url, content: "" };
  }
}

async function extractMultiplePages(urls) {
  try {
    const results = await Promise.all(
      urls.map((url) => extractPageContent(url))
    );

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
          "https://extension-update.oss-cn-beijing.aliyuncs.com/versionZIp.json"
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

const executePageScript = async (tabId) => {
  const executeInPage = async () => {
    const avatarElement = document.querySelector(".AppHeader-profileAvatar");
    const hasUserAvatar = Boolean(avatarElement);
    const userInfo = {
      avatar: avatarElement?.src ?? "",
    };
    const xZse96 = document
      .querySelector('meta[name="x-zse-96"]')
      ?.getAttribute("content");

    return {
      success: true,
      hasUserAvatar,
      userInfo,
      xZse96,
    };
  };

  // 注入一个监听器来接收页面的日志
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      window.addEventListener("message", (event) => {
        if (event.data.type === "ZHIHU_AUTH_LOG") {
          chrome.runtime.sendMessage({
            type: "BACKGROUND_LOG",
            data: event.data.data,
          });
        }
      });
    },
  });

  // 监听来自页面的日志消息
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "BACKGROUND_LOG") {
      console.log(...message.data);
    }
  });

  // 在后台脚本中获取 cookies
  const getCookiesFromBackground = async () => {
    const cookies = await chrome.cookies.getAll({ domain: ".zhihu.com" });
    return cookies.reduce(
      (acc, cookie) => ({
        ...acc,
        [cookie.name]: cookie.value,
      }),
      {}
    );
  };

  // 获取执行结果
  const pageResult = await chrome.scripting.executeScript({
    target: { tabId },
    func: executeInPage,
  });

  // 使用后台 API 获取完整的 cookies
  const cookies = await getCookiesFromBackground();

  // 在后台验证登录状态
  const loginStatus = {
    hasAuthCookie: Boolean(cookies.z_c0),
    hasUserInfo: pageResult[0].result.hasUserAvatar,
    isLoggedIn: Boolean(cookies.z_c0) && pageResult[0].result.hasUserAvatar,
  };

  // 合并结果
  const result = {
    ...pageResult[0].result,
    cookies,
    loginStatus,
  };

  return result;
};

const waitForTabLoad = (tabId) =>
  new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 2000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

async function getZhihuAuthViaTab() {
  let tab = null;
  try {
    tab = await chrome.tabs.create({
      url: "https://www.zhihu.com",
      active: false,
    });

    await waitForTabLoad(tab.id);
    const result = await executePageScript(tab.id);

    if (result.success) {
      await setZhihuCookies(result.cookies);
      return {
        success: true,
        isLoggedIn: result.loginStatus.isLoggedIn,
      };
    }
    return {
      success: false,
      error: result.error,
    };
  } catch (error) {
    await removeZhihuCookies();
    return {
      success: false,
      error: error.message,
      details: {
        stack: error.stack,
        tabInfo: tab,
      },
    };
  } finally {
    if (tab?.id) {
      await chrome.tabs.remove(tab.id);
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getZhihuAuthViaTab") {
    (async () => {
      try {
        const result = await getZhihuAuthViaTab();
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    })();
    return true;
  }
});

const executeXhsPageScript = async (tabId) => {
  const executeInPage = async () => {
    const searchInput = document.querySelector("#search-input");

    const placeholder = searchInput?.placeholder;

    if (placeholder === "登录探索更多内容") {
      return {
        success: false,
        placeholder,
      };
    }

    console.log("页面检查通过");
    return {
      success: true,
      placeholder,
    };
  };

  const getCookiesFromBackground = async () => {
    const cookies = await chrome.cookies.getAll({ domain: ".xiaohongshu.com" });
    return cookies.reduce(
      (acc, cookie) => ({
        ...acc,
        [cookie.name]: cookie.value,
      }),
      {}
    );
  };

  const pageResult = await chrome.scripting.executeScript({
    target: { tabId },
    func: executeInPage,
  });

  const cookies = await getCookiesFromBackground();

  const loginStatus = {
    hasAuthCookie: Boolean(cookies.web_session),
    hasUserInfo: pageResult[0].result.success,
    isLoggedIn: Boolean(cookies.web_session) && pageResult[0].result.success,
  };

  return {
    ...pageResult[0].result,
    cookies,
    loginStatus,
  };
};

async function getXhsAuthViaTab() {
  let tab = null;
  try {
    tab = await chrome.tabs.create({
      url: "https://www.xiaohongshu.com/explore",
      active: false,
    });

    await waitForTabLoad(tab.id);

    const result = await executeXhsPageScript(tab.id);

    if (result.success) {
      return {
        success: true,
        isLoggedIn: result.loginStatus.isLoggedIn,
        cookies: result.cookies,
      };
    }
    return {
      success: false,
      error: result.error,
    };
  } catch (error) {
    console.error("获取小红书认证时发生错误:", error);
    return {
      success: false,
      error: error.message,
      details: {
        stack: error.stack,
        tabInfo: tab,
      },
    };
  } finally {
    if (tab?.id) {
      await chrome.tabs.remove(tab.id);
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getXhsAuthViaTab") {
    (async () => {
      try {
        const result = await getXhsAuthViaTab();
        if (result.success) {
          await setXhsCookies(result.cookies);
        }
        sendResponse(result);
      } catch (error) {
        await removeXhsCookies();
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
    chrome.tabs.create(
      { url: chrome.runtime.getURL("markmap.html") },
      (newTab) => {
        chrome.storage.local.set({ mindmapTabId: newTab.id });
      }
    );
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
