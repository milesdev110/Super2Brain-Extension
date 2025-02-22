import { useState, useEffect } from "react";
import { setWebPreview as setWebPreviewStorage } from "../../../../../public/storage";
import { CheckboxOption } from "./baseModel/module/checkOption";
import { PointsCard } from "./baseModel/module/pointCard";
const notificationOptions = [
  {
    id: "web-preview",
    label: "网页速览",
    description: "每次打开Super2Brain侧边栏的时候，会自动在生成速览。",
    defaultChecked: true,
  },
];

const BaseModel = ({
  webPreview,
  setWebPreview,
  setIsShowModal,
  setActiveTab,
  pointCosts,
  setIsAddPoint,
}) => {
  const [localWebPreview, setLocalWebPreview] = useState(webPreview);

  const handleWebPreviewChange = async (checked) => {
    await setWebPreviewStorage(checked);
    setWebPreview(checked);
    setLocalWebPreview(checked);
  };

  const options = notificationOptions.map((option) => ({
    ...option,
    checked: webPreview,
    onChange: handleWebPreviewChange,
  }));

  return (
    <div className="px-8 py-4">
      <fieldset>
        <legend className="sr-only">Notifications</legend>
        <div className="space-y-5">
          {options.map((option) => (
            <CheckboxOption
              key={option.id}
              {...option}
              checked={localWebPreview}
              onChange={handleWebPreviewChange}
            />
          ))}
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
