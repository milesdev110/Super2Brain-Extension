import { getUserInput } from "../../../public/storage.js";
import { config } from "../../config/index";
import { LEGAL_RISK_QUESTION, COST_EFFECTIVE_QUESTION, BID_PROPOSAL_WITH_PROJECT_QUESTION,BID_PROPOSAL_WITHOUT_PROJECT_QUESTION,PROJECT_MATCHING_QUESTION } from "../config/models";

const fetchRelatedQuestions = async (messages, fullResponse) => {
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
          
        原问题：${
          messages[messages.length - 2].content?.text || messages[messages.length - 1].content
        }
        回答：${fullResponse}

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

const MessageRole = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
};

const createUnifiedRequest = (messages, options = {}) => ({
  messages: messages.map((msg) => {
    const message = {
      role: msg.role,
      content: msg.imageData
        ? [
            { type: "text", text: msg.content },
            {
              type: "image_url",
              image_url: { url: msg.imageData },
            },
          ]
        : msg.content,
    };

    if (msg.reason_content) {
      message.reason_content = msg.reason_content;
    }

    return message;
  }),
  model: options.model,
  ...options,
});

const modelAdapters = {
  deepseek: {
    baseUrl: "/v1/chat/completions",
    transformRequest: (unifiedRequest) => ({
      model: unifiedRequest.model || "deepseek-chat",
      messages: unifiedRequest.messages,
      temperature: unifiedRequest.temperature ?? 0.7,
      max_tokens: unifiedRequest.maxTokens,
      stream: true,
    }),
    transformResponse: (response) => ({
      content: response.choices[0].message.content,
      reason_content: response.choices[0].message.reasoning_content,
      usage: response.usage,
    }),
  },
  openai: {
    baseUrl: "/v1/chat/completions",
    transformRequest: (unifiedRequest) => ({
      model: unifiedRequest.model,
      messages: unifiedRequest.messages,
      temperature: unifiedRequest.temperature ?? 0.7,
      max_tokens: unifiedRequest.maxTokens,
      stream: true,
    }),
    transformResponse: (response) => ({
      content: response.choices[0].message.content,
      usage: response.usage,
    }),
  },
  claude: {
    baseUrl: "/v1/messages",
    transformRequest: (unifiedRequest) => ({
      model: unifiedRequest.model,
      messages: unifiedRequest.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: unifiedRequest.temperature ?? 0.7,
      max_tokens: unifiedRequest.maxTokens,
      stream: true,
    }),
    transformResponse: (response) => ({
      content: response.content[0].text,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    }),
  },
  super2brain: {
    baseUrl: "/v1/chat/completions",
    transformRequest: (unifiedRequest) => ({
      model: unifiedRequest.model,
      messages: unifiedRequest.messages,
      temperature: unifiedRequest.temperature ?? 0.7,
      max_tokens: unifiedRequest.maxTokens,
      stream: true,
    }),
    transformResponse: (response) => ({
      content: response.choices[0].message.content,
      reason_content: response.choices[0].message.reasoning_content,
      usage: response.usage,
    }),
  },
  ollama: {
    baseUrl: "/v1/chat/completions",
    transformRequest: (unifiedRequest) => ({
      model: unifiedRequest.model,
      messages: unifiedRequest.messages,
      temperature: unifiedRequest.temperature ?? 0.7,
      max_tokens: unifiedRequest.maxTokens,
      stream: true,
    }),
    transformResponse: (response) => ({
      content: response.choices[0].message.content,
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    }),
  },
  custom: {
    baseUrl: "/v1/chat/completions",
    transformRequest: (unifiedRequest) => ({
      model: unifiedRequest.model,
      messages: unifiedRequest.messages.map((msg) => ({
        role: msg.role,
        content: Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }],
      })),
      temperature: unifiedRequest.temperature ?? 0.7,
      max_tokens: unifiedRequest.maxTokens,
      stream: true,
    }),
    transformResponse: (response) => ({
      content: response.choices[0].message.content,
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    }),
  },
  lmstudio: {
    baseUrl: "/v1/chat/completions",
    transformRequest: (unifiedRequest) => ({
      model: unifiedRequest.model,
      messages: unifiedRequest.messages.map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
            ? msg.content.map((c) => c.text).join("\n")
            : "",
      })),
      temperature: unifiedRequest.temperature ?? 0.7,
      max_tokens: unifiedRequest.maxTokens,
      stream: true,
    }),
    transformResponse: (response) => ({
      content: response.choices[0].message.content,
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    }),
  },
};

const MODEL_MAPPING = {
  "deepseek-v3": "deepseek-chat",
  "deepseek-r1": "deepseek-r1",
  "Deepseek-V3": "deepseek-chat",
  "Deepseek-R1": "deepseek-r1",
  "claude-3.5-sonnet": "claude-3-5-sonnet-20241022",
};

const removeTrailingV1 = (url) => (url.endsWith("/v1") ? url.slice(0, -3) : url);

