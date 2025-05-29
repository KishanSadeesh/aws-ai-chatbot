import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import '../styles/chatAI.css'; // Assuming you have a CSS file for styling
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator
} from '@chatscope/chat-ui-kit-react';
import { invokeClaude } from '../aws/bedrockClient';

const ChatAI = () => {
  const navigate = useNavigate();
  const gotohome = () => navigate('/');

  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      message: 'Hello there! How can I assist you?',
      sender: 'Chatbot',
      direction: 'incoming',
    },
  ]);

  const bottomRef = useRef(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handlesend = async (message) => {
    const newMessage = {
      message,
      sender: 'user',
      direction: 'outgoing',
    };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setTyping(true);

    try {
      const response = await invokeClaude(message);
      const botMessage = {
        message: response.trim(),
        sender: 'Chatbot',
        direction: 'incoming',
      };
      setMessages([...updatedMessages, botMessage]);
    } catch (error) {
      console.error('Error fetching response:', error);
      setMessages([
        ...updatedMessages,
        {
          message: "Sorry, I couldn't fetch a response. Please try again.",
          sender: 'Chatbot',
          direction: 'incoming',
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', height: '100vh', backgroundColor: '#0d1117' }}>
      <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column' }}>
        <div className="header1">
          <h1>AI Chatbot</h1>
          <button id="home_button" onClick={gotohome}>Home page</button>
        </div>

        <div style={{ flexGrow: 1, padding: '1rem', minHeight: 0 }}>
          <MainContainer>
            <ChatContainer>
              <MessageList typingIndicator={typing ? <TypingIndicator content="Bot is typing..." /> : null}>
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
