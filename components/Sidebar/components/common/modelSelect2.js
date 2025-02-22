import { useState, useEffect, useRef } from "react";
import { useSearchEngine } from "../../hooks/useSearchEngine";
import { setCurrentSearchSource, getZhihuCookies, getXhsCookies } from "../../../../public/storage";
import { ChevronDown } from "lucide-react";

const ModelSelector2 = ({ useInput }) => {
  const { getSearchSource, handleSearchSourceChange, getSearchSourceIcon, getSearchSourceName } =
    useSearchEngine();
  const [isOpen, setIsOpen] = useState(false);
  const [modelList, setModelList] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const initializeModelList = async () => {
      const models = getSearchSource();
      setModelList(models);
    };

    initializeModelList();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  const handleModelSelect = (model) => {
    handleSearchSourceChange(model);
    setCurrentSearchSource(model.value);
  };

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 border border-gray-200 rounded-xl shadow-lg z-10 w-[170px] h-auto overflow-hidden bg-white">
          <div className="py-2">
            <ModelGroup
              setIsOpen={setIsOpen}
              models={modelList}
              useInput={useInput}
              onModelSelect={handleModelSelect}
            />
          </div>
        </div>
      )}
      <div
        onClick={handleClick}
        className={`mt-1 ml-1 flex items-center px-3 py-2
          flex-shrink-0 w-auto max-w-[120px] rounded-xl 
          border border-indigo-300
          transition-all duration-200
          shadow-sm bg-indigo-500 text-white overflow-hidden text-ellipsis whitespace-nowrap`}
      >
        {getSearchSourceIcon()}
        <span className={`text-sm ml-2 font-medium`}>{getSearchSourceName()}</span>
        <ChevronDown className="w-4 h-4 ml-auto text-white/80" />
      </div>
    </div>
  );
};

const ModelGroup = ({ models, useInput = true, onModelSelect, setIsOpen }) => {
  const [isZhihuLoggedIn, setIsZhihuLoggedIn] = useState(false);
  const [isXhsLoggedIn, setIsXhsLoggedIn] = useState(false);

  useEffect(() => {
    const checkLoggedIn = async () => {
      const zhihuStatus = await getZhihuCookies();
      const xhsStatus = await getXhsCookies();
      setIsZhihuLoggedIn(zhihuStatus && zhihuStatus.length > 0);
      setIsXhsLoggedIn(xhsStatus && xhsStatus.length > 0);
    };
    checkLoggedIn();
  }, []);

  return (
    <>
      {models.map((model) => (
        <div
          key={model.name}
          className={`px-4 py-2 text-sm transition-all duration-200
                    hover:bg-indigo-50 flex items-center group  z-50 ${
                      !isXhsLoggedIn && model.value === "xiaohongshu" ? "cursor-not-allowed" : ""
                    }`}
          onClick={() => {
            if (!isXhsLoggedIn && model.value === "xiaohongshu") return;
            onModelSelect(model);
            setIsOpen(false);
          }}
        >
          {model.selectIcon}
          <span className="group-hover:text-indigo-600 pl-4">
            {!isXhsLoggedIn && model.value === "xiaohongshu" ? (
              <button className="text-indigo-600 underline">验证小红书登录</button>
            ) : (
              model.name
            )}
          </span>
        </div>
      ))}
    </>
  );
};

export { ModelSelector2 };
