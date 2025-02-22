import { Sparkle, ArrowRight } from "lucide-react";
import { getCurrentSearchSource } from "../../../../../public/storage";
import { useState, useEffect } from "react";

const PlaceHolder = ({ setActivatePage }) => {
  const [searchSource, setSearchSource] = useState("");

  useEffect(() => {
    const fetchSearchSource = async () => {
      try {
        const source = await getCurrentSearchSource();
        if (source === "bing") {
          setSearchSource("必应");
        } else if (source === "zhihu") {
          setSearchSource("知乎");
        } else {
          setSearchSource("必应 ");
        }
      } catch (error) {
        console.error("获取搜索源失败:", error);
        setSearchSource("必应");
      }
    };

    fetchSearchSource();
  }, []);

  return (
    <div className="flex-1 h-full flex items-center justify-center">
      <div className="p-8 text-center hover:scale-105 transition-all duration-300">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 bg-white shadow-lg rounded-xl flex items-center justify-center">
            <Sparkle className="w-14 h-14 text-indigo-600" />
          </div>
          <div className="space-y-3">
            <div className="font-medium text-gray-700 text-lg">
              深度思考搜索
            </div>
            <div className="text-sm text-gray-500 max-w-xs">
              Super2Brain会自动操作您的浏览器，进行深度思考
            </div>
            <div className="text-sm text-gray-500 max-w-xs">
              对于一般问题建议使用gpt-4o-mini模型
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { PlaceHolder };
