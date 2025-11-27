import { useState } from "react";
import { getSearchSourceStorage, getUserInput } from "../../../public/storage.js";
import { config } from "../../config/index";
import { getResponse } from "../components/networkPage/utils/index.js";
import { createWebContent } from "../components/networkPage/utils/thingAgent.js";

const fetchRelatedQuestions = async (query, answer, userInput) => {
  const apiKey = await getUserInput();

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
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
  // 针对于 deepseek 的模型ID的转变
  if (baseUrl.includes("deepseek.com") && model.toLowerCase() === "deepseek-r1") {
    model = "deepseek-reasoner";
  } else if (baseUrl.includes("deepseek.com") && model.toLowerCase() === "deepseek-v3") {
    model = "deepseek-chat";
  }
  // 针对于 deepseek 的 API 的转变
  if (baseUrl.endsWith("/v1")) {
    baseUrl = baseUrl.slice(0, -3);
  }

  const [message, setMessage] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const filterUrls = (content, searchEngine) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");
      let searchResults = [];

      if (searchEngine.includes("bing") && !searchEngine.includes("zhihu")) {
        searchResults = Array.from(doc.querySelectorAll(".b_algo")).map((result) => {
          const linkElement = result.querySelector("h2 a");
          const descElement = result.querySelector(".b_caption p");

          return {
            url: linkElement?.href || "",
            title: linkElement?.textContent?.trim() || "无标题",
            description: descElement?.textContent?.trim() || "",
          };
        });
      } else if (searchEngine.includes("baidu")) {
        searchResults = Array.from(doc.querySelectorAll(".result")).map((result) => {
          const linkElement = result.querySelector("h3 a");
          const descElement = result.querySelector(".c-abstract");
          return {
            url: linkElement?.href || "",
            title: linkElement?.textContent?.trim() || "无标题",
            description: descElement?.textContent?.trim() || "",
          };
        });
      } else if (searchEngine.includes("zhihu")) {
        searchResults = Array.from(doc.querySelectorAll(".b_algo")).map((result) => {
          const linkElement = result.querySelector("h2 a");
          const descElement = result.querySelector(".b_caption p");
          return {
            url: linkElement?.href.includes("zhihu.com") ? linkElement?.href : "",
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

      setMessage((prev) => [
        ...prev,
        { role: "user", content: query, isComplete: true },
        initialMessage,
      ]);

      if (baseUrl.includes("s2bapi.zima.pet")) {
        const isEnough = await checkBalance(7, model, 3);
        if (!isEnough) return;
      }

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
                  urlListData: newMessages[lastIndex].urlListData.map((item) => ({
                    ...item,
                    status: 2,
                    iconBackground: "bg-green-500",
                  })),
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
                    relatedQuestions: relatedQuestions || ["服务器繁忙，获取相关问题失败"],
                    questionsLoading: false,
                    isStreaming: false,
                    isComplete: true,
                  },
                ];
              });
            } catch (error) {
              console.error("获取相关问题失败:", error);
              setMessage((prev) => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                return [
                  ...newMessages.slice(0, -1),
                  {
                    ...newMessages[lastIndex],
                    ...updatedMessage,
                    relatedQuestions: ["服务器繁忙，获取相关问题失败"],
                    questionsLoading: false,
                    isStreaming: false,
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
              let searchEngine = await getSearchSourceStorage();
              if (searchEngine.includes("zhihu")) {
                searchEngine = "https://cn.bing.com/search?q=site%3A%2F%2Fzhihu.com%20";
              }
              const filteredUrls = filterUrls(content, searchEngine);
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

            setMessage((prev) =>
              updateLastAssistantMessage(prev, {
                status: "analyzing",
                statusMessage: "正在获取网页内容",
                urlListData: processUrls.map((url) => ({
                  ...url,
                  status: 1,
                  iconBackground: "bg-blue-500",
                })),
              })
            );

            const extractResponse = await chrome.runtime.sendMessage({
              action: "extractMultipleContents",
              urls: processUrls.map((result) => result.url),
            });
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

              const extractedUrls = new Set(extractResponse.contents.map(({ url }) => url));

              const enrichedWebContents = webContents.map((webContent) => ({
                ...webContent,
                title: urlToTitleMap[webContent.url] || webContent.title,
              }));

              if (extractedUrls.size > 0) {
                setMessage((prev) =>
                  updateLastAssistantMessage(prev, {
                    status: "generating",
                    statusMessage: "正在理解网页内容",
                    urlListData: processUrls.map((url) => ({
                      ...url,
                      status: extractedUrls.has(url.url) ? 1 : 3,
                      iconBackground: extractedUrls.has(url.url) ? "bg-green-500" : "bg-red-500",
                    })),
                  })
                );
              } else {
                throw new Error("请检查网络链接，没有搜索到网页内容");
              }

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
                  relatedQuestions: relatedQuestions || ["服务器繁忙，获取相关问题失败"],
                  questionsLoading: false,
                })
              );
            }
          } catch (error) {
            console.error("获取网页内容失败:", error);
            let erroeMessage = "服务器繁忙，请切换其他模型或者检查网络";
            if (error.message.includes("请先在登录知乎网页版后再使用知乎搜索源")) {
              erroeMessage = "请先在登录知乎网页版后再使用知乎搜索源";
            }
            if (error.message.includes("请切换比较大模型的API")) {
              erroeMessage = "请切换比较大模型的API";
            }
            if (error.message.includes("403")) {
              erroeMessage = "请检查该模型的跨域问题";
            }
            if (error.message.includes("没有搜索到网页内容")) {
              erroeMessage = "请检查网络链接，没有搜索到网页内容";
            }
            setMessage((prev) =>
              updateLastAssistantMessage(prev, {
                status: "error",
                statusMessage: erroeMessage,
                content: erroeMessage,
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
      console.error("获取回答失败:", error);
      let erroeMessage = "服务器繁忙，请切换其他模型或者检查网络";
      if (error.message.includes("请先在登录知乎网页版后再使用知乎搜索源")) {
        erroeMessage = "请先在登录知乎网页版后再使用知乎搜索源";
      } else if (error.message.includes("请先在登录小红书网页版后再使用小红书搜索源")) {
        erroeMessage = "请先在登录小红书网页版后再使用小红书搜索源";
      } else if (error.message.includes("请切换比较大模型的API")) {
        erroeMessage = "请切换比较大模型的API";
      } else if (error.message.includes("403")) {
        erroeMessage = "请检查该模型的跨域问题";
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
            content: erroeMessage,
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
