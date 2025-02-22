import { useState } from "react";
import { getResponse } from "../components/networkPage/utils/index.js";
import { createWebContent } from "../components/networkPage/utils/thingAgent.js";
import { config } from "../../config/index";
import { getUserInput } from "../../../public/storage.js";

const fetchRelatedQuestions = async (query, answer, userInput) => {
  const apiKey = await getUserInput();

  const response = await fetch(`${config.baseUrl}/text/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "你是一个帮助生成相关问题的AI助手。请基于用户的上一个问题和回答，生成3个后续问题。",
        },
        {
          role: "user",
          content: `基于以下问题和回答，生成3个用户可能会继续追问的后续问题：
          
        原问题：${query}
        回答：${answer}

        要求：
        1. 问题要对原问题进行深入探讨
        2. 寻求更多相关细节
        3. 探索相关但不同的方面

        请直接返回3个问题，每个问题占一行。`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("获取相关问题失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          fullContent += parsed.choices[0]?.delta?.content || "";
        } catch (e) {
          console.error("解析流式数据失败:", e);
        }
      }
    }
  }

  return fullContent
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
};

export const useMessageHandler = (
  thinkingAgent,
  model,
  userInput,
  searchEnabled,
  baseUrl,
  provider,
  checkBalance
) => {
  if (baseUrl.includes("deepseek.com") && model.toLowerCase() === "deepseek-r1") {
    model = "deepseek-reasoner";
  } else if (baseUrl.includes("deepseek.com") && model.toLowerCase() === "deepseek-v3") {
    model = "deepseek-chat";
  }
  if (baseUrl.endsWith("/v1")) {
    baseUrl = baseUrl.slice(0, -3);
  }
  const [message, setMessage] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState(0);
  const filterUrls = (content, searchEngine) => {
    try {
      if (typeof window === "undefined") return [];

      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");

      let searchResults = [];

      if (searchEngine === "bing") {
        // 针对 Bing 的搜索结果选择器
        searchResults = Array.from(doc.querySelectorAll(".b_algo")).map((result) => {
          const linkElement = result.querySelector("h2 a");
          const descElement = result.querySelector(".b_caption p");

          return {
            url: linkElement?.href || "",
            title: linkElement?.textContent?.trim() || "无标题",
            description: descElement?.textContent?.trim() || "",
          };
        });
      } else if (searchEngine === "baidu") {
        // 针对百度的搜索结果选择器
        searchResults = Array.from(doc.querySelectorAll(".result")).map((result) => {
          const linkElement = result.querySelector("h3 a");
          const descElement = result.querySelector(".c-abstract");
          return {
            url: linkElement?.href || "",
            title: linkElement?.textContent?.trim() || "无标题",
            description: descElement?.textContent?.trim() || "",
          };
        });
      }

      return searchResults
        .filter((item) => {
          const url = item.url || "";
          const title = item.title || "";
          const description = item.description || "";

          const excludePatterns = [
            /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})(\/ad|\/ads|\/advertisement)/,
            /sponsored/i,
            /广告/,
            /推广/,
            /chrome-extension:\/\//,
            /chrome\.google\.com\/webstore/,
            /addons\.mozilla\.org/,
            /microsoftedge\.microsoft\.com\/addons/,
            /zhihu\.com/,
            /xiaohongshu\.com/,
            /xhs\.com/,
            /doubleclick\.net/,
            /googleadservices\.com/,
            /adnxs\.com/,
            /adsystem\.com/,
          ];

          return !excludePatterns.some(
            (pattern) => pattern.test(url) || pattern.test(title) || pattern.test(description)
          );
        })
        .filter((item, index, self) => index === self.findIndex((t) => t.url === item.url))
        .filter(
          (item) =>
            item.url &&
            item.url !== "javascript:void(0)" &&
            !item.url.startsWith("chrome-extension://")
        )
        .slice(0, 10);
    } catch (error) {
      console.error("解析搜索结果时出错:", error);
      return [];
    }
  };

  const updateUrlStatus = (url, status) => {
    const updateList = (list) =>
      list.map((item) =>
        item.url === url
          ? {
              ...item,
              status,
              iconBackground: status === 2 ? "bg-green-500" : "bg-blue-500",
            }
          : item
      );

    setMessage((prevMessages) => {
      const messages = [...prevMessages];
      const lastAssistantIndex = messages.findLastIndex((msg) => msg.role === "assistant");

      if (lastAssistantIndex !== -1 && messages[lastAssistantIndex].urlListData) {
        messages[lastAssistantIndex] = {
          ...messages[lastAssistantIndex],
          urlListData: updateList(messages[lastAssistantIndex].urlListData),
        };
      }

      return messages;
    });
  };

  const handleSubmit = async (query) => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);

    try {
      const initialMessage = {
        role: "assistant",
        content: "",
        urlListData: [],
        model: model,
        status: "thinking",
        statusMessage: "正在思考问题",
        relatedQuestions: [],
        questionsLoading: false,
        isReasoningExpanded: true,
        isComplete: false,
        isCopied: false,
      };

      if (baseUrl.includes("s2bapi.zima.pet")) {
        const isEnough = await checkBalance(7, model, 3);
        if (!isEnough) return;
      }

      setMessage((prev) => [
        ...prev,
        { role: "user", content: query, isComplete: true },
        initialMessage,
      ]);

      const handleStreamProgress = async (progress) => {
        if (progress.state === 2) {
          const updatedMessage = {
            content: progress.response,
            reasoning_content: progress.reasoningContent,
            statusMessage: "",
            isCopied: false,
            isComplete: false,
            isStreaming: true,
          };

          if (progress.isComplete) {
            setMessage((prev) => {
              const newMessages = [...prev];
              const lastIndex = newMessages.length - 1;
              return [
                ...newMessages.slice(0, -1),
                {
                  ...newMessages[lastIndex],
                  ...updatedMessage,
                  questionsLoading: true,
                  isStreaming: false,
                },
              ];
            });

            try {
              const relatedQuestions = await fetchRelatedQuestions(
                query,
                progress.response,
                userInput
              );

              setMessage((prev) => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                return [
                  ...newMessages.slice(0, -1),
                  {
                    ...newMessages[lastIndex],
                    ...updatedMessage,
                    relatedQuestions,
                    questionsLoading: false,
                    isStreaming: false,
                    isComplete: true,
                  },
                ];
              });
            } catch (error) {
              setMessage((prev) => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                return [
                  ...newMessages.slice(0, -1),
                  {
                    ...newMessages[lastIndex],
                    ...updatedMessage,
                    content: "服务器繁忙，请切换其他模型或者检查网络",
                    relatedQuestions: [],
                    isSearching: false,
                    questionsLoading: false,
                    isComplete: true,
                  },
                ];
              });
            }
          } else {
            setMessage((prev) => {
              const newMessages = [...prev];
              const lastIndex = newMessages.length - 1;
              return [
                ...newMessages.slice(0, -1),
                {
                  ...newMessages[lastIndex],
                  ...updatedMessage,
                  isComplete: false,
                },
              ];
            });
          }
        } else if (progress.state === 1 && progress.searchUrl) {
          setMessage((prev) =>
            updateLastAssistantMessage(prev, {
              status: "searching",
              statusMessage: "正在搜索相关信息",
            })
          );

          try {
            let processUrls = [];
            if (typeof progress.searchUrl === "string") {
              const searchResponse = await fetch(progress.searchUrl);
              if (!searchResponse.ok) {
                throw new Error(`HTTP error! status: ${searchResponse.status}`);
              }
              const content = await searchResponse.text();
              const isBing = progress.searchUrl.includes("bing.com") ? "bing" : "baidu";
              const filteredUrls = filterUrls(content, isBing);
              processUrls = filteredUrls.slice(0, 5);
            } else {
              processUrls = progress.searchUrl;
            }
            setMessage((prev) =>
              updateLastAssistantMessage(prev, {
                status: "fetching",
                statusMessage: "正在获取网页内容",
              })
            );

            const extractResponse = await chrome.runtime.sendMessage({
              action: "extractMultipleContents",
              urls: processUrls.map((result) => result.url),
            });

            setMessage((prev) =>
              updateLastAssistantMessage(prev, {
                status: "analyzing",
                statusMessage: "正在获取网页内容",
              })
            );

            if (extractResponse.success) {
              const webContents = extractResponse.contents.map(({ url, content, title }) =>
                createWebContent(url, content, query, title)
              );
              const urlToTitleMap = processUrls.reduce(
                (acc, item) => ({
                  ...acc,
                  [item.url]: item.title,
                }),
                {}
              );

              const enrichedWebContents = webContents.map((webContent) => ({
                ...webContent,
                title: urlToTitleMap[webContent.url] || webContent.title,
              }));

              setMessage((prev) =>
                updateLastAssistantMessage(prev, {
                  status: "generating",
                  statusMessage: "正在理解网页内容",
                  urlListData: enrichedWebContents.map((url) => ({
                    ...url,
                    status: 1,
                    iconBackground: "bg-blue-500",
                  })),
                })
              );

              const response = await thinkingAgent.chat(
                query,
                enrichedWebContents,
                message,
                (url, status) => {
                  updateUrlStatus(url, status);
                  const allUrlsProcessed = (prev) => {
                    const lastMessage = prev[prev.length - 1];
                    return lastMessage.urlListData?.every((url) => url.status === 2);
                  };

                  setMessage((prev) => {
                    if (allUrlsProcessed(prev)) {
                      return updateLastAssistantMessage(prev, {
                        status: "merging",
                        statusMessage: "正在整合所有信息...",
                      });
                    }
                    return prev;
                  });
                },
                (streamData) => {
                  setMessage((prev) => {
                    const messages = [...prev];
                    const lastIndex = messages.findLastIndex((msg) => msg.role === "assistant");
                    if (lastIndex !== -1) {
                      messages[lastIndex] = {
                        ...messages[lastIndex],
                        content: streamData?.content || messages[lastIndex].content,
                        reasoning_content:
                          streamData?.reasoningContent || messages[lastIndex].reasoning_content,
                        status: "processing",
                        statusMessage: "",
                        isStreaming: true,
                        isComplete: false,
                      };
                    }
                    return messages;
                  });
                }
              );
              setMessage((prev) =>
                updateLastAssistantMessage(prev, {
                  content: response.content,
                  reasoning_content: response.reasoning_content,
                  status: "complete",
                  statusMessage: "",
                  isStreaming: false,
                  questionsLoading: true,
                })
              );
              const relatedQuestions = await fetchRelatedQuestions(
                query,
                response.content,
                userInput
              );
              setMessage((prev) =>
                updateLastAssistantMessage(prev, {
                  content: response.content,
                  reasoning_content: response.reasoning_content,
                  isComplete: true,
                  status: "complete",
                  statusMessage: "",
                  relatedQuestions: relatedQuestions,
                  questionsLoading: false,
                })
              );
            }
          } catch (error) {
            let erroeMessage = "服务器繁忙，请切换其他模型或者检查网络";
            if (error.message.includes("请先在登录知乎网页版后再使用知乎搜索源")) {
              erroeMessage = "请先在登录知乎网页版后再使用知乎搜索源";
            }
            setMessage((prev) =>
              updateLastAssistantMessage(prev, {
                status: "error",
                statusMessage: erroeMessage,
                content: "服务器繁忙，请切换其他模型或者检查网络",
                isComplete: true,
                isStreaming: false,
                isCopied: false,
                questionsLoading: false,
              })
            );
          }
        }
      };

      await getResponse(
        query,
        searchEnabled,
        handleStreamProgress,
        message,
        model.toLowerCase(),
        baseUrl,
        provider,
        userInput
      );
    } catch (error) {
      let erroeMessage = "服务器繁忙，请切换其他模型或者检查网络2222";
      if (error.message.includes("请先在登录知乎网页版后再使用知乎搜索源")) {
        erroeMessage = "请先在登录知乎网页版后再使用知乎搜索源";
      } else if (error.message.includes("请先在登录小红书网页版后再使用小红书搜索源")) {
        erroeMessage = "请先在登录小红书网页版后再使用小红书搜索源";
      }
      setMessage((prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        return [
          ...newMessages.slice(0, -1),
          {
            ...newMessages[lastIndex],
            status: "error",
            statusMessage: erroeMessage,
            content: "服务器繁忙，请切换其他模型或者检查网络",
            isComplete: true,
            isStreaming: false,
            isCopied: false,
            questionsLoading: false,
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateLastAssistantMessage = (prevMessages, updates) => {
    return prevMessages.map((msg, index) => {
      if (index === prevMessages.findLastIndex((m) => m.role === "assistant")) {
        return {
          ...msg,
          ...updates,
          urlListData: updates.urlListData ? [...(updates.urlListData || [])] : msg.urlListData,
          relatedQuestions: updates.relatedQuestions
            ? [...(updates.relatedQuestions || [])]
            : msg.relatedQuestions,
        };
      }
      return msg;
    });
  };

  const updateMessageCopyStatus = (messageId, isCopied) => {
    setMessage((prev) =>
      prev.map((msg) => (msg.content === messageId ? { ...msg, isCopied } : msg))
    );

    if (isCopied) {
      setTimeout(() => {
        setMessage((prev) =>
          prev.map((msg) => (msg.content === messageId ? { ...msg, isCopied: false } : msg))
        );
      }, 2000);
    }
  };

  return {
    message,
    isLoading,
    handleSubmit,
    setMessage,
    updateMessageCopyStatus,
  };
};
