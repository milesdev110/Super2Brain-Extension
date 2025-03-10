import { config } from "../../../../config/index";

export const fetchStreamResponse = async (
  messages,
  model = "gpt-4o-mini",
  baseUrl = config.baseUrl,
  provider = "super2brain",
  apiKey = ""
) => {
  if (baseUrl?.includes("deepseek") && model?.toLowerCase() === "deepseek-r1") {
    model = "deepseek-reasoner";
  } else if (baseUrl?.includes("deepseek") && model?.toLowerCase() === "deepseek-v3") {
    model = "deepseek-chat";
  }

  const headers = {
    "Content-Type": "application/json",
    ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
  };

  try {
    const supportedProviders = [
      "super2brain",
      "deepseek",
      "openai",
      "lmstudio",
      "ollama",
      "custom",
    ];

    if (supportedProviders?.includes(provider)) {
      let adjustedBaseUrl = baseUrl;

      if (baseUrl.endsWith("/v1")) {
        adjustedBaseUrl = baseUrl.slice(0, -3);
      }

      const endpoint = {
        super2brain: `${adjustedBaseUrl}/text/v1/chat/completions`,
        lmstudio: `${adjustedBaseUrl}/v1/chat/completions`,
        ollama: `${adjustedBaseUrl}/v1/chat/completions`,
        default: `${adjustedBaseUrl}/v1/chat/completions`,
      };

      const requestBody = {
        messages: messages,
        model: model.toLowerCase(),
        stream: true,
      };

      const response = await fetch(endpoint[provider] || endpoint.default, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider} API 请求失败: ${response.status} - ${errorText}`);
      }

      return response;
    }
  } catch (error) {
    console.error(`${provider} 请求发送失败:`, error);
    throw new Error(`请求失败: ${error.message}`);
  }
};

export const handleStreamResponse = async (stream, onProgress) => {
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let reasoningContent = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const decodedValue = decoder.decode(value, { stream: true });
      buffer += decodedValue;

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "" || line.trim() === "data: [DONE]") continue;
        try {
          const cleanLine = line.replace(/^data:\s*/, "").trim();
          if (!cleanLine) continue;

          if (cleanLine.includes("Trying to keep the first ")) {
            throw new Error("请切换比较大模型的API");
          }

          const data = JSON.parse(cleanLine);
          if (
            data?.choices &&
            (data?.choices[0]?.delta?.content !== "" ||
              data?.choices[0]?.delta?.reasoning_content !== "" ||
              data?.choices[0]?.finish_reason)
          ) {
            fullContent += data?.choices[0]?.delta?.content || "";
            reasoningContent += data?.choices[0]?.delta?.reasoning_content || "";
            if (
              data?.choices[0]?.delta?.content ||
              data?.choices[0]?.delta?.reasoning_content ||
              data?.choices[0]?.finish_reason
            ) {
              onProgress?.(data);
            }
          } else {
            console.error("无效的 API 响应:", data);
          }
        } catch (e) {
          console.error("解析流数据失败:", e, "原始行数据:", line);
          if (line.includes("Trying to keep the first ")) {
            throw new Error("请切换比较大模型的API");
          }
        }
      }
    }
  } catch (error) {
    console.error("流处理错误:", error);
    throw error;
  }

  return fullContent;
};
