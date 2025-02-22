import { extractUrls } from "./webSearch";
import { config } from "../../config/index";
import { getUserInput, getSearchSourceStorage, setGetPageCount } from "../../../public/storage.js";

let originalQuestion = "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callOpenaiWithRetry = async (messages, model, apikey, baseUrl, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await callOpenai(messages, model, apikey, baseUrl);
    } catch (error) {
      if (
        i === retries ||
        error?.message?.includes("余额不足") ||
        error?.message?.includes("API密钥")
      ) {
        throw error;
      }
      console.warn(`第 ${i + 1} 次调用失败，等待重试...`, error?.message);
      await sleep(1000 * (i + 1));
    }
  }
};

const callOpenai = async (messages, model = "gpt-4o-mini", apikey, baseUrl) => {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("消息参数无效");
    }

    if (baseUrl.endsWith("/v1")) {
      baseUrl = baseUrl.slice(0, -3);
    }

    if (baseUrl?.includes("deepseek.com") && model?.toLowerCase() === "deepseek-r1") {
      model = "deepseek-reasoner";
    } else if (baseUrl?.includes("deepseek.com") && model?.toLowerCase() === "deepseek-v3") {
      model = "deepseek-chat";
    }

    if (baseUrl === "https://api.super2brain.com") {
      baseUrl = "https://api.super2brain.com/text";
    }
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apikey}`,
      },
      body: JSON.stringify({
        messages,
        model: model.toLowerCase(),
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 504) {
        throw new Error("链接超时，请检查网络连接并稍后重试");
      }
      if (response.status === 402) {
        throw new Error("账户余额不足，请充值后继续使用");
      }
      throw new Error(`API请求失败: ${response.status}`);
    }

    const reader = response.body.getReader();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              result += parsed.choices[0].delta.content;
            }
          } catch (e) {
            console.warn("解析响应数据失败:", e);
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("OpenAI API 调用失败:", error.message);
    throw error;
  }
};

const analyzeQuery = async (query, updateStatus, apikey, selectedModel, baseUrl) => {
  updateStatus(`思考问题：${query}`);
  const token = await getUserInput();

  const fetchKeywords = async () => {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `你是一位专业的研究助手。根据用户的问题，生成一个最优的搜索关键词，
                    以帮助获取最相关的信息。关键词应该：
                    1. 简洁精确
                    2. 包含主要信息点
                    3. 去除无关词语
                    请直接返回关键词字符串，不需要任何格式化。
                    `,
          },
          {
            role: "user",
            content: query,
          },
        ],
        model: "gpt-4o-mini",
        temperature: 0.7,
        stream: true,
      }),
    });

    const reader = response.body.getReader();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              result += parsed.choices[0].delta.content;
            }
          } catch (e) {
            console.warn("解析响应数据失败:", e);
          }
        }
      }
    }
    return result;
  };

  try {
    const response = await fetchKeywords();
    if (!response) {
      console.warn("获取关键词响应为空");
      return query;
    }
    return response.trim();
  } catch (error) {
    console.error("关键词分析失败:", error);
    throw error;
  }
};

const buildWebSearchUrl = async (query, updateStatus, apikey, baseUrl, selectedModel) => {
  let searchSource = await getSearchSourceStorage();
  console.log("---===---", searchSource);
  if (!searchSource) {
    searchSource = "https://www.bing.com/search?q=";
  }
  if (searchSource?.includes("xiaohongshu")) {
    searchSource = "https://www.bing.com/search?q=";
  }
  const searchKey = await analyzeQuery(query, updateStatus, apikey, selectedModel, baseUrl);
  updateStatus(`搜索关键词：${searchKey}`);
  return [`${searchSource}${encodeURIComponent(searchKey)}`];
};

const searchWeb = async (query, updateStatus, apikey, baseUrl, selectedModel) => {
  let searchSource = await getSearchSourceStorage();
  console.log("---===---", searchSource);
  if (!searchSource) {
    searchSource = "https://www.bing.com/search?q=";
  }
  console.log(searchSource);
  const searchUrls = await buildWebSearchUrl(query, updateStatus, apikey, baseUrl, selectedModel);
  if (
    searchSource?.includes("bing") ||
    searchSource?.includes("xiaohongshu") ||
    searchSource?.includes("baidu")
  ) {
    try {
      const responses = await Promise.all(searchUrls.map((url) => fetch(url)));

      const htmlContents = await Promise.all(responses.map((response) => response.text()));
      return htmlContents;
    } catch (error) {
      console.error("搜索过程中发生错误:", error);
      throw error;
    }
  } else {
    try {
      const openTabs = async (urls) => {
        const createTab = (url) => chrome.tabs.create({ url, active: false });
        return Promise.all(urls.map(createTab));
      };

      const tabs = await openTabs(searchUrls);
      const waitForTabsLoad = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      await waitForTabsLoad(10000);
      const getSearchResults = async (tabId) => {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              return Array.from(document.querySelectorAll(".SearchResult-Card"))
                .filter((link) => {
                  const href = link.querySelector("a")?.href;
                  return href && (href.includes("zhuanlan.zhihu.com") || href.includes("question"));
                })
                .map((card) => ({
                  url: card.querySelector("a")?.href || "",
                  title: card.querySelector(".ContentItem-title")?.textContent?.trim() || "无标题",
                  description: card.querySelector(".RichContent-inner")?.textContent?.trim() || "",
                }))
                .slice(0, 3);
            },
          });
          return results[0].result;
        } finally {
          await chrome.tabs.remove(tabId);
        }
      };

      const htmlContents = await Promise.all(tabs.map((tab) => getSearchResults(tab.id)));
      console.log(htmlContents.flat());
      return htmlContents.flat();
    } catch (error) {
      console.error("搜索标签页处理过程中发生错误:", error);
      throw error;
    }
  }
};

const getUrlLink = async (query, updateStatus, apikey, baseUrl, selectedModel) => {
  const searchHtmlContents = await searchWeb(query, updateStatus, apikey, baseUrl, selectedModel);

  if (!searchHtmlContents || searchHtmlContents.length === 0) {
    console.warn("搜索结果为空");
    return [];
  }

  if (
    typeof searchHtmlContents[0] === "string" &&
    searchHtmlContents[0].includes("!DOCTYPE html")
  ) {
    const allLinks = await Promise.all(
      searchHtmlContents.map(async (html) => extractUrls(html))
    ).then((results) =>
      results
        .flat()
        .filter((link, index, self) => index === self.findIndex((l) => l.url === link.url))
    );
    console.log("---===---", allLinks);
    return allLinks;
  } else {
    return searchHtmlContents;
  }
};

const fetchWebContent = async (query, apikey, baseUrl, updateStatus, selectedModel) => {
  const allLinks = await getUrlLink(query, updateStatus, apikey, baseUrl, selectedModel);

  const extractResponse = await chrome.runtime.sendMessage({
    action: "extractMultipleContents",
    urls: allLinks.map((result) => result.url),
  });

  if (extractResponse.success) {
    await setGetPageCount(extractResponse.contents.length);
  }

  return extractResponse.contents;
};

const analyzeUrlContent = async (query, urlContent, apikey, baseUrl, selectedModel) => {
  return await callOpenaiWithRetry(
    [
      {
        role: "system",
        content: `你是一位专业的分析助手。根据用户的问题，以及搜索到的网页的内容进行分析，生成一个关于用户问题的回答。回答的内容要具体一些，包含有具体的细节`,
      },
      {
        role: "user",
        content: `问题：${query}\n网页内容：${urlContent}`,
      },
    ],
    selectedModel,
    apikey,
    baseUrl
  );
};

const getFinalResponse = async (query, formattedResults, apikey, baseUrl, selectedModel) => {
  const response = await callOpenaiWithRetry(
    [
      {
        role: "system",
        content: `根据用户的问题以及搜索到的每个网页的回答，生成一个最终的回答。回答的内容要具体一些，包含有具体的细节，返回的格式为markdown`,
      },
      {
        role: "user",
        content: `问题：${query}\n 每个网页的回答：${formattedResults}`,
      },
    ],
    selectedModel,
    apikey,
    baseUrl
  );

  return response;
};

const getDeepFinalResponse = async (
  query,
  currentResponse,
  formattedResults,
  apikey,
  baseUrl,
  selectedModel
) => {
  const response = await callOpenaiWithRetry(
    [
      {
        role: "system",
        content: `根据用户的问题以及当前回答，以及补充回答生成一个最终的回答。回答的内容要具体一些，包含有具体的细节，返回的格式为markdown`,
      },
      {
        role: "user",
        content: `问题：${query}\n 当前回答：${currentResponse}\n 补充回答：${formattedResults}`,
      },
    ],
    selectedModel,
    apikey,
    baseUrl
  );

  return response;
};

const thinkContent = async (query, currentResponse, index, apikey, baseUrl, selectedModel) => {
  const token = await getUserInput();
  const fetchQuestion = async () => {
    const response = await fetch(`${config.baseUrl}/text/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      stream: true,
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `你是一个专业的深度思考分析师。你的任务是：
          1. 分析用户原始问题和当前回答之间的关联性
          2. 识别回答内容的潜在缺失
          3. 生成补充性问题以填补信息空缺
          4. 分析深层次的内容生成补充问题
    
          ${
            index === 0
              ? `必须生成2-4个关于用户原始问题的补充问题`
              : `请严格评估当前回答：
            - 如果论据充分、观点全面、有具体数据支持且包含最新信息，则必须只返回 []
            - 否则生成2-4个补充问题`
          }
    
          严格的返回格式要求：
          1. 必须且只能返回一个JSON数组
          2. 数组内容必须是纯文本的问题字符串
          3. 示例格式：["问题1", "问题2"]
          4. 如果不需要补充问题，必须返回 []`,
          },
          {
            role: "user",
            content: `原始问题：${query}\n当前回答：${currentResponse}`,
          },
        ],
        model: "gpt-4o-mini",
        stream: true,
        temperature: 0.7,
      }),
    });

    const reader = response.body.getReader();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              result += parsed.choices[0].delta.content;
            }
          } catch (e) {
            console.warn("解析响应数据失败:", e);
          }
        }
      }
    }
    return result;
  };

  try {
    const response = await fetchQuestion();
    if (!response) {
      console.warn("获取问题响应为空");
      return [];
    }
    try {
      const cleanedResponse = response
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "")
        .trim();
      return JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("JSON解析失败:", parseError, "原始响应:", response);
      return [];
    }
  } catch (error) {
    console.error("深度思考分析失败:", error);
    return [];
  }
};

