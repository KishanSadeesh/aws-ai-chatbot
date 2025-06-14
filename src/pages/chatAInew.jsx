import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChatbotIcon from "../components/ChatBotIcon";
import "../styles/chatAInew.css";
import { get } from "aws-amplify/api";

const ChatAInew = () => {
  const navigate = useNavigate();
  const gotohome = () => navigate("/");

  const [isOpen, setIsOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      message: "Hello! How can I assist you today?",
      sender: "Chatbot",
      direction: "incoming",
    },
  ]);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage = {
      message: inputMessage,
      sender: "user",
      direction: "outgoing",
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputMessage("");
    setTyping(true);

    try {
      const restOperation = get({
        apiName: "aichatbot",
        path: "/items",
        options: {
          queryParams: {
            param: newMessage.message,
          },
        },
      });

      const { body } = await restOperation.response;
      const json = await body.json();
      const botMessage = {
        message: json.response.replace(/\*\*/g, "").trim(),
        sender: "Chatbot",
        direction: "incoming",
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (e) {
      console.error("API error:", e);
      setMessages((prev) => [
        ...prev,
        {
          message: "Sorry, I couldn't fetch a response. Please try again.",
          sender: "Chatbot",
          direction: "incoming",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      <div className="chat-hint-box">
        <h4 style={{textAlign:"center", marginBottom: "10px"}}>🤖 Hi there! Need a hand?</h4>
        <p style={{ marginTop: "8px" }}>
          I’m your virtual assistant — here to help you get things done quickly
          and easily. Here’s what I can assist you with:
        </p>
        <ul>
          <li>
            <strong>Check order status</strong> : Get real-time updates on your
            sales orders.
          </li>
          <li>
            <strong>Track deliveries</strong> : Stay informed with live shipment
            tracking.
          </li>
          <li>
            <strong>View & download invoices</strong> : Access your documents
            anytime.
          </li>
          <li>
            <strong>Explore purchase insights</strong> : Understand your buying
            patterns.
          </li>
          <li>
            <strong>Ask anything</strong> : I'm available 24/7 for support or
            queries.
          </li>
        </ul>
        

        {!isOpen && (
          <>
          <p style={{ marginTop: "12px", fontWeight: "500", color: "orange" }}>
          Get instant help — just tap the chat icon in the bottom-right corner
          to begin.
        </p>
            <button
              style={{ marginTop: "10px" }}
              className="chat-toggle-btn"
              onClick={() => setIsOpen(true)}
            >
              <ChatbotIcon />
            </button>
          </>
        ) || isOpen && (
          <p style={{ marginTop: "12px", fontWeight: "500", color: "orange", textAlign: "center" }}>
          Tap the arrow to hide the chat
        </p>
        )}
      </div>
      {isOpen && (      
        <div className="container">
        <div className="chatbot-popup">
          {/* Header */}
          <div className="chat-header">
            <div className="header-info">
              <ChatbotIcon />
              <h2 className="logo-text">Chatbot</h2>
            </div>
            <button
              className="material-symbols-outlined"
              onClick={() => setIsOpen(false)}
            >
              keyboard_arrow_down
            </button>
          </div>

          {/* Body */}
          <div className="chat-body">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`message ${
                  msg.direction === "outgoing" ? "user-message" : "bot-message"
                }`}
              >
                {msg.direction === "incoming" && <ChatbotIcon />}
                <p className="message-text">{msg.message}</p>
              </div>
            ))}

            {/* Floating Button */}

            {typing && (
              <div className="message bot-message typing-indicator">
                <ChatbotIcon />
                <p className="message-text typing-dots">
                  searching
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Footer */}
          <div className="chat-footer">
            <form className="chat-form" onSubmit={handleSend}>
              <input
                type="text"
                placeholder="Type your message here..."
                className="message-input"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                required
              />
              <button type="submit" className="material-symbols-outlined">
                send
              </button>
            </form>
          </div>
        </div>
      </div> )}
       
       {!isOpen && (
      <div className="main-content">
        <h1>Welcome to the AI Help Center</h1>
        <p>
          Meet your smart virtual assistant — here to make your journey easier.
          Whether you need help tracking an order, downloading invoices, getting
          insights into your recent purchases, or simply have a quick question,
          our AI is ready to assist you in real time.
        </p>
        <p>
          Enjoy 24/7 support at your fingertips, no waiting in queues, no
          complicated steps. Everything you need is just a message away.
        </p>
        <p>
          Prefer talking to a human? Reach us anytime at{" "}
          <a href="mailto:nipurnait@gmail.com">nipurnait@gmail.com</a>
        </p>
        <button onClick={gotohome} className="home-btn">
          Go to Homepage
        </button>
      </div>
  )}
    </>
  );
};

export default ChatAInew;
