import { CircleHelp } from "lucide-react";
import { useState } from "react";

const Question = () => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = () => setShowTooltip(true);
  const handleMouseLeave = () => setShowTooltip(false);

  const tooltipText = [
    {
      key: "title",
      text: "为什么会失败?",
    },
    {
      key: "text",
      text: "1. 网络问题",
    },

    {
      key: "text",
      text: "2. 请求繁忙",
    },
    {
      key: "text",
      text: "3. 如果多次重试失败，则是该网页的不支持提取内容",
    },
  ];

  const renderTooltipContent = (textArray) =>
    textArray.map((line, index) => (
      <p key={index} className="text-sm">
        {line.key === "title" && <span className="font-bold">{line.text}</span>}
        {line.key === "text" && line.text}
      </p>
    ));

  return (
    <div className="flex items-center justify-center w-full h-full relative">
      <div className="cursor-help" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <CircleHelp className="size-5" />
      </div>

      {showTooltip && (
        <div className="absolute top-12 right-0 bg-white p-3 rounded-md shadow-lg border border-purple-200 w-56 z-50">
          <div className="flex flex-col gap-2">{renderTooltipContent(tooltipText)}</div>
          <div className="absolute -top-2 right-3 w-4 h-4 transform rotate-45 bg-white border-t border-l border-purple-200"></div>
        </div>
      )}
    </div>
  );
};

export { Question };