const getDeepResponse = async (
  query,
  questionList,
  finalResponse,
  depth = 0,
  maxDepth = 1,
  apikey,
  baseUrl,
  selectedModel,
  updateStatus
) => {
  originalQuestion = query;

  if (!Array.isArray(questionList) || questionList.length === 0) {
    return finalResponse;
  }

  updateStatus("补充搜索相关信息");
  const urlContentsList = await Promise.all(
    questionList.map(async (question) => {
      const questionStatus = (status) => updateStatus(status);
      return fetchWebContent(question, apikey, baseUrl, questionStatus, selectedModel);
    })
  );

  const hasValidContent = urlContentsList.some((contents) => contents && contents.length > 0);
  if (!hasValidContent) {
    return finalResponse;
  }

  updateStatus("深入分析补充内容");
  const deepAnalyzeResults = await Promise.all(
    urlContentsList.map((urlContents, questionIndex) =>
      Promise.all(
        urlContents.map((urlContent) =>
          analyzeUrlContent(
            questionList[questionIndex],
            urlContent.content,
            apikey,
            baseUrl,
            selectedModel
          )
        )
      )
    )
  );

  const formattedDeepResults = questionList
    .map(
      (question, index) =>
        `补充问题${index + 1}：${question}\n回答：${deepAnalyzeResults[index].join("\n")}\n\n`
    )
    .join("");

  updateStatus("完善答案内容");
  const finalDeepResponse = await getDeepFinalResponse(
    query,
    finalResponse,
    formattedDeepResults,
    apikey,
    baseUrl,
    selectedModel
  );

  if (depth >= maxDepth) {
    return finalDeepResponse;
  }

  updateStatus("检查答案完整性");
  const deepThinkQuestions = await thinkContent(
    query,
    finalDeepResponse,
    depth,
    apikey,
    baseUrl,
    selectedModel
  );

  if (Array.isArray(deepThinkQuestions) && deepThinkQuestions.length > 0) {
    updateStatus("展开深度研究");
    return await getDeepResponse(
      query,
      deepThinkQuestions,
      finalDeepResponse,
      depth + 1,
      maxDepth,
      apikey,
      baseUrl,
      selectedModel,
      updateStatus
    );
  }

  return finalDeepResponse;
};

