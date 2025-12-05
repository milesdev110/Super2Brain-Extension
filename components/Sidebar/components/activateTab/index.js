import React, { useCallback } from "react";
import { ChatMessageList } from "./modules/chatMessageList";
import { TextareaRef } from "./modules/textarea";
import { LEGAL_RISK_QUESTION, COST_EFFECTIVE_QUESTION, BID_PROPOSAL_WITH_PROJECT_QUESTION, BID_PROPOSAL_WITHOUT_PROJECT_QUESTION, PROJECT_MATCHING_QUESTION, MY_PROJECT_INFO } from "../../config/models";

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
        processedMessage = `请分析当前项目是否存在法律风险，比如破解三方软件、演唱会门票刷票脚本是有法律风险的项目，不要参与。
        回答结构：总分结构。先给出结论，再给出不超过100字的分析。`;
        break;
      case COST_EFFECTIVE_QUESTION:
        processedMessage = `从价格预算、工作量、技术实现难度、
        未来是否有多次合作的可能性（项目中如果有提起长期项目或者长期合作表示可以长期可做）、
        项目后续是否可重复利用（主流项目可以重复使用、小众项目不可以）、
        项目是否具有合适的门槛（门槛太低可能导致竞争红海）、
        过往项目匹配度（过往项目：${MY_PROJECT_INFO}）、
        等维度评估当前项目的性价比，并提供详细分析。
        投入产出比ROI满分10分。6分是B级别项目，8分是A级别项目, 9分是S级项目。
        回答结构：先给出详细思考过程，再给结论以及项目评分。
        `;
        break;
      case BID_PROPOSAL_WITH_PROJECT_QUESTION:
        processedMessage = `请为当前项目生成一份专业的投标文案, 长度300字左右，包括项目理解、实施方案、团队优势、服务承诺等内容。
        可以适度结合过往项目：${MY_PROJECT_INFO}。
        注意：不需要使用markdown格式，请使用纯文本。
        模板：
        尊敬的雇主，您好！
首先，感谢您发布项目。
1.【开发计划】我们研究之后发现咱们的项目需求比较多，我们这里的开发方案是分为三期开发，分期结算酬金。方便您控制软件开发风险。
2.【团队优势】团队核心成员拥有多年智能软件发经验，曾就职于小米等知名科技公司，具备成熟的大厂技术背景与项目管理能力；
技术方案可靠，产品质量有保障，同时具备成本优势，能为客户提供高性价比的定制化解决方案。
3.【产品交付】我们不仅交付所有的源码以及所有UI设计，也包括技术文档。方便您后面二次定制开发。
4.【后续支持】我们提供后续免费一个月技术支持，期间发现问题可以免费修改2次。如果后面还有新需求也可以长期合作。
我们追求的不是最低的价格，而是高可用的软件。再次感谢雇主您考虑我的方案，希望有进一步沟通的机会。
欢迎微信/电话详谈：15757829540`;
        break;
      case BID_PROPOSAL_WITHOUT_PROJECT_QUESTION:
        processedMessage = `请为当前项目生成一份专业的投标文案, 长度300字左右，包括项目理解、实施方案、团队优势、服务承诺等内容。
        注意：不需要使用markdown格式，请使用纯文本。
        模板：
        尊敬的雇主，您好！
首先，感谢您发布项目。
1.【开发计划】我们研究之后发现咱们的项目需求比较多，我们这里的开发方案是分为三期开发，分期结算酬金。方便您控制软件开发风险。
2.【团队优势】团队核心成员拥有多年智能软件发经验，曾就职于小米等知名科技公司，具备成熟的大厂技术背景与项目管理能力；
技术方案可靠，产品质量有保障，同时具备成本优势，能为客户提供高性价比的定制化解决方案。
3.【产品交付】我们不仅交付所有的源码以及所有UI设计，也包括技术文档。方便您后面二次定制开发。
4.【后续支持】我们提供后续2个月的免费的技术支持，期间发现问题可以免费修改2次。如果后面还有新需求也可以长期合作。
(如果是2万以上的项目，提供2个月技术支持，5万以上提供3个月技术支持。如果是10万以上的项目，提供6个月技术支持。
我们追求的不是最低的价格，而是高可用的软件。再次感谢雇主您考虑我的方案，希望有进一步沟通的机会。
欢迎微信/电话详谈：15757829540`;
        break;
      case PROJECT_MATCHING_QUESTION:
        processedMessage = `请分析当前项目与我的需求是否匹配度高，是否符合我的需求。
        我的项目信息如下：` + MY_PROJECT_INFO
        + "回答结构：先给出详细思考过程，再给结论以及项目匹配度评分。匹配度分为10分，10分是完全匹配，0分是完全不匹配"
        + "如果技术匹配项目不匹配给6分。如果项目匹配技术不匹配给4分。如果项目技术都匹配给8分以上。如果项目技术都不匹配给2分一下。"
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
