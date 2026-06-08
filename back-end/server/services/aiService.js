import axios from "axios";
import dotenv from "dotenv";
import { createServiceError } from "../utils/serviceError.js";
import { logger } from "../logger/logger.js";
import { callWithRetry } from "../utils/retryHelper.js";

dotenv.config();

export const createChatAI = async (message) => {
  if (!message) {
    throw createServiceError("Message is required", 400, {
      reply: "Message is required",
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw createServiceError(
      "AI hiện chưa được cấu hình (thiếu OPENROUTER_API_KEY).",
      503,
      { reply: "AI hiện chưa được cấu hình (thiếu OPENROUTER_API_KEY)." },
    );
  }

  try {
    //Sử dụng Retry để đảm bảo tính ổn định khi gọi API của OpenRouter
    const response = await callWithRetry(() =>
      axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "Bạn là AI hỗ trợ khách hàng PetShop." },
            { role: "user", content: message },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "PetShop AI",
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      ),
      {
        maxAttemps: 3, // thử lại tối đa 3 lần
        delayMs: 2000, // bắt đầu với 2 giây và tăng dần
      }
    );
    const asMessage = response?.data?.choices?.[0]?.message?.content || "AI hiện không khả dụng."; 
    return { reply: asMessage };
  } catch (error) {
    const reply =
      error.response?.data?.error?.message || "AI hiện không khả dụng.";
    throw createServiceError(reply, 500, { reply });
  }
};
