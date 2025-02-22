import { fetchStreamResponse, handleStreamResponse } from "./api";
export const createWebContent = (url, content, query) => ({
  url,
  content: content || "",
  query,
  timestamp: new Date().toISOString(),
});

export const createThingAgent = ({
  apiKey,
  model = "gpt-4o-mini",
  baseURL,
  provider,
}) => {
  if (model === "Deepseek-R1") {
    model = "asoner";
  } else if (model === "Deepseek-V3") {
    model = "deepseek-chat";
  }

  const fetchCompletion = async (messages, stream = false) => {
    console.log("apiKey", apiKey);
    if (!stream) {
      const response = await fetchStreamResponse(
        messages,
        model,
        baseURL,
        provider,
        apiKey
      );
      const content = await handleStreamResponse(response);
      return {
        choices: [
          {
            message: { content },
          },
        ],
      };
    }
    return handleStream(
      await fetchStreamResponse(messages, model, baseURL, provider, apiKey)
    );
  };

  const handleStream = async (response, onStreamUpdate) => {
    let fullContent = "";
    let fullReasoningContent = "";
    let flag = false;
    let lastUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    await handleStreamResponse(response, (data) => {
      const { delta } = data?.choices[0] || {};

      if (delta?.content.includes("<think>")) {
        flag = true;
      }

      if (delta?.content.includes("</think>")) {
        flag = false;
      }

      if (flag) {
        fullReasoningContent += delta?.content || "";
      } else {
        fullContent += delta?.content || "";
        fullReasoningContent += delta?.reasoning_content || "";
        lastUsage = data?.usage || lastUsage;

        onStreamUpdate?.({
          content: fullContent,
          reasoningContent: fullReasoningContent,
        });
      }

      if (data?.choices[0]?.finish_reason === "stop") {
        onStreamUpdate?.({
          content: fullContent,
          reasoningContent: fullReasoningContent,
        });
      }
    });

    return {
      content: fullContent,
      reasoning_content: fullReasoningContent,
      usage: lastUsage,
    };
  };

  const analyzeQueryPrompt = `请分析用户的问题,提取出需要重点关注的方面。
        请用简洁的方式列出关键点。`;

  const conversationPrompt = `基于之前的对话和新的内容,请:
        1. 吸收新内容中的相关信息
        2. 完善和补充已有的理解
        3. 给出更全面的答案
        请保持答案的连贯性和完整性。`;

  const analyzeQuery = async (query, apiKey) => {
    const response = await fetchCompletion([
      { role: "system", content: analyzeQueryPrompt },
      { role: "user", content: query },
    ]);
    return response.choices[0].message.content;
  };

  const processDocuments = async (
    query,
    documents,
    messageHistory,
    onStatusUpdate,
    onStreamUpdate
  ) => {
    const focusPoints = await analyzeQuery(query, apiKey);
    const contextMessages = messageHistory.map(({ role, content }) => ({
      role,
      content,
    }));

    const documentResponses = await Promise.all(
      documents.map(async (doc) => {
        onStatusUpdate?.(doc.url, 1);

        const response = await fetchCompletion([
          { role: "system", content: conversationPrompt },
          ...contextMessages,
          {
            role: "user",
            content: `问题: ${query}\n关注点: ${focusPoints}\n当前内容: ${doc.content}`,
          },
        ]);

        onStatusUpdate?.(doc.url, 2);
        return response?.choices[0]?.message?.content;
      })
    );

    const combinedContent = documentResponses.join("\n\n");

    const response = await fetchStreamResponse(
      [
        {
          role: "system",
          content: "请总结和整合以下所有内容，给出一个完整的回答：",
        },
        ...contextMessages,
        {
          role: "user",
          content: `问题: ${query}\n关注点: ${focusPoints}\n所有内容:\n${combinedContent}`,
        },
      ],
      model,
      baseURL,
      provider,
      apiKey
    );

    return handleStream(response, onStreamUpdate);
  };

  return {
    chat: async (
      query,
      documents,
      messageHistory = [],
      onStatusUpdate,
      onStreamUpdate
    ) => {
      try {
        return await processDocuments(
          query,
          documents,
          messageHistory,
          onStatusUpdate,
          onStreamUpdate
        );
      } catch (error) {
        console.error("Agent error:", error);
        console.error("Error stack:", error.stack);
        throw new Error(`处理对话时发生错误: ${error.message}`);
      }
    },
  };
};
