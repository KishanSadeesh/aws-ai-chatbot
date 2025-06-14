import "../styles/Homepage.css"; // Assuming you have a CSS file for styling
import { useNavigate } from "react-router-dom";
//import ChatAI from './chatAI';
const Homepage = () => {
  const navigate = useNavigate();
  const gotochatbot = () => navigate("/ChatAInew");
  // const [messages, setMessages] = useState([;])
  //const [ typing, setTyping] = useState(false);
  
  return (
    <div>
      <header className="header">
        <h1>Welcome to the track Order Chatbot</h1>
        <p>Track your Order Details Using AI chatbot</p>
      </header>
      <main className="main-content-home">
        <section className="get-started">
          <h2>Get Started</h2>
          <button onClick={gotochatbot} className="startbutton">
            Start Chatting Now!
          </button>
        </section>
      </main>
      <footer className="footer">
        <p> &copy; Order Tracking AI chatbot </p>
      </footer>
    </div>
  );
};

export default Homepage;
