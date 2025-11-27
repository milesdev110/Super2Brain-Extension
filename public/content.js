async function extractArticleContent() {
  let article = document.querySelector("article");
  if (!article) {
    article = document.body;
  }
  return article.innerText;
}

function callLLM(content) {
  // const apiUrl = `https://s2bapi.zima.pet/text/v1/mindmap/chat/completions`;
  const apiUrl = `${config.baseUrl}/v1/chat/completions`;
  const token =  getUserInput();
  if (!token) {
    console.error("No API key provided.");
    return;
  }
  console.log("API key:", token);

  fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `作为一名专业的文档编辑专家，您需要具备以下技能和完成以下任务：
          1. 分析用户给的文章，提取出文章中的主要内容和结构。
          2. 将文章中的主要内容和结构转换为markdown格式。
          3. 以markdown格式输出。
          4. 输出格式参考如下：请严格按照以下格式输出

          参考格式：
          # 一级标题
          ## 二级标题
          - 节点内容1
          - 节点内容2
          - 节点内容3
          ## 二级标题
          - 节点内容1
          - 节点内容2
            - 子节点内容1
            - 子节点内容2
          ...
          
          以下是用户给定的参考文章：
          :\n\n${content}\n\n以markdown格式输出
          `,
        },
      ],
      stream: true,
    }),
  })
    .then((response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let text = "";

      function readStream() {
        reader.read().then(({ done, value }) => {
          if (done) {
            chrome.runtime.sendMessage({
              action: "updateMindmap",
              content: text,
            });
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonString = line.slice(6);
              if (jsonString !== "[DONE]") {
                try {
                  const json = JSON.parse(jsonString);
                  const deltaContent = json.choices[0].delta.content;
                  text += deltaContent;
                  chrome.runtime.sendMessage({
                    action: "updateMindmap",
                    content: text,
                  });
                } catch (e) {
                  console.error("Error parsing JSON:", e);
                }
              }
            }
          }

          readStream();
        });
      }

      readStream();
    })
    .catch((err) => {
      console.error("Error calling DeepSeek API:", err);
    });
}

const content = extractArticleContent();
chrome.runtime.sendMessage({ action: "openMindmap" });
callLLM(content);
