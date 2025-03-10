import React, { useState } from "react";

const RefreshModal = ({ isOpen, onClose, onRefresh }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="fixed inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-lg p-6 w-[90%] max-w-md mx-4 
        shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-sm"
      >
        <h3 className="text-xl font-semibold mb-4">需要刷新标签页</h3>
        <p className="text-gray-600 mb-6">
          由于浏览器限制，必须刷新当前已打开的标签页才能使用 Super2Brain。 新打开的标签页无需刷新。
        </p>
        <p className="text-gray-600 mb-6">点击下面的按钮后会关闭当前网页</p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg transition-colors bg-gray-200 
            text-gray-600 hover:bg-gray-300"
          >
            暂不刷新
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm rounded-lg transition-colors bg-indigo-600 
            text-white hover:bg-indigo-500"
          >
            立即刷新
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Second({ onNext }) {
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(true);

  const handleRefresh = () => {
    chrome.runtime.sendMessage(
      {
        action: "refreshAllTabs",
        bypassCache: true,
      },
      (response) => {
        if (response.success) {
          setIsRefreshModalOpen(false);
          window.close();
        } else {
          console.error("刷新标签页失败:", response.error);
          window.close();
        }
      }
    );
  };

  return (
    <div>
      <RefreshModal
        isOpen={isRefreshModalOpen}
        onClose={() => {
          setIsRefreshModalOpen(false);
          window.close();
        }}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
