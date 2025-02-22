import {
  Bot,
  Loader2,
  CheckCircle2,
  Search,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  Check,
} from "lucide-react";
import { marked } from "marked";
import { ResponseLoading } from "./responseLoading";
import { PlaceHolder } from "./placeHolder";
import { RelatedQuestions } from "./RelatedQuestions";
import React, { useRef, useEffect, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export const MessageRenderer = ({
  messages,
  setQuery,
  setMessage,
  elapsedTime,
  updateMessageCopyStatus,
  handleNetworkSubmit,
  isLoading,
  setActivatePage,
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
      await handleNetworkSubmit(lastUserMessage);
    } catch (error) {
      console.error("重新生成消息时出错:", error);
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
        Icon={Search}
        title="AI 联网助手"
        description="操作你的浏览器，获取更多信息，并进行分析"
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
          minHeight: `calc(68vh - ${lastMessageHeight}px)`,
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
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
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
                  className="text-sm text-gray-700 break-words leading-relaxed prose"
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
                className={`mx-4 mt-4 mb-2 text-sm text-gray-700 break-words leading-relaxed prose" ${
                  msg.isStreaming ? "animate-pulse" : ""
                }`}
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
    <div ref={containerRef} className="h-full overflow-y-auto space-y-4 scrollbar-hidden">
      {messages.map((msg, index) =>
        msg.role === "user" ? renderUserMessage(msg, index) : renderAssistantMessage(msg, index)
      )}
    </div>
  );
};
