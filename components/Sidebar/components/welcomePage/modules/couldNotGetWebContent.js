const CouldNotGetWebContent = ({ setActivatePage }) => {
  return (
    <div className="w-full h-full rounded-xl flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-gray-500">
          或前往
          <button
            className="mx-1 text-blue-500 hover:underline"
            onClick={() => {
              setActivatePage(5);
            }}
          >
            设置
          </button>
          开启自动预览
        </p>
      </div>
    </div>
  );
};

export { CouldNotGetWebContent };
