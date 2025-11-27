import { Bot, FileSearch, ScanEye, Scissors, Settings, Sparkle } from "lucide-react";

export const ACTIVATE_ITEMS = [
  // { id: 0, icon: ScanEye, tooltip: "网页速览" },
  { id: 1, icon: FileSearch, tooltip: "网页问答" },
  // { id: 2, icon: Bot, tooltip: "搜索问答" },
  // { id: 3, icon: Sparkle, tooltip: "AI洞察分析" },
  { id: 5, icon: Settings, tooltip: "设置" },
];

export const createTags = ({ currentModelSupportsImage }) => [
  {
    text: currentModelSupportsImage ? "网页截图" : "当前模型不支持截图，请切换其他模型",
    icon: Scissors,
    type: "screenshot",
    disabled: !currentModelSupportsImage,
  },
];
