// auth.js - Authentication and User Management for Dashboard (FIXED FOR GUESTS)

console.log("auth.js loading...");

document.addEventListener('DOMContentLoaded', function() {
  console.log("Auth DOM loaded");
  
  // Check if Firebase is loaded
  if (typeof firebase === 'undefined') {
    console.error("Firebase is not loaded!");
    redirectToLogin();
    return;
  }

  // Initialize Firebase Auth
  const auth = firebase.auth();
  const database = firebase.database();
  
  // DOM Elements
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmailDisplay = document.getElementById('userEmail');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');

  let currentUser = null;

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  function showLoading(text = 'Loading...') {
    if (loadingText) loadingText.textContent = text;
    if (loadingOverlay) loadingOverlay.classList.add('active');
  }

  function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }

  function redirectToLogin() {
    console.log("🔄 Redirecting to login...");
    // Clear session
    localStorage.removeItem('userSession');
    window.location.href = '../index.html';
  }

  function displayUserEmail(email, isGuest = false) {
    if (userEmailDisplay) {
      if (isGuest) {
        userEmailDisplay.textContent = 'Guest User';
        userEmailDisplay.title = 'Logged in as guest';
      } else {
        // Extract username from email for cleaner display
        const username = email.split('@')[0];
        userEmailDisplay.textContent = username;
        userEmailDisplay.title = email; // Show full email on hover
      }
      console.log("✅ User display updated");
    }
  }

  async function updateLastLogin(uid) {
    try {
      await database.ref('users/' + uid).update({
        lastLogin: firebase.database.ServerValue.TIMESTAMP
      });
      console.log("✅ Last login timestamp updated");
    } catch (error) {
      console.error("❌ Error updating last login:", error);
    }
  }

  async function loadUserData(uid) {
    try {
      const snapshot = await database.ref('users/' + uid).once('value');
      const userData = snapshot.val();
      
      if (userData) {
        console.log("✅ User data loaded from database");
        return userData;
      } else {
        console.warn("⚠️ No user data found in database");
        return null;
      }
    } catch (error) {
      console.error("❌ Error loading user data:", error);
      return null;
    }
  }

  // ============================================
  // AUTH STATE MANAGEMENT (FIXED FOR GUESTS)
  // ============================================
  
  auth.onAuthStateChanged(async (user) => {
    console.log("🔄 Auth state changed");
    
    if (user) {
      console.log("✅ User signed in:", user.uid);
      console.log("   Is anonymous:", user.isAnonymous);
      
      // Check if user is anonymous (guest)
      if (user.isAnonymous) {
        console.log("👤 Guest user detected");
        
        // Guest user - no email verification needed
        currentUser = user;
        displayUserEmail('guest@fishda.local', true);
        
        // Verify guest session in localStorage
        const userSession = localStorage.getItem('userSession');
        if (!userSession) {
          console.log("⚠️ No guest session found, creating one");
          localStorage.setItem('userSession', JSON.stringify({
            uid: user.uid,
            username: 'Guest User',
            email: 'guest@fishda.local',
            role: 'guest',
            isLoggedIn: true,
            isGuest: true,
            timestamp: new Date().toISOString()
          }));
        }
        
        // Hide loading overlay
        hideLoading();
        
        console.log("🎉 Guest authenticated and dashboard ready");
        return;
      }
      
      // Regular user (not anonymous)
      console.log("👤 Regular user detected:", user.email);
      
      // Check if email is verified
      if (!user.emailVerified) {
        console.warn("⚠️ User email not verified");
        hideLoading();
        alert('Please verify your email before accessing the dashboard.');
        await auth.signOut();
        redirectToLogin();
        return;
      }
      
      // User is authenticated and verified
      currentUser = user;
      displayUserEmail(user.email, false);
      
      // Update last login timestamp
      await updateLastLogin(user.uid);
      
      // Load user data (optional - for future use)
      await loadUserData(user.uid);
      
      // Hide loading overlay
      hideLoading();
      
      console.log("🎉 User authenticated and dashboard ready");
      
    } else {
      // No user is signed in
      console.log("❌ No user signed in - redirecting to login");
      redirectToLogin();
    }
  });

  // ============================================
  // LOGOUT FUNCTIONALITY (FIXED FOR GUESTS)
  // ============================================
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      
      console.log("🚪 Logout button clicked");
      
      // Check if user is guest
      const userSession = localStorage.getItem('userSession');
      let isGuest = false;
      
      if (userSession) {
        try {
          const session = JSON.parse(userSession);
          isGuest = session.isGuest === true;
        } catch (error) {
          console.error("Error parsing session:", error);
        }
      }
      
      // Show confirmation dialog (skip for guests or make it quick)
      const confirmLogout = isGuest ? true : confirm('Are you sure you want to logout?');
      
      if (!confirmLogout) {
        console.log("Logout cancelled by user");
        return;
      }
      
      showLoading('Logging out...');
      
      try {
        // Sign out from Firebase
        await auth.signOut();
        console.log("✅ User signed out successfully");
        
        // Clear session storage
        localStorage.removeItem('userSession');
        sessionStorage.clear();
        
        console.log("✅ Session cleared");
        
        // Redirect to login page
        setTimeout(() => {
          redirectToLogin();
        }, 500);
        
      } catch (error) {
        console.error("❌ Logout error:", error);
        hideLoading();
        alert('Error logging out: ' + error.message);
      }
    });
  } else {
    console.warn("⚠️ Logout button not found in DOM");
  }

  // ============================================
  // PAGE VISIBILITY - SECURITY
  // ============================================
  
  // Re-check auth when page becomes visible (security feature)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && !currentUser) {
      console.log("⚠️ Page visible but no user - redirecting");
      redirectToLogin();
    }
  });

  // ============================================
  // SESSION TIMEOUT (OPTIONAL - DISABLED FOR GUESTS)
  // ============================================
  
  // Auto-logout after 1 hour of inactivity (but NOT for guests)
  let inactivityTimer;
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    
    // Check if user is guest - guests don't timeout
    const userSession = localStorage.getItem('userSession');
    if (userSession) {
      try {
        const session = JSON.parse(userSession);
        if (session.isGuest) {
          console.log("Guest user - no inactivity timeout");
          return; // Don't set timeout for guests
        }
      } catch (error) {
        console.error("Error checking guest status:", error);
      }
    }
    
    // Set timeout for regular users
    inactivityTimer = setTimeout(() => {
      console.log("⏰ Session timeout due to inactivity");
      alert('Your session has expired due to inactivity. Please login again.');
      auth.signOut().then(() => {
        redirectToLogin();
      });
    }, INACTIVITY_TIMEOUT);
  }

  // Track user activity
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
  });

  // Start the inactivity timer
  resetInactivityTimer();

  console.log("✅ Auth.js fully loaded and active");
});