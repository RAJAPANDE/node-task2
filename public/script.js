document.addEventListener('DOMContentLoaded', () => {
// Initialize Socket.IO
const socket = io();
socket.on('connect', () => {
    console.log('Connected to server');
    const userId = localStorage.getItem('userId');
    if (userId) {
        socket.emit('userConnected', userId);
    }
});
// Form submission handler
const userForm = document.getElementById('userForm');
if (userForm) {
userForm.addEventListener('submit', async function(e) {
e.preventDefault();

if (!validateForm(this)) {
return;
}

setFormLoading(true);
const formData = new FormData(this);
const userData = Object.fromEntries(formData.entries());
try {
const response = await fetch('/users', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify(userData)
});


const data = await response.json();

if (response.ok) {
// Store user ID in localStorage
localStorage.setItem('userId', data.user._id);

showNotification('User registered successfully!', 'success');
this.reset();

// Emit new user event to socket
socket.emit('userConnected', data.user._id);

// Redirect to live users page after successful registration
setTimeout(() => {
window.location.href = '/live-users.html';
}, 1500);
} else {
throw new Error(data.message || 'Error registering user');
}
} catch (error) {
showNotification(error.message, 'error');
} finally {
setFormLoading(false);
}
});
}

// Form validation
function validateForm(form) {
const firstName = form.firstName.value.trim();
const lastName = form.lastName.value.trim();
const mobileNo = form.mobileNo.value.trim();
const email = form.email.value.trim();
const loginId = form.loginId.value.trim();
const password = form.password.value;

clearErrorMessages();
let isValid = true;

// Name validations
if (!/^[A-Za-z]{2,}<span class="math-inline">/\.test\(firstName\)\) \{
showFieldError\('firstName', 'First name should contain only letters and be at least 2 characters long'\);
isValid \= false;
\}
if \(\!/^\[A\-Za\-z\]\{2,\}</span>/.test(lastName)) {
showFieldError('lastName', 'Last name should contain only letters and be at least 2 characters long');
isValid = false;
}

// Mobile validation
if (!/^\d{10}<span class="math-inline">/\.test\(mobileNo\)\) \{
showFieldError\('mobileNo', 'Please enter a valid 10\-digit mobile number'\);
isValid \= false;
\}
// Email validation
if \(\!/^\[^\\s@\]\+@\[^\\s@\]\+\\\.\[^\\s@\]\+</span>/.test(email)) {
showFieldError('email', 'Please enter a valid email address');
isValid = false;
}

// Login ID validation
if (!/^[A-Za-z0-9]{4,}<span class="math-inline">/\.test\(loginId\)\) \{
showFieldError\('loginId', 'Login ID must be at least 4 characters long and contain only letters and numbers'\);
isValid \= false;
\}
// Password validation
if \(password\.length < 8\) \{
showFieldError\('password', 'Password must be at least 8 characters long'\);
isValid \= false;
\}
return isValid;
\}
// Show field error
function showFieldError\(fieldName, message\) \{
const field \= document\.querySelector\(\[name\="</span>{fieldName}"]);
if (field) {
const errorDiv = document.createElement('div');
errorDiv.className ='error-message';
errorDiv.textContent = message;
field.parentNode.insertBefore(errorDiv, field.nextSibling);
field.classList.add('error');
}
}

// Clear error messages
function clearErrorMessages() {
document.querySelectorAll('.error-message').forEach(el => el.remove());
document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

// Show notification
function showNotification(message, type) {
const notification = document.getElementById('notification');
if (notification) {
notification.textContent = message;
notification.className = notification ${type};
notification.classList.add('show');

setTimeout(() => {
notification.classList.remove('show');
}, 3000);
}
}

// Set form loading state
function setFormLoading(isLoading) {
const submitButton = document.querySelector('button[type="submit"]');
if (submitButton) {
submitButton.disabled = isLoading;
submitButton.innerHTML = isLoading ?
'<span class="spinner"></span> Registering...' :
'Register';
}
}

// Password strength indicator
const passwordInput = document.getElementById('password');
if (passwordInput) {
passwordInput.addEventListener('input', function() {
const strength = checkPasswordStrength(this.value);
updatePasswordStrength(strength);
});
}

function checkPasswordStrength(password) {
let strength = 0;
if (password.length >= 8) strength++;
if (/[A-Z]/.test(password)) strength++;
if (/[a-z]/.test(password)) strength++;
if (/[0-9]/.test(password)) strength++;
if (/[^A-Za-z0-9]/.test(password)) strength++;
return strength;
}

function updatePasswordStrength(strength) {
const strengthBar = document.querySelector('.password-strength');
if (strengthBar) {
const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];
strengthBar.style.background = linear-gradient(to right, ${colors[strength-1]} ${strength*20}%, #ddd ${strength*20}%);
}
}

// Real-time validation
const fields = ['firstName', 'lastName', 'email', 'mobileNo', 'loginId', 'password'];
fields.forEach(field => {
const element = document.querySelector([name="${field}"]);
if (element) {
element.addEventListener('input',
debounce(function() {
clearErrorMessages();
validateField(this);
}, 300)
);
}
});

function debounce(func, wait) {
let timeout;
return function executedFunction(...args) {
const later = () => {
clearTimeout(timeout);
func.apply(this, args);
};
clearTimeout(timeout);
timeout = setTimeout(later, wait);
};
}

function validateField(field) {
const form = document.getElementById('userForm');
if (!form) return;

const fieldName = field.name;
const value = field.value.trim();

switch(fieldName) {
case 'firstName':
case 'lastName':
if (!/^[A-Za-z]{2,}$/.test(value)) {
showFieldError(fieldName, ${fieldName === 'firstName' ? 'First' : 'Last'} name should contain only letters and be at least 2 characters long);
}
break;
case 'mobileNo':
if (!/^\d{10}$/.test(value)) {
showFieldError(fieldName, 'Please enter a valid 10-digit mobile number');
}
break;
case 'email':
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
showFieldError(fieldName, 'Please enter a valid email address');
}
break;
case 'loginId':
if (!/^[A-Za-z0-9]{4,}$/.test(value)) {
showFieldError(fieldName, 'Login ID must be at least 4 characters long and contain only letters and numbers');
}
break;
case 'password':
if (value.length < 8) {
showFieldError(fieldName, 'Password must be at least 8 characters long');
}
break;
}
}

// Socket connection status indicator
socket.on('connect', () => {
console.log('Connected to server');
});

socket.on('connect_error', (error) => {
console.error('Connection error:', error);
showNotification('Connection error. Please try again.', 'error');
});
});
