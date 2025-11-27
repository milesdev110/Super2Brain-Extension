import { getUserInput } from "../../../../../public/storage";
import { config } from "../../../../config";

const processDocument = async (messages) => {
  const token = await getUserInput();
  console.log("messages", token);
  try {
    //const apiUrl = config.baseUrl + "/text/v1/chat/completions";
    const apiUrl = config.baseUrl +  "/v1/chat/completions";

    // const model = "gpt-4o-mini";
    const model = "deepseek-chat";

    const requestBody = {
      model,
      messages,
      stream: true,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API 请求失败: ${response.status} ${errorData.error?.message || response.statusText}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    const processStream = async () => {
      const { done, value } = await reader.read();

      if (done) {
        return fullText;
      }

      const chunk = decoder.decode(value, { stream: true });

      const lines = chunk
        .split("\n")
        .filter((line) => line.trim() !== "" && line.trim() !== "data: [DONE]");

      for (const line of lines) {
        try {
          const jsonStr = line.replace(/^data: /, "").trim();
          if (!jsonStr) continue;

          const json = JSON.parse(jsonStr);

          if (
            json?.choices &&
            Array.isArray(json.choices) &&
            json.choices.length > 0 &&
            json.choices[0]?.delta?.content
          ) {
            fullText += json.choices[0].delta.content;
          }
        } catch (e) {
          console.error("解析流数据失败:", e, "原始行数据:", line);
        }
      }

      return processStream();
    };

    // 获取完整文本
    const content = await processStream();

    // 返回与 fetchCompletion 相似的结构
    return {
      choices: [
        {
          message: { content },
        },
      ],
    };
  } catch (error) {
    console.error("处理文档时出错:", error);
    throw error;
  }
};

export { processDocument };
