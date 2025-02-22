import { useSearchEngine } from "../../../../../hooks/useSearchEngine";
import {
  setCurrentSearchSource,
  getZhihuCookies,
  getXhsCookies,
} from "../../../../../../../public/storage";
import React from "react";

const SearchSource = () => {
  const { searchSource, handleSearchSourceChange, getSearchSource } =
    useSearchEngine();
  const [zhihuVerified, setZhihuVerified] = React.useState(true);
  const [xhsVerified, setXhsVerified] = React.useState(true);

  React.useEffect(() => {
    const checkLoginStatus = async () => {
      const zhihuCookies = await getZhihuCookies();
      const xhsCookies = await getXhsCookies();
      setZhihuVerified(zhihuCookies);
      setXhsVerified(xhsCookies);
    };
    checkLoginStatus();
  }, []);

  const verifyZhihuLogin = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getZhihuAuthViaTab",
      });

      if (!response.success) {
        const errorMessage = response.error
          ? `验证失败: ${response.error}`
          : "验证失败: 未知错误";
        alert(errorMessage);
        return;
      }

      if (!response.isLoggedIn) {
        alert("请先登录知乎网站后再验证");
        return;
      }

      alert("知乎登录验证成功！");
      setZhihuVerified(true);
    } catch (error) {
      const errorMessage = error?.message || "未知错误";
      alert(`验证失败: ${errorMessage}`);
    }
  };

  const verifyXhsLogin = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await chrome.runtime.sendMessage({
        action: "getXhsAuthViaTab",
      });

      if (!response.success) {
        const errorMessage = response.error
          ? `验证失败: ${response.error}`
          : "验证失败: 未登录小红书";
        alert(errorMessage);
        return;
      }

      if (!response.isLoggedIn) {
        alert("请先登录小红书网站后再验证");
        return;
      }

      alert("小红书登录验证成功！");
      setXhsVerified(true);
    } catch (error) {
      const errorMessage = error?.message || "未知错误";
      alert(`验证失败: ${errorMessage}`);
    }
  };

  const checkSourceAvailable = async (item) => {
    switch (item.value) {
      case "zhihu":
        return await getZhihuCookies();
      case "xiaohongshu":
        return await getXhsCookies();
      default:
        return true;
    }
  };

  const handleSourceChange = async (item) => {
    const isAvailable = await checkSourceAvailable(item);
    if (!isAvailable) {
      return;
    }
    handleSearchSourceChange(item);
    setCurrentSearchSource(item.value);
  };

  return (
    <div className="mt-2 py-2 space-y-3">
      <div className="flex items-center gap-2 text-sm/6 font-medium">
        <svg
          className="size-5 text-[#5E5EF5]"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        搜索源设置
      </div>

      <div className="rounded-lg bg-gray-50 shadow-sm p-2">
        <ul className="space-y-1">
          {getSearchSource().map((item) => (
            <li key={item.value}>
              <label
                className={`flex items-center p-2 rounded hover:bg-gray-50 ${
                  item.value === "zhihu" || item.value === "xiaohongshu"
                    ? "cursor-pointer"
                    : ""
                }`}
              >
                <div className="ml-3 flex-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{item.selectIcon}</span>
                    <div className="relative flex items-center gap-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.name}
                        </div>
                        <div className="text-gray-500 text-xs">{item.desc}</div>
                      </div>
                      {item.value === "zhihu" && !zhihuVerified && (
                        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                          <svg
                            className="mr-1 h-3 w-3 text-yellow-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                              clipRule="evenodd"
                            />
                          </svg>
                          需要在知乎网页版登录
                        </span>
                      )}
                      {item.value === "xiaohongshu" && !xhsVerified && (
                        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                          <svg
                            className="mr-1 h-3 w-3 text-yellow-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                              clipRule="evenodd"
                            />
                          </svg>
                          需要在小红书网页版登录
                        </span>
                      )}
                    </div>
                  </div>
                  {item.value === "zhihu" && !zhihuVerified && (
                    <button
                      onClick={verifyZhihuLogin}
                      className="shrink-0 px-3 py-1 text-xs text-indigo-600 hover:text-indigo-700
                        border border-indigo-600 hover:border-indigo-700 rounded-full"
                    >
                      验证登录
                    </button>
                  )}
                  {item.value === "xiaohongshu" && !xhsVerified && (
                    <button
                      onClick={verifyXhsLogin}
                      className="shrink-0 px-3 py-1 text-xs text-indigo-600 hover:text-indigo-700
                        border border-indigo-600 hover:border-indigo-700 rounded-full"
                    >
                      验证登录
                    </button>
                  )}
                </div>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export { SearchSource };
