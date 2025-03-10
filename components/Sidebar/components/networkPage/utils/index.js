import { fetchStreamResponse, handleStreamResponse } from "./api";
import { getSearchSourceStorage } from "../../../../../public/storage";
let flag = false;
const invokeOpenAI = async (messages, model = "gpt-4o-mini", baseUrl, provider, userInput) => {
  const response = await fetchStreamResponse(messages, model, baseUrl, provider, userInput);
  return handleStreamResponse(response, () => {});
};

const generateSearchQuery = async (query, messageHistory, model, baseUrl, provider, userInput) => {
  const contextMessages = messageHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const messages = [
    ...contextMessages,
    {
      role: "user",
      content: `基于我们的对话历史，请将以下用户输入转换为简洁的搜索的问题（不超过15个字）（只返回搜索的问题，不要作其他解释）：
      "${query}"`,
    },
  ];

  try {
    const searchQuery = await invokeOpenAI(messages, model, baseUrl, provider, userInput);
    return searchQuery.trim();
  } catch (error) {
    return query.trim();
  }
};

const createSearchUrl = async (searchQuery) => {
  const cleanedQuery = searchQuery.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const encodedQuery = encodeURIComponent(cleanedQuery);
  let searchSource = await getSearchSourceStorage();
  let searchUrl = "";

  if (!searchSource) {
    searchSource = "https://www.bing.com/search?q=";
  }

  if (searchSource.includes("zhihu.com")) {
    searchUrl = `https://cn.bing.com/search?q=site%3A%2F%2Fzhihu.com%20${encodedQuery}&count=50`;
  } else if (searchSource.includes("bing.com")) {
    searchUrl = `${searchSource}${encodedQuery}&count=50&first=1`;
  } else if (searchSource.includes("baidu.com")) {
    searchUrl = `${searchSource}${encodedQuery}&pn=0&rn=50`;
  } else {
    searchUrl = `${searchSource}${encodedQuery}`;
  }

  return searchUrl;
};

const analyzeAndCreateSearchUrl = async (
  query,
  messageHistory,
  model,
  baseUrl,
  provider,
  userInput
) => {
  const searchQuery = await generateSearchQuery(
    query,
    messageHistory,
    model,
    baseUrl,
    provider,
    userInput
  );
  try {
    const res = await createSearchUrl(searchQuery);
    return res;
  } catch (error) {
    if (error.message.includes("请先在登录知乎网页版后再使用知乎搜索源")) {
      throw error;
    }
    throw error;
  }
};

const analyzeInputType = async (userInput, messageHistory, model, searchEnabled) => {
  if (!searchEnabled) {
    return "CONTEXT_BASED";
  } else {
    return "SEARCH";
  }
};

const processStreamContent = (content, reasoningContent, { fullContent, fullReasoningContent }) => {
  const updateState = ({ content, reasoningContent }) => ({
    isReasoningSection: Boolean(reasoningContent),
    fullContent: content ? fullContent + content : fullContent,
    fullReasoningContent: reasoningContent
      ? fullReasoningContent + reasoningContent
      : fullReasoningContent,
  });

  return updateState({ content, reasoningContent });
};

const streamHandler = async (stream, onStreamProgress) => {
  let state = {
    fullContent: "",
    fullReasoningContent: "",
  };

  await handleStreamResponse(stream, (data) => {
    const { delta } = data?.choices[0] || {};
    if (delta && (delta?.content || delta?.reasoning_content)) {
      if (delta?.content.includes("<think>")) {
        flag = true;
      }

      if (delta?.content.includes("</think>")) {
        flag = false;
      }

      if (flag) {
        state = processStreamContent("", delta?.content || "", state);
      } else {
        state = processStreamContent(
          delta?.content || "",
          delta?.reasoning_content === "undefined" ? "" : delta?.reasoning_content,
          state
        );
      }
    }
    if (data?.choices[0]?.finish_reason === "stop") {
      onStreamProgress?.({
        state: 2,
        response: state?.fullContent.trim(),
        reasoning_content: state?.fullReasoningContent.trim(),
        isComplete: true,
      });
    } else {
      onStreamProgress?.({
        state: 2,
        response: state?.fullContent.trim(),
        reasoning_content: state?.fullReasoningContent.trim(),
        isComplete: false,
      });
    }
  });

  return {
    content: state?.fullContent.trim(),
    reasoning_content: state?.fullReasoningContent.trim(),
  };
};

const mapToContextFormat = (messages) =>
  messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

const buildMessages = (contextMessages, query) => [
  {
    role: "system",
    content: "回答用户的提问，结合历史对话，给出详细的回答。",
  },
  ...contextMessages,
  {
    role: "user",
    content: `"${query}"`,
  },
];

const getDirectResponse = async (
  query,
  messageHistory,
  model,
  baseUrl,
  provider,
  userInput,
  onStreamProgress
) => {
  const contextMessages = mapToContextFormat(messageHistory);

  const messages = buildMessages(contextMessages, query);

  try {
    const response = await fetchStreamResponse(messages, model, baseUrl, provider, userInput);
    const result = await streamHandler(response, onStreamProgress);
    return {
      ...result,
      isComplete: true,
    };
  } catch (error) {
    throw error;
  }
};

const getResponse = async (
  query,
  searchEnabled,
  onProgress,
  messageHistory = [],
  model = "gpt-4o-mini",
  baseUrl,
  provider,
  userInput
) => {
  flag = false;
  const inputType = await analyzeInputType(query, messageHistory, model, searchEnabled);

  if (inputType === "SEARCH") {
    try {
      const searchUrl = await analyzeAndCreateSearchUrl(
        query,
        messageHistory,
        model,
        baseUrl,
        provider,
        userInput
      );
      onProgress({ state: 1, searchUrl });
    } catch (error) {
      if (error.message.includes("请先在登录知乎网页版后再使用知乎搜索源")) {
        throw error;
      }
      throw error;
    }
  } else if (["GREETING", "TRANSLATION", "CONTEXT_BASED", "UNKNOWN"].includes(inputType)) {
    try {
      const response = await getDirectResponse(
        query,
        messageHistory,
        model.toLowerCase(),
        baseUrl,
        provider,
        userInput,
        (progress) => {
          onProgress({
            state: 2,
            response: progress.response,
            reasoningContent: progress.reasoning_content,
            isComplete: progress.isComplete,
          });
        }
      );
      return response;
    } catch (error) {
      throw error;
    }
  }
};

export { getResponse };
