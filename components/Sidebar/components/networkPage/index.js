import { Plus, Send, Trash2, Search, RefreshCw } from "lucide-react";
import { Tooltip } from "react-tooltip";
import { useState, useMemo, useEffect } from "react";
import { super2brainModel } from "../../config/models.js";
import { MessageRenderer } from "./modules/MessageRenderer";
import { ModelSelector } from "../common/modelSelect.js";
import { useSearchEngine } from "../../hooks/useSearchEngine";
import { BsBing } from "react-icons/bs";
import { SiZhihu, SiXiaohongshu } from "react-icons/si";
import { ModelSelector2 } from "../common/modelSelect2";
const NetworkSearch = ({
  userInput,
  setActivatePage,
  selectedModelProvider,
  selectedModelIsSupportsImage,
  setSelectedModelProvider,
  setSelectedModelIsSupportsImage,
  checkBalance,
  setNetworkSelectedModel,
  message,
  networkSelectedModel,
  isLoading,
  handleNetworkSubmit,
  setMessage,
  searchEnabled,
  setSearchEnabled,
  updateMessageCopyStatus,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [networkTimer, setNetworkTimer] = useState(null);
  const [networkElapsedTime, setNetworkElapsedTime] = useState(0);
  const { searchSource } = useSearchEngine();
  const model = super2brainModel[networkSelectedModel]?.id || "选择模型";

  const handleModelSelect = (modelId) => {
    setNetworkSelectedModel(modelId);
    setIsOpen(false);
  };

  const [isSendAgain, setIsSendAgain] = useState(true);

  useEffect(() => {
    if (message.length > 0) {
      setIsSendAgain(message[message.length - 1].isComplete === true);
    }
  }, [message]);

  const handleReset = () => {
    setQuery("");
    setMessage([]);
    stopTimer();
    setNetworkElapsedTime(0);
  };

  const startTimer = () => {
    stopTimer();
    setNetworkElapsedTime(0);

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setNetworkElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    setNetworkTimer(timerInterval);
  };

  const stopTimer = () => {
    if (networkTimer) {
      clearInterval(networkTimer);
      setNetworkTimer(null);
    }
  };

  const handleMessageSubmit = async () => {
    if (!userInput || !query.trim() || isLoading || !isSendAgain) return;

    const message = query;
    setQuery("");

    try {
      setNetworkElapsedTime(0);
      startTimer();
      await handleNetworkSubmit(message);
    } catch (error) {
      console.error("发送消息时出错:", error);
      stopTimer();
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.isComposing || e.keyCode === 229) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleMessageSubmit();
    }
  };

  return (
    <div className="w-full h-[calc(100vh-8px)] rounded-xl flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 p-2 space-y-4">
        <MessageRenderer
          setMessage={setMessage}
          messages={message}
          setQuery={setQuery}
          elapsedTime={networkElapsedTime}
          updateMessageCopyStatus={updateMessageCopyStatus}
          handleNetworkSubmit={handleNetworkSubmit}
          isLoading={isLoading}
          setActivatePage={setActivatePage}
        />
      </div>

      <div className="flex-shrink-0 bg-white p-2">
        <div className="mb-2 flex items-center justify-end">
          <div className="flex items-center gap-2">
            {message.length > 0 && (
              <>
                <button
                  disabled={!message[message.length - 1].isComplete}
                  onClick={handleReset}
                  className="button-tag-clearChat px-3 py-1.5 text-sm text-gray-600 bg-white border 
                    border-gray-200 rounded-full hover:text-red-600 hover:border-red-200 
                    hover:bg-red-50 transition-all duration-200 shadow-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  清空对话
                </button>
                <Tooltip
                  style={{ borderRadius: "8px" }}
                  anchorSelect=".button-tag-clearChat"
                  place="top"
                >
                  {message[message.length - 1].isComplete ? "清空对话" : "请等待回答完成"}
                </Tooltip>
              </>
            )}
            <button
              onClick={() => setSearchEnabled(!searchEnabled)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-200 
                ${
                  searchEnabled
                    ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">{searchEnabled ? "关闭搜索" : "开启搜索"}</span>
            </button>
          </div>
        </div>

        <div
          className="relative rounded-md bg-white outline outline-1 -outline-offset-1 outline-gray-300 
            focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2
            focus-within:outline-indigo-600"
        >
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="block w-full rounded-md bg-white px-3 py-1.5 text-base 
              text-gray-900 outline-none resize-none h-24
              placeholder:text-gray-400 sm:text-sm/6"
            placeholder="请输入您的问题..."
          />
          <div className="p-2">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex">
                {!message || message.length === 0 ? (
                  <ModelSelector
                    isOpen={isOpen}
                    setIsOpen={setIsOpen}
                    model={model}
                    selectedModel={networkSelectedModel}
                    handleModelSelect={handleModelSelect}
                    super2brainModel={super2brainModel}
                    setActivatePage={setActivatePage}
                    useInput={userInput}
                    selectedModelProvider={selectedModelProvider}
                    selectedModelIsSupportsImage={selectedModelIsSupportsImage}
                    setSelectedModelProvider={setSelectedModelProvider}
                    setSelectedModelIsSupportsImage={setSelectedModelIsSupportsImage}
                    setSelectedModel={setNetworkSelectedModel}
                  />
                ) : (
                  <div className="invisible">
                    <ModelSelector
                      isOpen={false}
                      setIsOpen={() => {}}
                      model={model}
                      selectedModel={networkSelectedModel}
                      handleModelSelect={() => {}}
                      super2brainModel={super2brainModel}
                      setActivatePage={setActivatePage}
                      useInput={userInput}
                      selectedModelProvider={selectedModelProvider}
                      selectedModelIsSupportsImage={selectedModelIsSupportsImage}
                      setSelectedModelProvider={setSelectedModelProvider}
                      setSelectedModelIsSupportsImage={setSelectedModelIsSupportsImage}
                      setSelectedModel={setNetworkSelectedModel}
                    />
                  </div>
                )}

                {message && message.length === 0 ? (
                  <ModelSelector2 useInput={userInput} />
                ) : (
                  <div className="invisible">
                    <ModelSelector2 useInput={userInput} />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleMessageSubmit}
                  disabled={!userInput || !query.trim() || isLoading || !isSendAgain}
                  className={`button-tag-send p-2 rounded-xl
                flex items-center justify-center
                transition-all duration-200
                ${
                  !userInput || !query.trim() || isLoading || !isSendAgain
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-200"
                }
                shadow-sm hover:shadow-md`}
                >
                  <Send className="w-4 h-4" />
                </button>
                <Tooltip
                  style={{ borderRadius: "8px" }}
                  anchorSelect=".button-tag-send"
                  place="top"
                >
                  发送
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { NetworkSearch };
