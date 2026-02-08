const firebaseConfig = {
  apiKey: "AIzaSyBLahiL7WFpeDmoWV3ZlRCg288Shwxw_EE",
  authDomain: "prototypefishda.firebaseapp.com",
  databaseURL: "https://prototypefishda-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "prototypefishda",
  storageBucket: "prototypefishda.firebasestorage.app",
  messagingSenderId: "452322894750",
  appId: "1:452322894750:web:4d10904fb4b320c261ac8f"
};

firebase.initializeApp(firebaseConfig);

// GLOBAL DATABASE REFERENCE
const database = firebase.database();