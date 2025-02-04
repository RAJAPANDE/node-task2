const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect('mongodb+srv://rajapandey8769:mscVwt8olbbxUO7q@cluster1.h25fu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Store connected users
const connectedUsers = new Map();

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log('New client connected');

    // Handle user login
    socket.on('userLogin', async (loginData) => {
        try {
            const User = mongoose.model('User');
            const user = await User.findOne({ loginId: loginData.loginId });

            if (user && await bcrypt.compare(loginData.password, user.password)) {
                // Update user status to online
                await User.findByIdAndUpdate(user._id, {
                    status: 'online',
                    lastActive: new Date()
                });

                // Store socket mapping
                connectedUsers.set(user._id.toString(), socket.id);

                // Broadcast to all clients
                io.emit('userStatusUpdate', {
                    userId: user._id,
                    status: 'online',
                    lastActive: new Date()
                });

                socket.emit('loginSuccess', {
                    userId: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName
                });
            } else {
                socket.emit('loginError', 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            socket.emit('loginError', 'Login failed');
        }
    });

    // Handle user disconnect (auto logout)
    socket.on('disconnect', async () => {
        try {
            for (const [userId, socketId] of connectedUsers.entries()) {
                if (socketId === socket.id) {
                    const User = mongoose.model('User');
                    await User.findByIdAndUpdate(userId, {
                        status: 'offline',
                        lastActive: new Date()
                    });

                    connectedUsers.delete(userId);

                    io.emit('userStatusUpdate', {
                        userId,
                        status: 'offline',
                        lastActive: new Date()
                    });

                    console.log(`User ${userId} disconnected`);
                    break;
                }
            }
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
        console.log('Client disconnected');
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Routes
app.use('/users', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Handle 404 routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Server setup
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = { app, server, io };


