export const keepAlive = (() => {
  let intervalId;

  return async (state) => {
    if (state && !intervalId) {
      chrome.runtime.getPlatformInfo(() => {});
      intervalId = setInterval(
        () => chrome.runtime.getPlatformInfo(() => {}),
        20000
      );
    } else if (!state && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
})();



export async function captureVisibleTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // 捕获可见区域的截图
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "png",
      quality: 100,
    });

    return {
      success: true,
      dataUrl,
      title: tab.title,
      url: tab.url,
    };
  } catch (error) {
    console.error("截图失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// 可选：如果需要完整页面截图
export async function captureFullPage() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // 注入脚本获取页面完整高度
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        return {
          width: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
          ),
          height: Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
          ),
        };
      },
    });

    // 调整标签页大小
    await chrome.tabs.update(tab.id, { url: tab.url });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 捕获截图
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: "png",
      quality: 100,
    });

    return {
      success: true,
      dataUrl,
      title: tab.title,
      url: tab.url,
    };
  } catch (error) {
    console.error("完整页面截图失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function initializeScreenCapture() {
  try {
    // 获取屏幕媒体流
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always",
      },
      audio: false,
    });

    // 创建视频元素
    const video = document.createElement("video");
    video.srcObject = stream;

    // 等待视频加载
    await new Promise((resolve) => (video.onloadedmetadata = resolve));
    await video.play();

    // 创建画布
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 绘制视频帧
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // 停止所有轨道
    stream.getTracks().forEach((track) => track.stop());

    // 转换为图片数据
    const dataUrl = canvas.toDataURL("image/png");

    return {
      success: true,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    console.error("区域截图失败:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// 将 base64 图片数据转换为 Markdown 图片格式
export function convertToMarkdownImage(dataUrl, alt = "截图") {
  return `![${alt}](${dataUrl})`;
}
