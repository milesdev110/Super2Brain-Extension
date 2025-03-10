import {
  Loader2,
  CheckCircle2,
  Search,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  Check,
  Bot,
} from "lucide-react";
import { marked } from "marked";
import { ResponseLoading } from "./responseLoading";
import { PlaceHolder } from "./placeHolder";
import { RelatedQuestions } from "./RelatedQuestions";
import React, { useRef, useEffect, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

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

export const MessageRenderer = ({
  messages,
  setQuery,
  setMessage,
  elapsedTime,
  updateMessageCopyStatus,
  handleNetworkSubmit,
  isLoading,
  setActivatePage,
  searchEnabled,
  startTimer,
  stopTimer,
  setNetworkElapsedTime,
}) => {
  const containerRef = useRef(null);
  const lastMessageRef = useRef(null);
  const [lastMessageHeight, setLastMessageHeight] = useState(0);
  useEffect(() => {
    if (lastMessageRef.current) {
      const height = lastMessageRef.current.getBoundingClientRect().height;
      setLastMessageHeight(height);
    }
  }, [messages]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [prevMessageCount, setPrevMessageCount] = useState(0);
  useEffect(() => {
    if (messages.isComplete) {
      setIsScrolled(false);
      return;
    }

    if (messages.length > prevMessageCount) {
      setIsScrolled(false);

      const scrollToBottom = () => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
        setIsScrolled(true);
      };

      scrollToBottom();
    }

    setPrevMessageCount(messages.length);
  }, [messages, prevMessageCount]);

  const handleCopy = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      updateMessageCopyStatus(content, true);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  const handleRegenerate = async () => {
    if (isLoading) return;

    const lastUserMessage = messages[messages.length - 2]?.content;
    if (!lastUserMessage) return;

    setMessage((prevMessages) => prevMessages.slice(0, -2));

    try {
      setNetworkElapsedTime(0);
      startTimer();
      await handleNetworkSubmit(lastUserMessage);
    } catch (error) {
      console.error("重新生成消息时出错:", error);
      stopTimer();
    }
  };

  const processLatex = (content) => {
    // 首先处理多行数学公式 \[ ... \]
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

    // 然后处理其他格式的公式
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

  if (!messages || messages.length === 0) {
    return (
      <PlaceHolder
        Icon={Bot}
        title={"S2B 问答助手"}
        description={"S2B 问答助手，集成多种大模型回答您的问题"}
        setActivatePage={setActivatePage}
      />
    );
  }

  const renderUserMessage = (msg, index) => {
    const isLastMessage = index === messages.length - 1;
    return (
      <div
        ref={isLastMessage ? lastMessageRef : null}
        key={`user-${index}`}
        className="space-y-2 mr-2"
      >
        <div className="text-blue-600 flex justify-end">
          <div className="text-sm whitespace-pre-wrap bg-blue-100 rounded-lg p-2 max-w-[80%]">
            {msg.content}
          </div>
        </div>
      </div>
    );
  };

  const renderAssistantMessage = (msg, index) => {
    const isLastMessage =
      index === messages.length - 1 && messages.length > 2 && msg.role === "assistant";

    const messageStyle = isLastMessage
      ? {
          minHeight: `calc(100% - ${lastMessageHeight}px - 70px)`,
          overflowY: "auto",
        }
      : {};

    const setIsReasoningExpanded = (expanded) => {
      setMessage((prev) => {
        const messages = [...prev];
        const msgIndex = messages.findIndex((m, i) => m.role === "assistant" && i === index);
        if (msgIndex !== -1) {
          messages[msgIndex] = {
            ...messages[msgIndex],
            isReasoningExpanded: expanded,
          };
        }
        return messages;
      });
    };

    const getStatusColor = (status) => {
      switch (status) {
        case "merging":
          return "text-purple-600";
        case "analyzing":
          return "text-indigo-600";
        case "error":
          return "text-indigo-600";
        default:
          return "text-indigo-600";
      }
    };

    const renderStatus = () => {
      if (
        !msg.status ||
        msg.status === "complete" ||
        msg.isStreaming ||
        msg.questionsLoading ||
        msg.isComplete
      )
        return null;

      if (msg.status === "merging") {
        return (
          <div className="p-4">
            <ResponseLoading />
          </div>
        );
      }

      if (msg.status === "error") {
        return (
          <div className="p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4" />
              <span className="text-sm text-indigo-600">
                {msg.statusMessage || "发生错误，请稍后重试"}
              </span>
            </div>
          </div>
        );
      }

      return (
        <div className="p-4 space-y-2">
          <div className="flex items-center space-x-2">
            {msg.status !== "processing" && msg.status !== "complete" && (
              <>
                <Loader2 className={`w-4 h-4 animate-spin ${getStatusColor(msg.status)}`} />
                <span className={`text-sm ${getStatusColor(msg.status)} animate-pulse`}>
                  {msg.statusMessage} {elapsedTime > 0 && `(${elapsedTime}秒)`}
                </span>
              </>
            )}
          </div>
        </div>
      );
    };

    const renderUrlList = () => {
      if (!msg.urlListData || msg.urlListData.length === 0) return null;
      if (msg.status === "error") return null;
      return (
        <div className="px-4 py-2">
          <div className="text-sm text-gray-600 mb-2">阅读页面：</div>
          <div className="space-y-2">
            {msg.urlListData.map((url, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {url.status === 2 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : url.status === 1 ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <a
                  href={url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {url.title || url.url}
                </a>
              </div>
            ))}
          </div>
        </div>
      );
    };

    const renderReasoningContent = () => {
      if (!msg.reasoning_content) return null;

      return (
        <div className="mt-4 mb-2">
          <button
            onClick={() => setIsReasoningExpanded(!msg.isReasoningExpanded)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2 transition-colors duration-200 ml-4"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 
                ${msg.isReasoningExpanded ? "rotate-180" : ""}`}
            />
            <span className="text-sm">思考过程</span>
          </button>

          {msg.isReasoningExpanded && msg.reasoning_content && (
            <div className="mx-4">
              <div
                className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500
                  border border-gray-100 transition-all duration-200"
              >
                <div
                  className="text-sm text-stone-900 break-words prose prose-p:leading-6"
                  dangerouslySetInnerHTML={{
                    __html: marked(processLatex(msg.reasoning_content || ""), {
                      gfm: true,
                    }),
                  }}
                />
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div key={`assistant-${index}`} className="space-y-4 mr-2" style={messageStyle}>
        <div className="text-gray-800">
          <div className="w-full bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-600" />
                  <span className="font-medium text-indigo-600">{msg.model}</span>
                </div>
              </div>
            </div>

            {renderStatus()}

            {renderReasoningContent()}

            {msg.content && (
              <div
                className={`mx-4 mt-4 mb-2 ${commonClassNames}`}
                dangerouslySetInnerHTML={{
                  __html: marked(processLatex(msg.content), {
                    breaks: true,
                    gfm: true,
                  }),
                }}
              />
            )}

            {renderUrlList()}
            {msg.isComplete && msg.content && (
              <div className="flex justify-between items-start px-4 pb-4 pt-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="p-1 hover:bg-gray-100 rounded-md"
                    title="复制内容"
                  >
                    {msg.isCopied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={isLoading}
                    className={`p-1 hover:bg-gray-100 rounded-md ${
                      isLoading ? "cursor-not-allowed opacity-50" : ""
                    }`}
                    title="重新生成回答"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-500`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {index === messages.length - 1 && <RelatedQuestions setQuery={setQuery} message={msg} />}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="h-full space-y-4 overflow-y-auto scrollbar-hidden">
      {messages.map((msg, index) =>
        msg.role === "user" ? renderUserMessage(msg, index) : renderAssistantMessage(msg, index)
      )}
    </div>
  );
};
