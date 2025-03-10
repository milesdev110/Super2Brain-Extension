import React, { useState, useEffect, useRef, useCallback } from "react";
import { marked } from "marked";
import {
  Bot,
  Copy,
  Check,
  Loader2,
  MessageSquare,
  Globe,
  ChevronRight,
  FileSearch,
} from "lucide-react";
import { Loading } from "../../common/loading";
import katex from "katex";
import "katex/dist/katex.min.css";
import { AnswerQuestion } from "./answerQuestion";
const MessageContent = ({
  content,
  reason_content,
  messageId,
  isAiThinking,
  timestamp,
  isExpanded,
  relatedQuestions = [],
  isAssistant,
  isRelatedQuestions,
  isShowRelatedQuestions,
}) => {
  const [isContentExpanded, setIsContentExpanded] = useState(isExpanded);
  const [time, setTime] = useState(0);
  const toggleExpand = () => {
    setIsContentExpanded(!isContentExpanded);
  };

  const commonClassNames = `text-sm break-words leading-relaxed  overflow-wrap break-word
    prose-p:line-height-6 prose-p:pb-0 prose-p:mb-0  prose-p:text-stone-900 prose-p:text-[14px]
    prose-h1:text-black prose-h1:mb-2 prose-h1:mt-2 prose-h1:leading-6 prose-h1:text-[20px]
    prose-h2:text-black prose-h2:mb-2 prose-h2:mt-2 prose-h2:leading-6 prose-h2:text-[18px]
    prose-h3:text-black prose-h3:mb-2 prose-h3:mt-2 prose-h3:leading-6 prose-h3:text-[18px]
    prose-h4:text-black prose-h4:mb-2 prose-h4:mt-2 prose-h4:leading-6 prose-h4:text-[16px]
    prose-h5:text-black prose-h5:mb-2 prose-h5:mt-2 prose-h5:leading-6 prose-h5:text-[16px]
    prose-h6:text-black prose-h6:mb-2 prose-h6:mt-2 prose-h6:leading-6 prose-h6:text-[16px]
    prose-ul:text-stone-900 prose-ul:mb-0 prose-ul:leading-6
    prose-ol:text-stone-900 prose-ol:mb-0 prose-ol:leading-6
    prose-li:text-stone-900 prose-li:mb-0 prose-li:leading-6
    prose-hr:hidden prose-hr:border-none prose-hr:m-0
    prose-code:text-black
    prose-pre:before:content-none prose-pre:after:content-none prose-pre:text-black prose-pre:rounded-md prose-pre:whitespace-pre-wrap prose-pre:bg-gray-100
    prose-code:bg-gray-200 prose-code:text-black prose-code:p-1 prose-code:rounded-md prose-code:whitespace-pre-wrap prose-code:my-4 prose-code:mx-2
    [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded-md [&_pre]:w-full [&_pre]:block [&_pre]:whitespace-pre-wrap [&_pre]:break-words
    [&_pre_code]:bg-gray-100 [&_pre_code]:w-full [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:my-2 [&_pre_code]:mx-0 [&_pre_code]:block [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-words
    prose-blockquote:font-medium prose-blockquote:italic prose-blockquote:text-[var(--tw-prose-quotes)] prose-blockquote:border-l-[0.25rem] prose-blockquote:border-l-[var(--tw-prose-quote-borders)] prose-blockquote:mt-6 prose-blockquote:mb-6 prose-blockquote:pl-4
    prose-table:mt-4 prose-table:mb-4 prose-table:w-full prose-table:overflow-hidden prose-table:border-collapse prose-table:border prose-table:border-gray-300
    prose-th:py-2 prose-th:px-4 prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:text-left
    prose-td:py-2 prose-td:px-4 prose-td:border prose-td:border-gray-300
  `;

  const processLatex = (content) => {
    content = content.replace(/\\\[([\s\S]*?)\\\]/g, (match, tex) => {
      try {
        return katex.renderToString(tex.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch (err) {
        console.error("LaTeX渲染错误:", err);
        return match;
      }
    });

    // 处理其他格式的公式
    return content.replace(
      /\$\$(.*?)\$\$|\$(.*?)\$|\/\[(.*?)\]/g,
      (match, block, inline, bracket) => {
        try {
          const tex = block || inline || bracket;
          const isBlock = !!block;
          if (!tex) return match;

          return katex.renderToString(tex.trim(), {
            displayMode: isBlock,
            throwOnError: false,
          });
        } catch (err) {
          console.error("LaTeX渲染错误:", err);
          return match;
        }
      }
    );
  };

  const renderContent = (text) => ({
    __html: marked(processLatex(text), {
      breaks: true,
      gfm: true,
    }),
  });

  useEffect(() => {
    if (content === "" && reason_content === "") {
      const intervalId = setInterval(() => {
        setTime((prevTime) => Math.floor((Date.now() - timestamp) / 1000));
      }, 1000);

      return () => clearInterval(intervalId);
    }
  }, [content, reason_content, timestamp]);

  return (
    <>
      <div className="space-y-3">
        {content === "" && reason_content === "" && (
          <div className="text-sm text-gray-500 animate-pulse flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            S2B正在思考中（{time}s）
          </div>
        )}
        {reason_content && reason_content.trim() && (
          <div>
            <button
              onClick={toggleExpand}
              className="flex items-center gap-2 text-gray-500 hover:text-stone-700 mb-2 transition-colors duration-200"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 
                ${isContentExpanded ? "rotate-90" : ""}`}
              />
              <span className="text-sm">思考过程</span>
            </button>

            {isContentExpanded && (
              <div
                className="p-3 bg-gray-50 rounded-lg text-sm text-stone-800
                border border-gray-100 transition-all duration-200 prose-p:text-[14px] prose-p:leading-6
                [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-words
                "
              >
                <div dangerouslySetInnerHTML={renderContent(reason_content)} />
              </div>
            )}
          </div>
        )}

        {Array.isArray(content) ? (
          <div className={commonClassNames}>
            {content.map((item, idx) => (
              <div key={idx}>
                {item.type === "text" && <div dangerouslySetInnerHTML={renderContent(item.text)} />}
                {item.type === "image_url" && (
                  <img src={item.image_url.url} alt="uploaded" className="max-w-full h-auto" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={commonClassNames} dangerouslySetInnerHTML={renderContent(content)} />
        )}
      </div>
    </>
  );
};

const RelatedQuestions = ({ questions, isLoading, onQuestionClick }) => {
  const formatQuestion = (question) => question.replace(/^\d+\.\s*/, "");

  const QuestionItem = ({ question, index }) => (
    <div
      onClick={() => onQuestionClick(formatQuestion(question))}
      className="flex items-center gap-2 text-sm text-gray-600 mb-1.5
        px-4 py-1.5 rounded-lg bg-gray-50 border border-gray-100
        hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 
        hover:shadow-sm transform hover:-translate-y-0.5
        cursor-pointer transition-all duration-200"
    >
      <span>{`${question}`}</span>
    </div>
  );

  return (
    <div className="absolute bottom-[2px] left-4 z-10">
      <div className="text-base font-medium text-gray-700 mb-2 flex items-center">
        <MessageSquare className="w-4 h-4 mr-2" />
        猜你想问
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2">
          <Loading />
        </div>
      ) : (
        questions.map((question, index) => (
          <QuestionItem key={index} question={question} index={index} />
        ))
      )}
    </div>
  );
};

export const ChatMessageList = ({
  messages,
  isAiThinking,
  copiedMessageId,
  onCopy,
  onRetry,
  currentUrl,
  currentUrlRelatedQuestions,
  currentUrlLoading,
  onQuestionClick,
  thinkingTimeMap,
}) => {
  const [pageTitle, setPageTitle] = useState("");
  const [prevMessageHeight, setPrevMessageHeight] = useState(0);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});
  const [messagesContainerHeight, setMessagesContainerHeight] = useState(0);

  const getPageTitle = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      setPageTitle(tab.title);
    } catch (error) {
      console.error("获取页面标题失败:", error);
    }
  };

  useEffect(() => {
    getPageTitle();

    const handleTabUpdate = (tabId, changeInfo) => {
      if (changeInfo.title) {
        getPageTitle();
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    };
  }, [currentUrl]);

  useEffect(() => {
    if (messages.length > 1) {
      const prevMessageEl = messageRefs.current[messages.length - 2];
      if (prevMessageEl) {
        const height = prevMessageEl.getBoundingClientRect().height;
        setPrevMessageHeight(height);
      }
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
        });
      }
    }
  }, []);

  useEffect(() => {
    console.log("currentUrlRelatedQuestions", messages);
  }, [messages]);

  useEffect(() => {
    if (isAiThinking) {
      const rafId = requestAnimationFrame(() => {
        scrollToBottom();
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isAiThinking, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 1) {
      const prevMessageEl = messageRefs.current[messages.length - 1];
      if (prevMessageEl) {
        const height = prevMessageEl.getBoundingClientRect().height;
        setMessagesContainerHeight(height);
      }
    }
  }, [messages]);

  const renderRelatedQuestions = () => (
    <RelatedQuestions
      questions={currentUrlRelatedQuestions}
      isLoading={currentUrlLoading}
      onQuestionClick={onQuestionClick}
    />
  );

  const renderPageTitle = () => {
    const truncateTitle = (title) => {
      return title.length > 30 ? `${title.slice(0, 30)}...` : title;
    };

    return (
      pageTitle && (
        <div className="w-full mb-4 ">
          <div
            className="flex items-center gap-2 text-sm text-gray-600 font-medium 
            bg-gradient-to-r from-white via-gray-50 to-indigo-50/30
            backdrop-blur-md px-3 py-1.5 rounded-lg 
            shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] 
            border border-gray-200
            hover:border-indigo-200 hover:from-white hover:to-indigo-100/50 
            hover:shadow-md
            transition-all duration-200
            w-full"
          >
            <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text truncate text-black">
              当前页面：{pageTitle}
            </span>
          </div>
        </div>
      )
    );
  };

  const renderEmptyState = () => {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <div className="p-8 text-center">
            <div className="hover:scale-105 transition-all duration-300 transform -translate-y-8">
              <div className="flex flex-col items-center justify-center gap-6">
                <div className="w-24 h-24 bg-white shadow-lg rounded-xl flex items-center justify-center">
                  <FileSearch className="w-14 h-14 text-indigo-600" />
                </div>
                <div className="space-y-3">
                  <div className="font-medium text-gray-700 text-lg">Web助手</div>
                  <div className="text-sm text-gray-500 max-w-xs">
                    问我关于当前页面内容的任何问题
                  </div>
                </div>
              </div>
            </div>
          </div>
          {renderRelatedQuestions()}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex-1 overflow-y-auto p-4 relative bg-white rounded-xl flex flex-col h-full scroll-smooth scrollbar-hidden"
      style={{
        maxHeight: messages.length <= 2 ? "100%" : "calc(100vh - 200px)",
      }}
    >
      {renderPageTitle()}
      {messages.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-6 ">
          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            const isAssistant = msg.role === "assistant";

            return (
              <div
                key={index}
                ref={(el) => (messageRefs.current[index] = el)}
                className={`${
                  isLastMessage && isAssistant ? "min-h-[300px]" : ""
                } transition-all duration-200`}
                style={
                  isLastMessage && isAssistant && messages.length > 2
                    ? {
                        height: `calc(100vh - ${prevMessageHeight}px - 295px)`,
                      }
                    : {}
                }
              >
                <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`relative rounded-xl shadow-sm
                    ${
                      isAssistant
                        ? "w-full bg-white border border-gray-100"
                        : "max-w-[80%] inline-block bg-blue-100 rounded-lg p-2"
                    }`}
                  >
                    {isAssistant && (
                      <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white p-3 rounded-t-xl">
                        <div className="flex items-center gap-2">
                          <Bot className="w-5 h-5 text-indigo-600" />
                          <span className="font-medium text-indigo-600">{msg.model}</span>
                        </div>
                      </div>
                    )}

                    <div className={isAssistant ? "p-4" : "px-2"}>
                      <MessageContent
                        content={msg.content}
                        reason_content={msg.reason_content}
                        messageId={index}
                        isAiThinking={isAiThinking}
                        timestamp={msg.timestamp}
                        isExpanded={msg.isExpanded}
                        relatedQuestions={msg?.relatedQuestions || []}
                        isAssistant={isAssistant}
                        isRelatedQuestions={msg?.isRelatedQuestions || false}
                        isShowRelatedQuestions={msg?.isShowRelatedQuestions || false}
                      />

                      {isAssistant && (
                        <div className="flex justify-between items-start mt-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => onCopy(msg.content, index)}
                              className="p-1 hover:bg-gray-100 rounded-md"
                              title="复制内容"
                            >
                              {copiedMessageId === index ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {isLastMessage && isAssistant && msg?.isShowRelatedQuestions && (
                  <AnswerQuestion
                    relatedQuestions={msg?.relatedQuestions || []}
                    isRelatedQuestions={msg?.isRelatedQuestions || false}
                    isShowRelatedQuestions={msg?.isShowRelatedQuestions || false}
                    onQuestionClick={onQuestionClick}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div ref={messagesEndRef} style={{ height: "1px" }} />
    </div>
  );
};