const createContext = (
  query,
  apikey,
  baseUrl,
  depth = 0,
  maxDepth = 1,
  onStatusUpdate = () => {}
) => {
  const context = {
    query,
    apikey,
    baseUrl,
    depth,
    maxDepth,
    statusList: [],
    updateStatus: (status) => {
      context.statusList.push(status);
      onStatusUpdate?.(context.statusList);
    },
  };
  return context;
};

const isGreeting = async (text, apikey, selectedModel, baseUrl) => {
  try {
    const response = await callOpenaiWithRetry(
      [
        {
          role: "system",
          content: `你是一个判断助手。判断用户输入是否为问候语（如：你好、在吗、打扰一下等，或者是一些闲聊，比如哈哈，等无思考意义的问题）。
          - 如果是问候语，返回 "true"
          - 如果不是问候语，返回 "false"
          - 严格返回布尔值字符串，不要返回其他内容`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      selectedModel,
      apikey,
      baseUrl
    );

    return String(response).trim().toLowerCase() === "true";
  } catch (error) {
    console.error("判断问候语失败:", error);
    return false;
  }
};

const getGreetingResponse = async (text, apikey, selectedModel, baseUrl) => {
  try {
    const response = await callOpenaiWithRetry(
      [
        {
          role: "system",
          content: `你是一个友好的AI助手。请根据用户的问候生成一个自然、友好的回应。
          回应要求：
          1. 保持简短自然
          2. 表达愿意帮助的态度
          3. 语气要亲切`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      selectedModel,
      apikey,
      baseUrl
    );

    return response;
  } catch (error) {
    console.error("生成问候回复失败:", error);
    return "你好！我是你的AI助手，很高兴为你服务。";
  }
};

// 修改主要响应函数
const getResponse = async (
  query,
  depth = 0,
  maxDepth = 1,
  selectedModel,
  apikey,
  baseUrl,
  onStatusUpdate = () => {}
) => {
  try {
    if (baseUrl.endsWith("/v1")) {
      baseUrl = baseUrl.slice(0, -3);
    }

    if (await isGreeting(query, apikey, selectedModel, baseUrl)) {
      return await getGreetingResponse(query, apikey, selectedModel, baseUrl);
    }

    const context = createContext(query, apikey, baseUrl, depth, maxDepth, onStatusUpdate);

    const urlContents = await fetchWebContent(
      query,
      apikey,
      baseUrl,
      context.updateStatus,
      selectedModel
    );

    if (!urlContents || urlContents.length === 0) {
      return await callOpenaiWithRetry(
        [
          {
            role: "system",
            content: "你是一个AI助手。当没有找到相关搜索结果时，请基于你的知识提供一个合理的回答。",
          },
          {
            role: "user",
            content: `我没有找到关于"${query}"的搜索结果，请基于你的知识回答这个问题。`,
          },
        ],
        selectedModel,
        apikey,
        baseUrl
      );
    }

    context.updateStatus("分析搜索结果");
    const analyzeResults = await Promise.all(
      urlContents.map((urlContent) =>
        analyzeUrlContent(query, urlContent.content, apikey, baseUrl, selectedModel)
      )
    );

    const formattedResults = analyzeResults
      .map((result, index) => `内容${index + 1}：\n${result} \n\n`)
      .join("\n\n");

    context.updateStatus("整理初步答案");
    const finalResponse = await getFinalResponse(
      query,
      formattedResults,
      apikey,
      baseUrl,
      selectedModel
    );

    // 添加移除 <think> 标签的处理
    const removeThinkTags = (response) => {
      const thinkRegex = /<think>[\s\S]*?<\/think>/g;
      return response.replace(thinkRegex, "").trim();
    };

    if (depth >= maxDepth) {
      return removeThinkTags(finalResponse);
    }

    context.updateStatus("深入思考分析");
    const deepThinkQuestions = await thinkContent(
      query,
      finalResponse,
      depth,
      apikey,
      baseUrl,
      selectedModel
    );

    if (Array.isArray(deepThinkQuestions) && deepThinkQuestions.length > 0) {
      context.updateStatus("展开深度研究");
      const deepResponse = await getDeepResponse(
        query,
        deepThinkQuestions,
        finalResponse,
        depth + 1,
        maxDepth,
        apikey,
        baseUrl,
        selectedModel,
        context.updateStatus
      );
      return removeThinkTags(deepResponse);
    }

    return removeThinkTags(finalResponse);
  } catch (error) {
    console.error("响应生成过程中发生错误:", error);
    throw error;
  }
};

export { getResponse };
