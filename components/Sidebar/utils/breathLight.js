const toggleBreathingLight = async (tabId, enable) => {
  try {
    if (!tabId) {
      console.error("未提供标签页ID");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: "toggleBreathingLight",
      tabId: tabId,
      enable: enable,
    });

    if (!response.success) {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("切换呼吸灯效果失败:", error);
  }
};

// 获取标签页ID的辅助函数
const getTabIdByUrl = async (url) => {
  try {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((tab) => tab.url === url);
    return tab?.id;
  } catch (error) {
    console.error("获取标签页ID失败:", error);
    return null;
  }
};

export { toggleBreathingLight, getTabIdByUrl };
