const socket = io();
window.addEventListener('beforeunload', () => {
  const userId = localStorage.getItem('userId');
  if (userId) {
    socket.emit('userDisconnected', userId);
    // Using sendBeacon for more reliable delivery during page unload
    navigator.sendBeacon('/users/offline', JSON.stringify({ userId }));
  }
});
let allUsers = [];
let activeUsers = [];

// DOM Elements
const searchInput = document.querySelector('.search-bar input');
const totalUsersSpan = document.querySelector('.total-users span');
const onlineUsersSpan = document.querySelector('.online-users span');
const activeUsersTable = document.querySelector('.active-users-table tbody');
const allUsersTable = document.querySelector('.all-users-table tbody');

// Initialize
document.addEventListener('DOMContentLoaded', fetchUsers);

// Event Listeners
searchInput.addEventListener('input', handleSearch);
socket.on('userStatusUpdate', handleUserStatusUpdate);
socket.on('newUserRegistered', handleNewUser);

// Add heartbeat mechanism
const heartbeatInterval = setInterval(() => {
  const userId = localStorage.getItem('userId');
  if (userId) {
    socket.emit('heartbeat', userId);
  }
}, 30000);

// Clear interval when socket disconnects
socket.on('disconnect', () => {
  clearInterval(heartbeatInterval);
});

// Add socket listener for offline status
socket.on('userOffline', (userId) => {
  updateUserOfflineStatus(userId);
});

// Fetch all users
async function fetchUsers() {
  try {
    const response = await fetch('/users');
    const data = await response.json();
    if (data.success) {
      allUsers = data.users;
      updateTables();
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    showNotification('Error fetching users', 'error');
  }
}

// Update tables
function updateTables() {
  activeUsers = allUsers.filter(user => user.status === 'online');
  // Update stats
  totalUsersSpan.textContent = allUsers.length;
  onlineUsersSpan.textContent = activeUsers.length;
  // Update tables
  updateActiveUsersTable();
  updateAllUsersTable();
}

// Update active users table
function updateActiveUsersTable() {
  activeUsersTable.innerHTML = activeUsers
    .map(user => createActiveUserRow(user))
    .join('');
}

// Update all users table
function updateAllUsersTable() {
  allUsersTable.innerHTML = allUsers
    .map(user => createAllUserRow(user))
    .join('');
}

// Create row for active users table
function createActiveUserRow(user) {
  return `
    <tr>
      <td>${user.firstName} ${user.lastName}</td>
      <td>${user.email}</td>
      <td>${new Date(user.lastActive).toLocaleString()}</td>
      <td><span class="status-badge ${user.status}">${user.status}</span></td>
      <td>
        <button onclick="viewUserDetails('${user._id}')" class="action-btn view">View</button>
      </td>
    </tr>
  `;
}

// Create row for all users table
function createAllUserRow(user) {
  return `
    <tr>
      <td>${user.firstName} ${user.lastName}</td>
      <td>${user.email}</td>
      <td>${user.mobileNo}</td>
      <td><span class="status-badge ${user.status}">${user.status}</td>
      <td>
        <button onclick="viewUserDetails('${user._id}')" class="action-btn view">View</button>
      </td>
    </tr>
  `;
}

// View user details
async function viewUserDetails(userId) {
  try {
    const response = await fetch(`/users/${userId}`);
    const data = await response.json();
    if (data.success) {
      const user = data.user;
      const modalContent = `
        <div class="modal-header">
          <h2>User Details</h2>
          <span class="close">&times;</span>
        </div>
        <div class="user-info">
          <div class="info-section personal-info">
            <h3>Personal Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>Full Name:</label>
                <span>${user.firstName} ${user.lastName}</span>
              </div>
              <div class="info-item">
                <label>Email:</label>
                <span>${user.email}</span>
              </div>
              <div class="info-item">
                <label>Mobile:</label>
                <span>${user.mobileNo}</span>
              </div>
              <div class="info-item">
                <label>Login ID:</label>
                <span>${user.loginId}</span>
              </div>
            </div>
          </div>
          <div class="info-section address-info">
            <h3>Address Details</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>Street:</label>
                <span>${user.address?.street || 'N/A'}</span>
              </div>
              <div class="info-item">
                <label>City:</label>
                <span>${user.address?.city || 'N/A'}</span>
              </div>
              <div class="info-item">
                <label>State:</label>
                <span>${user.address?.state || 'N/A'}</span>
              </div>
              <div class="info-item">
                <label>Country:</label>
                <span>${user.address?.country || 'N/A'}</span>
              </div>
              <div class="info-item">
                <label>Pincode:</label>
                <span>${user.address?.pincode || 'N/A'}</span>
              </div>
            </div>
          </div>
          <div class="info-section status-info">
            <h3>Account Status</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>Status:</label>
                <span class="status-badge ${user.status}">${user.status}</span>
              </div>
              <div class="info-item">
                <label>Last Active:</label>
                <span>${new Date(user.lastActive).toLocaleString()}</span>
              </div>
              <div class="info-item">
                <label>Registered On:</label>
                <span>${new Date(user.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      const modal = document.getElementById('userModal');
      const modalContentDiv = modal.querySelector('.modal-content');
      modalContentDiv.innerHTML = modalContent;
      modal.style.display = 'block';
      // Close modal functionality
      const closeBtn = modal.querySelector('.close');
      closeBtn.onclick = () => modal.style.display = 'none';
      window.onclick = (event) => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      };
    } else {
      showNotification('Error fetching user details', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error fetching user details', 'error');
  }
}

// Handle user status update
function handleUserStatusUpdate(data) {
  const userIndex = allUsers.findIndex(user => user._id === data.userId);
  if (userIndex !== -1) {
    allUsers[userIndex].status = data.status;
    allUsers[userIndex].lastActive = data.lastActive;
  } else {
    // If user is not found in allUsers, fetch the user details and add to allUsers
    fetch(`/users/${data.userId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          allUsers.push(data.user);
          updateTables();
        }
      })
      .catch(error => console.error('Error fetching user details:', error));
  }
  updateTables();
}

// Handle new user registration
function handleNewUser(userData) {
  allUsers.push(userData);
  updateTables();
}

// Handle search
function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const filteredUsers = allUsers.filter(user =>
    user.firstName.toLowerCase().includes(searchTerm) ||
    user.lastName.toLowerCase().includes(searchTerm) ||
    user.email.toLowerCase().includes(searchTerm)
  );
  activeUsers = filteredUsers.filter(user => user.status === 'online');
  // Update tables with filtered data
  activeUsersTable.innerHTML = activeUsers
    .map(user => createActiveUserRow(user))
    .join('');
  allUsersTable.innerHTML = filteredUsers
    .map(user => createAllUserRow(user))
    .join('');
}

// Show notification
function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Add after the last function (showNotification)
function updateUserOfflineStatus(userId) {
  const userIndex = allUsers.findIndex(user => user._id === userId);
  if (userIndex !== -1) {
    allUsers[userIndex].status = 'offline';
    allUsers[userIndex].lastActive = new Date();
    updateTables();
  }
}
