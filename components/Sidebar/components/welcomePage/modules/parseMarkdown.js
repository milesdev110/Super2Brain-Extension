import katex from "katex";
import "katex/dist/katex.min.css";
import { Package, ScanEye } from "lucide-react";
import { marked } from "marked";
import { useMemo } from "react";
import { CouldNotGetWebContent } from "./couldNotGetWebContent";

const PlaceHolder = ({ refreshData, currentUrl, pageContent }) => {
  return (
    <div className="flex-1 min-h-[400px] flex items-center justify-center">
      <div className="p-8 text-center hover:scale-105 transition-all duration-300">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 bg-white shadow-lg rounded-xl flex items-center justify-center">
            <Package className="w-14 h-14 text-indigo-600" />
          </div>
          <div className="space-y-3">
            <div className="font-medium text-gray-700 text-lg">出了一点小错</div>
            <div className="text-sm text-gray-500 max-w-xs">服务繁忙，请稍后再试</div>
            <div className="text-sm text-gray-500 max-w-xs">
              如果多次重新获取还是无法获取，可能为当前网页内容禁止获取。
            </div>
            <button
              onClick={() => refreshData(currentUrl, pageContent)}
              className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded"
            >
              重新获取
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { PlaceHolder };

const MarkdownRenderer = ({
  content = "",
  criticalAnalysis = "",
  currentUrlTab,
  setCurrentUrlTab,
  isLoading = false,
  fetchSummary,
  currentUrl,
  pageContent,
  fetchAnalysis,
  webPreview,
  setActivatePage,
}) => {
  const tabs = useMemo(
    () => [
      { id: "welcome", name: "亮点" },
      { id: "analysis", name: "批判" },
    ],
    []
  );
  const commonClassNames = `text-sm text-black break-words leading-relaxed prose overflow-wrap break-word 
    prose-p:leading-6 prose-p:pb-0 prose-p:mb-0  prose-p:text-black
    prose-hr:hidden prose-hr:border-none prose-hr:m-0
    prose-h1:mb-3 prose-h1:mt-3 prose-h1:text-black prose-h1:text-[24px]  
    prose-h2:mb-3 prose-h2:mt-3 prose-h2:text-black prose-h2:text-[22px]
    prose-h3:mb-2 prose-h3:mt-2 prose-h3:text-black prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-[20px]
    prose-h4:text-black prose-h4:mb-2 prose-h4:mt-2 prose-h4:text-[18px]
    prose-h5:text-black prose-h5:mb-2 prose-h5:mt-2 prose-h5:text-[16px]
    prose-h6:text-black prose-h6:mb-2 prose-h6:mt-2 prose-h6:text-[14px]
    prose-ul:list-decimal prose-ul:text-black prose-ul:mb-0 prose-ul:leading-6
    prose-ol:mb-0 prose-ol:text-black prose-ol:list-decimal prose-li:text-black prose-li:mb-0 prose-li:leading-6
    prose-code:text-black
    prose-pre:before:content-none prose-pre:after:content-none prose-pre:text-black prose-pre:rounded-md prose-pre:whitespace-pre-wrap prose-pre:bg-gray-100
    prose-code:bg-gray-200 prose-code:text-black prose-code:p-1 prose-code:rounded-md prose-code:whitespace-pre-wrap prose-code:my-4 prose-code:mx-2
    [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded-md [&_pre]:w-full [&_pre]:block [&_pre]:whitespace-pre-wrap [&_pre]:break-words
    [&_pre_code]:bg-gray-100 [&_pre_code]:w-full [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:my-2 [&_pre_code]:mx-0 [&_pre_code]:block
    [&_pre_code]:whitespace-pre-wrap [&_pre_code]:break-words
    prose-blockquote:font-medium prose-blockquote:italic prose-blockquote:text-[var(--tw-prose-quotes)] 
    prose-blockquote:border-l-[0.25rem] prose-blockquote:border-l-[var(--tw-prose-quote-borders)] prose-blockquote:mt-6 prose-blockquote:mb-6 prose-blockquote:pl-4
    prose-table:mt-4 prose-table:mb-4 prose-table:w-full prose-table:overflow-hidden prose-table:border-collapse prose-table:border prose-table:border-gray-300
    prose-th:py-2 prose-th:px-4 prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:text-left
    prose-td:py-2 prose-td:px-4 prose-td:border prose-td:border-gray-300    
    prose-tr:py-2 prose-tr:px-4 prose-tr:border prose-tr:border-gray-300
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      );
    }

    const commonContentWrapper = (content) => (
      <div className="prose prose-sm md:prose-base lg:prose-lg prose-slate mx-4 mt-4 mb-16">
        <div className="text-sm mb-2 flex justify-center">
          <span className="text-indigo-700 rounded-lg py-1.5 px-3 text-center font-medium">
            当前内容由AI生成，仅供参考
          </span>
        </div>
        {content}
      </div>
    );

    if (currentUrlTab === "welcome") {
      return content && content.length > 10 ? (
        commonContentWrapper(
          <div
            className={commonClassNames}
            dangerouslySetInnerHTML={{ __html: marked(processLatex(content)) }}
          />
        )
      ) : (
        <PlaceHolder refreshData={fetchSummary} currentUrl={currentUrl} pageContent={pageContent} />
      );
    }

    return criticalAnalysis && criticalAnalysis.length > 10 ? (
      commonContentWrapper(
        <div
          className={commonClassNames}
          dangerouslySetInnerHTML={{
            __html: marked(processLatex(criticalAnalysis)),
          }}
        />
      )
    ) : (
      <PlaceHolder refreshData={fetchAnalysis} currentUrl={currentUrl} pageContent={pageContent} />
    );
  };

  const refreshData = (url, nowContent) => {
    if (currentUrlTab === "welcome") {
      fetchSummary(url, nowContent);
    } else {
      fetchAnalysis(url, nowContent);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-xl">
      <div className="flex-shrink-0 pt-4">
        <div className="flex justify-center gap-2 p-2 bg-white/80 backdrop-blur-sm rounded-3xl w-fit mx-auto shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 border border-gray-100/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentUrlTab(tab.id)}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
                ${
                  currentUrlTab === tab.id
                    ? "bg-indigo-50/90 text-indigo-600 shadow-[0_2px_12px_rgb(99,102,241,0.12)]"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50/80"
                }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>
      {webPreview ||
      (content && currentUrlTab === "welcome") ||
      (criticalAnalysis && currentUrlTab === "analysis") ? (
        <div className="px-6 md:p-8 pb-8">{renderContent()}</div>
      ) : (
        <div className="h-[calc(100vh-300px)] flex  items-center justify-center  px-6 md:p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-24 h-24 bg-white shadow-lg rounded-xl flex items-center justify-center">
              <ScanEye className="w-14 h-14 text-indigo-600" />
            </div>
            <button
              onClick={() => refreshData(currentUrl, pageContent)}
              className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded"
            >
              立即获取{currentUrlTab === "welcome" ? "亮点" : "批判"}
            </button>
            <CouldNotGetWebContent setActivatePage={setActivatePage} />
          </div>
        </div>
      )}
    </div>
  );
};

export { MarkdownRenderer };
