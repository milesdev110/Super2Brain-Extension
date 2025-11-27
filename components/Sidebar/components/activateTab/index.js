import React, { useCallback } from "react";
import { ChatMessageList } from "./modules/chatMessageList";
import { TextareaRef } from "./modules/textarea";
import { LEGAL_RISK_QUESTION, COST_EFFECTIVE_QUESTION, BID_PROPOSAL_QUESTION } from "../../config/models";

const ActivateTabChatPanel = ({
  pageContent,
  useInput,
  selectedModelProvider,
  selectedModelIsSupportsImage,
  setSelectedModelProvider,
  setSelectedModelIsSupportsImage,
  getCurrentUrlMessages,
  isAiThinking,
  copiedMessageId,
  onCopy,
  onRetry,
  onSubmit,
  clearCurrentUrlMessages,
  currentUrl,
  selectedModel,
  setSelectedModel,
  isContentReady,
  setActivatePage,
  currentUrlRelatedQuestions,
  currentUrlLoading,
  thinkingTimeMap,
}) => {
  const handleQuestionClick = useCallback(
    (question, reason_content) => {
      if (!question) return;


      console.log("question", question);
      console.log("reason_content", reason_content);
      
    // 处理特定问题
    let processedMessage = question;
    switch (question) {
      case LEGAL_RISK_QUESTION:
        processedMessage = "请分析当前项目是否存在法律风险，包括但不限于知识产权、合同条款、合规性等方面，并给出具体建议。";
        break;
      case COST_EFFECTIVE_QUESTION:
        processedMessage = "请从功能、成本、市场竞争、技术实现难度等维度评估当前项目的性价比，并提供详细分析。";
        break;
      case BID_PROPOSAL_QUESTION:
        processedMessage = "请为当前项目生成一份专业的投标文案，包括项目理解、实施方案、团队优势、服务承诺等内容。";
        break;
      default:
        // 其他情况保持原样
        processedMessage = question;
    }
      const message = {
        role: "user",
        content: processedMessage,
        isFromSuggestion: true,
      };

      if (reason_content) {
        message.reason_content = reason_content;
      }

      onSubmit([message], false);
    },
    [onSubmit]
  );

  const handleSubmit = useCallback(
    (messages, isRetry = false) => {
      onSubmit(messages, isRetry);
    },
    [onSubmit]
  );

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-8px)] overflow-hidden bg-white rounded-xl">
      <div className="flex-1 overflow-y-auto">
        <ChatMessageList
          currentUrlRelatedQuestions={currentUrlRelatedQuestions}
          currentUrlLoading={currentUrlLoading}
          currentUrl={currentUrl}
          messages={getCurrentUrlMessages()}
          isAiThinking={isAiThinking}
          copiedMessageId={copiedMessageId}
          onCopy={onCopy}
          onRetry={onRetry}
          onQuestionClick={handleQuestionClick}
          thinkingTimeMap={thinkingTimeMap}
        />
      </div>
      <div className="p-4 bg-white w-full">
        <TextareaRef
          pageContent={pageContent}
          setActivatePage={setActivatePage}
          isContentReady={isContentReady}
          useInput={useInput}
          selectedModelProvider={selectedModelProvider}
          selectedModelIsSupportsImage={selectedModelIsSupportsImage}
          setSelectedModelProvider={setSelectedModelProvider}
          setSelectedModelIsSupportsImage={setSelectedModelIsSupportsImage}
          onSubmit={handleSubmit}
          onReset={clearCurrentUrlMessages}
          currentUrl={currentUrl}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          isAiThinking={isAiThinking}
          messages={getCurrentUrlMessages()}
        />
      </div>
    </div>
  );
};

export { ActivateTabChatPanel };
