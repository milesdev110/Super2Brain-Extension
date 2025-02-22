import { Settings } from "lucide-react";
import { useState } from "react";

export const useDeepSearch = (
  userInput,
  maxDepth = 3,
  getNeedTime,
  calculateModelCalls,
  checkBalance,
  setIsShowModal,
  apikey,
  baseUrl
) => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [hasError, setHasError] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");

  const handleSendMessage = async (question, getResponse) => {
    if (currentStatus.length > 0) setCurrentStatus("");
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    setHasError(false);

    const userMessage = { role: "user", content: question, isComplete: true };
    setMessages([userMessage]);

    try {
      const aiMessage = {
        role: "assistant",
        status: "thinking",
        content: currentStatus,
        isComplete: false,
      };
      console.log(baseUrl);
      if (baseUrl.includes("s2bapi.zima.pet")) {
        const { selectModelTime, baseModelTime } = calculateModelCalls(maxDepth, selectedModel);

        const isBalance = await checkBalance(selectModelTime, selectedModel, baseModelTime);

        if (!isBalance) {
          setMessages([]);
          setIsShowModal(true);
          return;
        }
      }

      setMessages([userMessage, aiMessage]);
      const needTime = getNeedTime(maxDepth);
      const response = await getResponse(
        question,
        0,
        maxDepth,
        selectedModel,
        apikey,
        baseUrl,
        (status) => {
          setCurrentStatus(status);
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === "assistant" && !lastMessage.isComplete) {
              lastMessage.content = status;
            }
            return newMessages;
          });
        }
      );

      setMessages([
        userMessage,
        {
          role: "assistant",
          content: response,
          isComplete: true,
        },
      ]);
    } catch (error) {
      console.error("发送消息失败:", error);
      setHasError(true);
      const errorMessage =
        error.message.includes("链接超时") || error.message.includes("余额不足")
          ? error.message
          : "抱歉，深度思考过程中出现错误。请稍后重试或联系支持团队。<br> 1. 检查网络连接<br> 2. 检查API密钥<br> 3. 检查余额 <br> 4. 如果是自定义模型的话，请检查模型是否太小。";
      const errorTitle = "深度思考失败";
      setMessages([
        userMessage,
        {
          role: "assistant",
          content: errorMessage,
          isComplete: true,
          isError: true,
          errorTitle: errorTitle,
        },
      ]);
    } finally {
      setIsLoading(false);
      setCurrentStatus("");
    }
  };

  const handleSetSelectedModel = (model) => {
    setSelectedModel(model);
  };

  return {
    query,
    setQuery,
    messages,
    setMessages,
    isLoading,
    currentStatus,
    handleSendMessage,
    hasError,
    selectedModel,
    setSelectedModel: handleSetSelectedModel,
  };
};
