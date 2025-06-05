import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import "../styles/chatAI.css"; // Assuming you have a CSS file for styling
import { 
  MainContainer,  
  ChatContainer, 
  MessageList, 
  Message, 
  MessageInput,  
  TypingIndicator, 
} from "@chatscope/chat-ui-kit-react";
import { get } from "aws-amplify/api";

const ChatAI = () => {
  const navigate = useNavigate();
  const gotohome = () => navigate("/");

  const [typing, setTyping] = useState(false); 
  const [messages, setMessages] = useState([ 
    {
      message: "Hello there! How can I assist you?",
      sender: "Chatbot",
      direction: "incoming",
    },
  ]);

  const bottomRef = useRef(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  const handlesend = async (message) => {
    const newMessage = {
      message : message,
      sender: "user",
      direction: "outgoing",
    };
    
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setTyping(true);
    try {
      const restOperation = get({
        apiName: "aichatbot",
        path: "/items",
        options: {
          queryParams: {
            param: message,
          },
        },
      });
      const { body } = await restOperation.response;
      const json = await body.json();
      const token_prompt = `Input Token: ${json.inputTextTokenCount}<br />${json.results[0].outputText.trim()} <br /><br />Output Token:  ${json.results[0].tokenCount}`;
      // const txt = await body.text();
      console.log("GET call succeeded: ", token_prompt);
      const botMessage = {
        //message: json.results[0].outputText.trim(),
        message: token_prompt.trim(),
        sender: "Chatbot",
        direction: "incoming",
      };
      setMessages([...updatedMessages, botMessage]);
    } catch (e) {
      console.log("first", e);
      if (e.response && e.response.body) {
        try {
          const errorBody = await e.response.body.text();
          console.log("GET call failed: ", errorBody);
        } catch (parseError) {
          console.error("Failed to parse error body:", parseError);
        }
      } else {
        console.error("Unknown error format:", e);
      }
      setMessages([
        ...updatedMessages,
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
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#0d1117",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="header1">
          <h1>AI Chatbot</h1>
          <button id="home_button" onClick={gotohome}>
            Home page
          </button>
        </div>

        <div style={{ flexGrow: 1, padding: "1rem", minHeight: 0 }}>
          <MainContainer>
            <ChatContainer>
              <MessageList
                typingIndicator={
                  typing ? <TypingIndicator content="Bot is searching..." /> : null
                }
              >
                {messages.map((message, i) => (
                  <Message key={i} model={message} />
                ))}
                <div ref={bottomRef} />
              </MessageList>
              <MessageInput
                placeholder="Type message here"
                onSend={handlesend}
              />
            </ChatContainer>
          </MainContainer>
        </div>
      </div>
    </div>
  );
};

export default ChatAI;
