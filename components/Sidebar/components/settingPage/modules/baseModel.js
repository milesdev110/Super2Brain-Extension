import { useState } from "react";
import {
  setPreviewLight as setPreviewLightStorage,
  setWebPreview as setWebPreviewStorage,
} from "../../../../../public/storage";
import { CheckboxOption } from "./baseModel/modules/checkOption";
import { PointsCard } from "./baseModel/modules/pointCard";

const notificationOptions = [
  {
    id: "web-preview",
    label: "网页自动速览",
    description:
      "开启该功能后，每当打开Super2Brain侧边栏的时候，切换页面会自动生成当前网页的速览。",
    defaultChecked: false,
    checked: false,
  },
  {
    id: "preview-light",
    label: "预览灯光效果",
    description: "开启该功能后，每次生成网页速览的时候，页面会显示呼吸灯效果。",
    defaultChecked: false,
    checked: false,
  },
];

const BaseModel = ({
  webPreview,
  setWebPreview,
  setIsShowModal,
  setActiveTab,
  pointCosts,
  setIsAddPoint,
  previewLight,
  setPreviewLight,
}) => {
  const [localWebPreview, setLocalWebPreview] = useState(webPreview);
  const [localPreviewLight, setLocalPreviewLight] = useState(previewLight);

  const handleWebPreviewChange = async (checked) => {
    await setWebPreviewStorage(checked);
    setWebPreview(checked);
    setLocalWebPreview(checked);
  };

  const handlePreviewLightChange = async (checked) => {
    await setPreviewLightStorage(checked);
    setPreviewLight(checked);
    setLocalPreviewLight(checked);
  };

  const getOptionConfig = (optionId) => {
    switch (optionId) {
      case "web-preview":
        return {
          checked: localWebPreview,
          onChange: handleWebPreviewChange,
        };
      case "preview-light":
        return {
          checked: localPreviewLight,
          onChange: handlePreviewLightChange,
        };
      default:
        return {
          checked: false,
          onChange: () => {},
        };
    }
  };

  return (
    <div className="px-8 py-4">
      <fieldset>
        <legend className="sr-only">Notifications</legend>
        <div className="space-y-5">
          {notificationOptions.map((option) => {
            const { checked, onChange } = getOptionConfig(option.id);
            return (
              <CheckboxOption key={option.id} {...option} checked={checked} onChange={onChange} />
            );
          })}
        </div>
        <PointsCard
          setIsAddPoint={setIsAddPoint}
          setIsShowModal={setIsShowModal}
          setActiveTab={setActiveTab}
          pointCosts={pointCosts}
        />
      </fieldset>
    </div>
  );
};

export { BaseModel };
