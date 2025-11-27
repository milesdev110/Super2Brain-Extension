import { config } from "../../config/index";

// 模拟登录模式标志
const USE_MOCK_LOGIN = true;

// 模拟获取验证码函数
export const getCode = async (email) => {
  if (USE_MOCK_LOGIN) {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    // 模拟成功发送验证码
    return { success: true };
  }

  try {
    const response = await fetch(`${config.baseUrl}/auth/send-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error(`获取邮件失败，请重试`);
    }

    const data = await response.json();

    // 验证返回数据的格式
    if (data.code !== 200) {
      throw new Error("获取验证码失败,请检查网络链接");
    }

    return data.data;
  } catch (error) {
    console.error("获取验证码出错:", error);
    throw error;
  }
};

// 模拟登录函数
export const login = async ({ email, code }) => {
  if (USE_MOCK_LOGIN) {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 简单验证（模拟）
    if (!email || !code) {
      throw new Error(`验证码错误或者已过期`);
    }

    // 返回模拟的登录数据
    return {
      access_token: "mock_access_token_" + Date.now(),
      user: {
        id: 1,
        email: email,
        name: email.split('@')[0],
        created_at: new Date().toISOString()
      }
    };
  }

  try {
    const response = await fetch(`${config.baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      throw new Error(`验证码错误或者已过期`);
    }

    const data = await response.json();

    if (data.code !== 200) {
      throw new Error("登录失败,请检查网络链接");
    }

    return data.data;
  } catch (error) {
    console.error("登录失败:", error);
    throw error;
  }
};