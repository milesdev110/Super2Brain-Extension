import { config } from "../../config/index";

const buildSystemPrompt = (contentPage) => ({
  role: "system",
  content: `你是一位专业的文档分析专家，擅长提炼和总结文章核心内容。请按照以下要求生成文章摘要：

    1.内容要求
      - 提取文章核心观点和关键信息
      - 使用简洁专业的语言，表达核心的内容
      - 避免无关内容和套话
      
    2.结构要求
      - 采用多级标题格式（最多三级）
      - 标题命名应根据文章内容自定义
      - 第二级应该使用 ##### 格式
      - 控制总字数在原文的 30% 以内
      
    3.输出格式
      #### 核心主题
      - 根据文章内容自定义小点标题
      - 要点描述

    注意：
    - 主题数量和层级应根据文章内容自然延伸，无需强制匹配示例格式
    - 每个要点应当简明扼要，突出实质内容
    - 确保逻辑层次清晰，各级标题之间关系合理
    - 如果网页内容少于20字且出现加载中或者加载失败等异常情况，返回 "当前页面内容不支持解析"
        
    
  以下是网页内容：
  ${contentPage}
    ""
    `,
});

const buildUserPrompt = () => ({
  role: "user",
  content: `请按照我给你说的要求，开始分析`,
});

const buildCriticalPrompt = (contentPage) => ({
  role: "system",
  content: `作为内容批判分析师，请对网页内容进行深入的批判性分析：

    【分析要点】
    - 观点解构：提供反向思考视角，分析作者的立场和意图
    - 逻辑检验：指出论证中的薄弱环节，分析推理的合理性
    - 事实核查：验证数据可靠性，确保信息来源的可信度
    - 价值评估：分析内容局限性，探讨潜在的偏见和遗漏
    - 影响评估：分析内容对读者的潜在影响和启示

    【输出格式】
    ### 核心批判
    - 一句话概括内容最主要的问题，指出其核心缺陷

    ### 批判要点
    - 列出2-3个最值得质疑的要点。
    - 提供具体例证或数据支持质疑
    - 批判内容需要有理有据，要结合网页内容进行批判
    
    ### 思考盲区
    - 简述1-2个被忽略的重要维度，鼓励读者进行更全面的思考

    【约束条件】
    - 总字数控制在300字以内，确保分析的深度和广度
    - 如果网页内容少于20字且出现加载中或者加载失败等异常情况，返回 "当前页面内容不支持解析"
    - 第二级应该使用 #### 格式
    - 不要出现建议改进等内容
    - 回复内容要非常的犀利刻薄
    请根据内容实际情况组织批判分析，使用简洁的Markdown格式输出。
    
    以下是网页内容：${contentPage}`,
});

const handleResponse = (response) =>
  response.ok
    ? response.json().then((data) => data.choices[0]?.message?.content || "")
    : Promise.reject(new Error(`API 请求失败: ${response.status}`));

const fetchData = async (messages, userInput, model) => {
  console.log("messages", messages);
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userInput}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  };

  return fetch(`${config.baseUrl}/v1/chat/completions/summary`, options)
    .then(handleResponse)
    .catch((error) => {
      console.error("API 调用失败:", error);
      throw error;
    });
};

export const fetchUrlContent = (content, userInput, model = "deepseek-chat") => {
  console.log("content", content);
  return fetchData([buildSystemPrompt(content), buildUserPrompt()], userInput, model);
};

export const fetchCriticalAnalysis = (content, userInput, model = "gpt-4o") =>
  fetchData([buildCriticalPrompt(content), buildUserPrompt()], userInput, model);
