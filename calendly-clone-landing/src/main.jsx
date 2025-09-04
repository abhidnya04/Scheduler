// import React from 'react'
// import ReactDOM from 'react-dom/client'
// import { BrowserRouter } from 'react-router-dom'
// import App from './App.jsx'
// import './index.css'

// ReactDOM.createRoot(document.getElementById('root')).render(
//   <React.StrictMode>
//     <BrowserRouter>
//       <App />
//     </BrowserRouter>
//   </React.StrictMode>,
// )

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx';

import './index.css';
import SchedulePage from './components/SchedulePage.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="165982500731-too3mr5lrt1205dpjrqup05qdd1s83nc.apps.googleusercontent.com">
      <BrowserRouter>
      {/* <SchedulePage/> */}
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);


