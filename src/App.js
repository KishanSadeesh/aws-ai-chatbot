import {Routes,BrowserRouter as Router,Route} from 'react-router-dom';
import './App.css';
import Homepage from './pages/Homepage';
import ChatAI from './pages/chatAI';

import { Amplify } from 'aws-amplify';
import amplifyconfig from './amplifyconfiguration.json';

Amplify.configure(amplifyconfig);

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/chatAI" element={<ChatAI />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
