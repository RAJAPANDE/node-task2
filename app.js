const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const bcrypt = require('bcrypt'); // Make sure bcrypt is installed: npm install bcrypt

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://rajapandey8769:mscVwt8olbbxUO7q@cluster1.h25fu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1'; // Use environment variables in production

mongoose.connect(mongoURI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('userConnected', async (userData) => {  // Receive the full user object
        try {
            const User = mongoose.model('User');
            const userId = userData._id;

            const updatedUser = await User.findByIdAndUpdate(userId, { status: 'online', lastActive: new Date() }, { new: true });

            if (!updatedUser) {
                console.error("User not found for update:", userId);
                return; // Handle the case where the user is not found
            }

            connectedUsers.set(userId, socket.id);
            io.emit('userStatusUpdate', { userId, status: 'online', lastActive: new Date() });
            console.log(`User ${userId} connected`);

        } catch (error) {
            console.error('Error updating user status:', error);
        }
    });

    socket.on('disconnect', async () => {
        try {
            let userIdToUpdate = null;

            for (const [userId, socketId] of connectedUsers.entries()) {
                if (socketId === socket.id) {
                    userIdToUpdate = userId;
                    connectedUsers.delete(userId);
                    break;
                }
            }

            if (userIdToUpdate) {
                const User = mongoose.model('User');
                await User.findByIdAndUpdate(userIdToUpdate, { status: 'offline', lastActive: new Date() });
                io.emit('userStatusUpdate', { userId: userIdToUpdate, status: 'offline', lastActive: new Date() });
                console.log(`User ${userIdToUpdate} disconnected`);
            }

        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
        console.log('Client disconnected');
    });


    socket.on('userLogin', async (loginData) => {  // This is for direct socket login (if you need it)
        try {
            const User = mongoose.model('User');
            const user = await User.findOne({ loginId: loginData.loginId });

            if (user && await bcrypt.compare(loginData.password, user.password)) {
                await User.findByIdAndUpdate(user._id, { status: 'online', lastActive: new Date() });
                connectedUsers.set(user._id.toString(), socket.id);
                io.emit('userStatusUpdate', { userId: user._id, status: 'online', lastActive: new Date() });

                socket.emit('loginSuccess', { userId: user._id, firstName: user.firstName, lastName: user.lastName });
            } else {
                socket.emit('loginError', 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            socket.emit('loginError', 'Login failed');
        }
    });


    socket.on('updateUserStatus', async (data) => { // If you need a separate event for status updates
        try {
            const User = mongoose.model('User');
            await User.findByIdAndUpdate(data.userId, { status: data.status, lastActive: new Date() });
            io.emit('userStatusUpdate', { userId: data.userId, status: data.status, lastActive: new Date() });
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

app.use('/users', userRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

module.exports = { app, server, io };

