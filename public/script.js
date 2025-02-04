document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                const data = await response.json();

                if (response.ok) {
                    // Store user data
                    localStorage.setItem('userId', data.user._id);
                    localStorage.setItem('userData', JSON.stringify(data.user));

                    showNotification('User registered successfully!', 'success');
                    this.reset();

                    // Emit user connected status
                    socket.emit('userConnected', data.user._id);

                    // Redirect to live users page
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

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const loginId = document.getElementById('loginId').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ loginId, password })
                });

                const data = await response.json();

                if (data.success) {
                    // Store user data
                    localStorage.setItem('userId', data.user._id);
                    localStorage.setItem('userData', JSON.stringify(data.user));

                    // Emit user connected status
                    socket.emit('userConnected', data.user._id);

                    showNotification('Login successful', 'success');
                    
                    // Redirect to live users page
                    setTimeout(() => {
                        window.location.href = '/live-users.html';
                    }, 1000);
                } else {
                    showNotification(data.message);
                }
            } catch (error) {
                console.error('Login error:', error);
                showNotification('Login failed. Please try again.');
            }
        });
    }
});