const callAI = async ({ provider, baseUrl, apiKey, model, messages, options = {} }) => {
  const cleanBaseUrl = removeTrailingV1(baseUrl);
  const adapter = modelAdapters[provider];
  let mappedModel = MODEL_MAPPING[model.toLowerCase()] || model;
  if (provider === "deepseek" && model === "deepseek-v3") {
    mappedModel = "deepseek-chat";
  } else if (provider === "deepseek" && model === "deepseek-r1") {
    mappedModel = "deepseek-reasoner";
  }
  if (!adapter) {
    throw new Error(`不支持的 AI 提供商: ${provider}`);
  }
  let questionContent = "";
  try {
    const response = await fetch(`${cleanBaseUrl}${adapter.baseUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(
        adapter.transformRequest(
          createUnifiedRequest(messages, {
            ...options,
            model: mappedModel,
            stream: true,
          })
        )
      ),
    });

    if (response.status === 402) {
      throw new Error("余额不足");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let fullReasoningContent = "";
    let lastChunkData = null;
    let flag = false;
    let thinkingFlag = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const chunkData = JSON.parse(data);
            lastChunkData = chunkData;

            if (
              provider === "custom" ||
              provider === "openai" ||
              provider === "deepseek" ||
              provider === "super2brain" ||
              provider === "lmstudio" ||
              provider === "ollama"
            ) {
              if (chunkData.choices[0]?.delta) {
                const currentContent = chunkData.choices[0]?.delta?.content || "";

                if (currentContent.includes("<think>")) flag = true;
                if (currentContent.includes("</think>")) flag = false;

                if (!thinkingFlag && currentContent.includes("```thinking")) {
                  thinkingFlag = true;
                  const parts = currentContent.split("```thinking");
                  if (parts.length > 1) {
                    fullContent += parts[0];
                    fullReasoningContent += parts[1];
                  } else {
                    fullReasoningContent += currentContent;
                  }
                  continue;
                }

                if (chunkData.choices[0]?.delta?.reasoning_content) {
                  fullReasoningContent += chunkData.choices[0].delta.reasoning_content;
                }

                if (flag || thinkingFlag) {
                  if (thinkingFlag && currentContent.includes("```")) {
                    const parts = currentContent.split("```");
                    fullReasoningContent += parts[0];

                    if (parts.length > 1) {
                      fullContent += parts.slice(1).join("```");
                    }

                    thinkingFlag = false;
                  } else {
                    fullReasoningContent += currentContent;
                  }
                } else {
                  fullContent += currentContent;
                }

                if (thinkingFlag) {
                  const combinedContent = fullReasoningContent;
                  const matches = combinedContent.match(/```/g) || [];
                  if (matches.length % 2 === 0 && matches.length > 0) {
                    thinkingFlag = false;
                  }
                }
              }
            }

            if (
              chunkData.choices[0]?.delta?.reason_content === "undefined" ||
              chunkData.choices[0]?.delta?.reason_content === null
            ) {
              fullReasoningContent = "";
            }

            if (options.onProgress) {
              if (flag || thinkingFlag) {
                options.onProgress({
                  state: 1,
                  response: {
                    content: "",
                    reasoning_content: chunkData.choices[0]?.delta?.content || "",
                  },
                });
              } else {
                options.onProgress({
                  state: 1,
                  response: {
                    content: chunkData.choices[0]?.delta?.content || "",
                    reasoning_content:
                      chunkData.choices[0]?.delta?.reasoning_content === "undefined"
                        ? null
                        : chunkData.choices[0]?.delta?.reasoning_content || "",
                  },
                });
              }
            }
          } catch (e) {
            console.error("解析流式数据失败:", e);
          }
        }
      }
    }

    const thinkingBlockRegex = /```thinking([\s\S]*?)```/g;
    const thinkingMatches = [...fullContent.matchAll(thinkingBlockRegex)];

    if (thinkingMatches.length > 0) {
      const thinkingContent = thinkingMatches.map((match) => match[1].trim()).join("\n");
      fullReasoningContent += thinkingContent;
      fullContent = fullContent.replace(thinkingBlockRegex, "");
    }

    const thinkTagRegex = /<think>([\s\S]*?)<\/think>/g;
    const thinkTagMatches = [...fullContent.matchAll(thinkTagRegex)];

    if (thinkTagMatches.length > 0) {
      const thinkTagContent = thinkTagMatches.map((match) => match[1].trim()).join("\n");
      fullReasoningContent += thinkTagContent;
      fullContent = fullContent.replace(thinkTagRegex, "");
    }

    const simulatedResponse = {
      choices: [
        {
          message: {
            content: fullContent,
            ...(fullReasoningContent && {
              reasoning_content: fullReasoningContent,
            }),
          },
        },
      ],
      usage: lastChunkData?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
    options?.onProgress({
      state: 3,
      isRelatedQuestions: true,
    });
    const relatedQuestions = [LEGAL_RISK_QUESTION, PROJECT_MATCHING_QUESTION, COST_EFFECTIVE_QUESTION, BID_PROPOSAL_WITH_PROJECT_QUESTION, BID_PROPOSAL_WITHOUT_PROJECT_QUESTION]; //await fetchRelatedQuestions(messages, fullContent);
    options.onProgress({
      state: 2,
      relatedQuestions,
      isRelatedQuestions: false,
    });
    return adapter.transformResponse(simulatedResponse);
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw new Error("请求超时，请稍后再试，请检查你的网络或切换模型");
    }
    console.error(`${provider} API 调用失败:`, error);
    throw error;
  }
};

export { callAI, MessageRole };
