import { useMemo } from "react";
import { marked } from "marked";
import { Package } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";

const PlaceHolder = () => {
  return (
    <div className="flex-1 min-h-[400px] flex items-center justify-center">
      <div className="p-8 text-center hover:scale-105 transition-all duration-300">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 bg-white shadow-lg rounded-xl flex items-center justify-center">
            <Package className="w-14 h-14 text-indigo-600" />
          </div>
          <div className="space-y-3">
            <div className="font-medium text-gray-700 text-lg">
              出了一点小错
            </div>
            <div className="text-sm text-gray-500 max-w-xs">
              服务繁忙，请稍后再试
            </div>
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
}) => {
  const tabs = useMemo(
    () => [
      { id: "welcome", name: "亮点" },
      { id: "analysis", name: "批判" },
    ],
    []
  );


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
      <div className="prose prose-sm md:prose-base lg:prose-lg prose-slate mx-4 mt-4">
        <div className="text-sm mb-2 flex justify-center">
          <span className="text-indigo-700 rounded-lg py-1.5 px-3 text-center font-medium">
            当前内容由AI生成，仅供参考
          </span>
        </div>
        {content}
      </div>
    );

    if (currentUrlTab === "welcome") {
      return content ? (
        commonContentWrapper(
          <div
            dangerouslySetInnerHTML={{ __html: marked(processLatex(content)) }}
          />
        )
      ) : (
        <PlaceHolder />
      );
    }

    return criticalAnalysis ? (
      commonContentWrapper(
        <div
          dangerouslySetInnerHTML={{
            __html: marked(processLatex(criticalAnalysis)),
          }}
        />
      )
    ) : (
      <PlaceHolder />
    );
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
      <div className="px-6 md:p-8">{renderContent()}</div>
    </div>
  );
};

export { MarkdownRenderer };
