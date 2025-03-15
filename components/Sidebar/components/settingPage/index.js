import React, { useEffect, useState } from "react";
import {
  getCustomConfig,
  getCustomModelIds,
  getDeepSeekApiKey,
  getLmstudioConfig,
  getOllamaConfig,
  getOpenaiApiKey,
  getOpenAiUrl,
  getUserInput,
} from "../../../../public/storage";
import { About } from "./modules/about";
import { BaseModel } from "./modules/baseModel";
import { Login } from "./modules/login";
import { ModelSettings } from "./modules/modelSetting";
import { NavBar } from "./modules/navBar";

const SettingsContent = ({
  setModelList,
  modelList,
  webPreview,
  setWebPreview,
  settings,
  handleChange,
  setIsShowModal,
  pointCosts,
  setIsAddPoint,
  previewLight,
  setPreviewLight,
}) => {
  const [activeTab, setActiveTab] = useState("基础设置");

  const renderModelSettings = () => (
    <div className="px-6 overflow-y-auto flex-1 mt-4">
      {Object.entries(settings).map(([modelKey]) => (
        <ModelSettings
          setModelList={setModelList}
          modelList={modelList}
          key={modelKey}
          modelKey={modelKey}
          settings={settings}
          handleChange={handleChange}
        />
      ))}
    </div>
  );

  return (
    <div className="w-full h-[calc(100vh-8px)] rounded-xl flex flex-col bg-white">
      <div className="flex-none px-6 py-4 border-b border-gray-200">
        <NavBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "基础设置" && (
          <div className="h-full overflow-y-auto">
            <BaseModel
              pointCosts={pointCosts}
              webPreview={webPreview}
              setWebPreview={setWebPreview}
              setIsShowModal={setIsShowModal}
              setActiveTab={setActiveTab}
              setIsAddPoint={setIsAddPoint}
              previewLight={previewLight}
              setPreviewLight={setPreviewLight}
            />
          </div>
        )}
        {activeTab === "模型设置" && (
          <div className="h-full overflow-y-auto">{renderModelSettings()}</div>
        )}
        {activeTab === "关于" && (
          <div className="h-full overflow-y-auto">
            <About />
          </div>
        )}
      </div>
    </div>
  );
};

export const SettingPage = ({
  setSettings,
  settings,
  webPreview,
  setWebPreview,
  onClose,
  updateDeepSeekConfig,
  userInput,
  setUserInput,
  setIsShowModal,
  pointCosts,
  setIsAddPoint,
  previewLight,
  setPreviewLight,
}) => {
  const [modelList, setModelList] = useState([]);

  const handleChange = (model, field) => (event) => {
    setSettings((prev) => ({
      ...prev,
      [model]: {
        ...prev[model],
        [field]: event.target.value,
      },
    }));
  };

  useEffect(() => {
    const fetchUserInput = async () => {
      const input = await getUserInput();
      setUserInput(input);
    };

    fetchUserInput();
  }, []);

  useEffect(() => {
    const fetchModelList = async () => {
      const modelList = await getCustomModelIds();
      setModelList(modelList);
    };

    fetchModelList();
  }, []);

  const loadModelConfigs = async () => {
    const [deepseekApiKey, openaiApiKey, ollamaConfig, lmstudioConfig, customConfig, openaiUrl] =
      await Promise.all([
        getDeepSeekApiKey(),
        getOpenaiApiKey(),
        getOllamaConfig(),
        getLmstudioConfig(),
        getCustomConfig(),
        getOpenAiUrl(),
      ]);

    return {
      deepseek: { apiKey: deepseekApiKey },
      openai: { apiKey: openaiApiKey, url: openaiUrl },
      ollama: {
        url: ollamaConfig.url || "http://localhost:11434",
        apiKey: ollamaConfig.apiKey || "",
      },
      lmstudio: {
        url: lmstudioConfig.url || "http://localhost:1234",
        apiKey: lmstudioConfig.apiKey || "",
      },
      custom: {
        url: customConfig.url || "",
        apiKey: customConfig.apiKey || "",
      },
    };
  };

  useEffect(() => {
    loadModelConfigs().then((configs) => setSettings(configs));
  }, []);

  return (
    <>
      {userInput ? (
        <SettingsContent
          previewLight={previewLight}
          setPreviewLight={setPreviewLight}
          pointCosts={pointCosts}
          setModelList={setModelList}
          webPreview={webPreview}
          modelList={modelList}
          setWebPreview={setWebPreview}
          settings={settings}
          handleChange={handleChange}
          setIsShowModal={setIsShowModal}
          setIsAddPoint={setIsAddPoint}
        />
      ) : (
        <Login setUserInput={setUserInput} />
      )}
    </>
  );
};
