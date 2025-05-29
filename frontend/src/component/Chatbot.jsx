import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);

  const toggleChat = () => setIsOpen(!isOpen);
  const refreshChat = () => {
    setMessages([]);
    setUserInput("");
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const typeWriterEffect = async (text, delay = 20) => {
    let current = "";
    for (let i = 0; i < text.length; i++) {
      await new Promise((res) => setTimeout(res, delay));
      current += text[i];
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { sender: "bot", text: current };
        return newMsgs;
      });
    }
  };

  const handleSend = async () => {
    if (!userInput.trim()) return;

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: userInput },
      { sender: "bot", text: "🤖 Aivee is typing..." },
    ]);
    setUserInput("");

    try {
      const res = await axios.post("/api/query", {
        question: userInput,
      });

      const botReply = res.data.answer || "Sorry, no response.";

      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { sender: "bot", text: "" };
        return newMsgs;
      });

      await typeWriterEffect(botReply);
    } catch (err) {
      console.error("Error:", err);
      setMessages((prev) => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
          sender: "bot",
          text: "❌ Server error. Try again later.",
        };
        return newMsgs;
      });
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 font-sans flex flex-col items-start">
      {isOpen && (
        <div className="mb-3 w-[370px] h-[530px] bg-black rounded-xl overflow-hidden shadow-2xl flex flex-col border border-green-600">
          <div className="bg-gradient-to-r from-green-700 to-green-500 text-white p-4 text-lg font-bold flex justify-between items-center">
            <span>Aivee</span>
            <div className="flex gap-3 text-xl">
              <button
                onClick={refreshChat}
                className="hover:text-white text-white/70 transition"
                title="Refresh Chat"
              >
                🔄
              </button>
              <button
                onClick={toggleChat}
                className="hover:text-red-400 transition"
                title="Close Chat"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-green-600 scrollbar-track-black">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] text-sm px-4 py-2 rounded-xl ${
                  msg.sender === "user"
                    ? "ml-auto bg-green-600 text-white shadow-md"
                    : "mr-auto bg-gray-800 text-green-300 shadow"
                }`}
              >
                {msg.text}
              </div>
            ))}
            <div ref={chatEndRef}></div>
          </div>

          <div className="border-t border-gray-800 p-3 flex gap-2 bg-zinc-900">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask something..."
              className="flex-1 bg-black text-white px-4 py-2 text-sm rounded-lg focus:outline-none"
              disabled={false}
            />
            <button
              onClick={handleSend}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <div
        onClick={toggleChat}
        className="w-16 h-16 bg-gradient-to-r from-green-600 to-green-700 rounded-full shadow-2xl flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
      >
        <img src="/chatbot.png" alt="chat icon" className="w-8 rounded-full h-8" />
      </div>
    </div>
  );
};

export default Chatbot;