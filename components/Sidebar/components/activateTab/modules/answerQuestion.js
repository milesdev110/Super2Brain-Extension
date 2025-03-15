import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { memo } from "react";

const QuestionLoading = () => {
  const ballCount = 5;
  const balls = Array.from({ length: ballCount }, (_, index) => (
    <motion.div
      key={index}
      className="w-2 h-2 bg-blue-500 rounded-full"
      animate={{
        y: [0, -8, 0],
        x: [0, 4, 0],
        scale: [1, 0.8, 1],
      }}
      transition={{
        duration: 0.6,
        repeat: Infinity,
        ease: "easeInOut",
        delay: index * 0.1,
      }}
    />
  ));

  return (
    <div className="flex justify-start items-center h-full pt-2">
      <div className="flex space-x-1">{balls}</div>
    </div>
  );
};

const AnswerQuestion = memo(
  ({ relatedQuestions, onQuestionClick, isRelatedQuestions, isShowRelatedQuestions }) => {
    return (
      <>
        {isRelatedQuestions && (
          <div className="mt-2 ml-2">
            <div className="flex items-center gap-2 mb-2 text-gray-600">
              <HelpCircle className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">相关问题</span>
            </div>
            <QuestionLoading />
          </div>
        )}

        {!isRelatedQuestions && (
          <div className="mt-2 ml-2">
            <div className="flex items-center gap-2 mb-2 text-gray-600">
              <HelpCircle className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">相关问题</span>
            </div>
            <div className="space-y-1">
              {relatedQuestions?.map((question, index) => (
                <button
                  key={index}
                  onClick={() => onQuestionClick(question)}
                  className="block text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 
                  rounded-lg p-2 w-full text-left transition-colors duration-200"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }
);

export { AnswerQuestion };
