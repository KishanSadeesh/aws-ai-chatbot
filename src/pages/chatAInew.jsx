import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChatbotIcon from "../components/ChatBotIcon";
import "../styles/chatAInew.css";
import { get } from "aws-amplify/api";

const ChatAInew = () => {
  const cleanJsonResponse = (responseText) => {
  return responseText.replace(/```json|```js|```/g, '').trim();
};

const padAmountInQuery = (code) => {
  const match = code.match(/:amountValue['"]?\s*:\s*['"]?(\d+)['"]?/);
  if (match) {
    const rawAmount = match[1];
    const padded = rawAmount.padStart(5, '0'); // Pads like 500 → "00500"
    return code.replace(match[0], `:amountValue: "${padded}"`);
  }
  return code;
};


const generateQueryFromPrompt = async (userQuery) => {
  const schemaDescription = `
    Table: Intern_Sample_Table
    Attributes:
    - id (string, partition key)
    - OrderStatus, Amount, OrderDate, DeliveryDate (strings)
  `;

  const prompt = `
  You are a code assistant.
  Given the DynamoDB schema and a user query, generate a valid JavaScript:

  new QueryCommand({...})
  OR
  new ScanCommand({...})

  Use AWS SDK v3 and plain JavaScript values compatible with @aws-sdk/lib-dynamodb (e.g., "Amount": "123", not {"N": "123"}).

  Only return this one line of code wrapped in a JavaScript code block like:

  \`\`\`js
  new ScanCommand({...});
  \`\`\`

  DynamoDB Schema:
  ${schemaDescription}

  Instructions:
- If the question is about totals, stats, or rankings, include relevant info like Order ID and OrderDate.

  User Query:
  ${userQuery}
  `.trim();

  const responseText = await invokedeepseek(prompt);
  console.log("Before Cleaning Raw Query Generated:", responseText);

  const cleaned = cleanJsonResponse(responseText);

  // ✅ Handle both QueryCommand and ScanCommand
  const jsCode = cleaned.match(/new\s+(QueryCommand|ScanCommand)\s*\(([\s\S]*?)\);/);
  

  if (!jsCode) {
    console.error("Could not extract QueryCommand or ScanCommand from AI response:", responseText);
    throw new Error("Failed to extract valid query from AI response.");
  }

  // jsCode[1] = "QueryCommand" or "ScanCommand"
  // jsCode[2] = the object inside the parentheses
  let fixedCode = `new ${jsCode[1]}(${jsCode[2]});`;
  fixedCode = padAmountInQuery(fixedCode);
  console.log("Query generated:", fixedCode);

  return fixedCode;
};

// id from kishansadeesh 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
// another from kishansadeesh13 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
//github id with using in kishan1331  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  
// Send prompt to DeepSeek
const invokedeepseek = async (prompt) => {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer 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",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-r1-0528:free",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
};  

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
      const rawQuery = await generateQueryFromPrompt(newMessage.message);
      if (!rawQuery) throw new Error("Query generation failed");

      const restOperation = get({
        apiName: "aichatbot",
        path: "/items",
        options: {
          queryParams: {
            param: JSON.stringify({ rawQuery }),
          },
        },
      });

      const { body } = await restOperation.response;
      const json = await body.json();
      console.log("Response from API in front end :", json.response);
const finalPrompt = `
You are a helpful assistant. A user asked: "${newMessage.message}"

You received this matching data from DynamoDB:
${JSON.stringify(json.response, null, 2)}

Please analyze the data and respond with:
- Answer the question clearly and use plain English.
- If the question is about totals, stats, or rankings, include relevant info like Order ID and OrderDate.
- Include context (e.g., what the number represents).
- Do not mention any database, technical terms, or system details (like DynamoDB, schema, queries, etc.).
- Mention Rupees sign(₹) for amounts.
- Be concise but complete.
- If data is missing or partial, say so.
- Don't output code or markdown.
`.trim();



      const finalResponse = await invokedeepseek(finalPrompt);
      console.log("Final Response in front end :", finalResponse);
      const botMessage = {
        message: finalResponse.replace(/\*\*/g, "").trim(),
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
