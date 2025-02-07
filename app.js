const express = require('express');
const mongoose = require('mongoose');

const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const bcrypt = require('bcrypt');
const User = require('./models/user');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect('mongodb+srv://MrkHp3gp9CqlhyJC:MrkHp3gp9CqlhyJC@cluster1.h25fu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Store connected users
const connectedUsers = new Map();

// Add this route before your socket.io connection handler
app.post('/api/users/offline', async (req, res) => {
  try {
    const { userId } = req.body;
    await User.findByIdAndUpdate(userId, {
      status: 'offline',
      lastActive: new Date()
    });
    io.emit('userOffline', userId);
    res.status(200).send();
  } catch (error) {
    console.error('Error updating offline status:', error);
    res.status(500).send();
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle user login
  socket.on('userLogin', async (loginData) => {
    try {
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

  // Handle user connection
  socket.on('userConnected', async (userId) => {
    try {
      await User.findByIdAndUpdate(userId, {
        status: 'online',
        lastActive: new Date()
      });
      connectedUsers.set(userId, socket.id);
      io.emit('userStatusUpdate', {
        userId,
        status: 'online',
        lastActive: new Date()
      });
      console.log(`User ${userId} connected`);
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  });

  // Handle user disconnection
  socket.on('userDisconnected', async (userId) => {
    try {
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
    } catch (error) {
      console.error('Error handling user disconnection:', error);
    }
  });

  // Handle user registration
  socket.on('userRegistered', async (userData) => {
    try {
      // Update the user status to online
      await User.findByIdAndUpdate(userData._id, {
        status: 'online',
        lastActive: new Date()
      });
      
      // Store socket mapping
      connectedUsers.set(userData._id, socket.id);
      
      // Broadcast to all clients
      io.emit('userStatusUpdate', {
        userId: userData._id,
        status: 'online',
        lastActive: new Date()
      });
      
      socket.broadcast.emit('newUserRegistered', userData);
    } catch (error) {
      console.error('Error handling new registration:', error);
    }
  });

  // Handle user status update
  socket.on('updateUserStatus', async (data) => {
    try {
      await User.findByIdAndUpdate(data.userId, {
        status: data.status,
        lastActive: new Date()
      });
      io.emit('userStatusUpdate', {
        userId: data.userId,
        status: data.status,
        lastActive: new Date()
      });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  });

  socket.on('userDisconnected', async (userId) => {
    try {
      await User.findByIdAndUpdate(userId, {
        status: 'offline',
        lastActive: new Date()
      });
      io.emit('userOffline', userId);
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  });

  socket.on('heartbeat', async (userId) => {
    try {
      await User.findByIdAndUpdate(userId, {
        lastActive: new Date()
      });
    } catch (error) {
      console.error('Error updating last active:', error);
    }
  });

  const cleanupInterval = setInterval(async () => {
    try {
      const inactiveThreshold = new Date(Date.now() - 60000);
      const inactiveUsers = await User.find({
        status: 'online',
        lastActive: { $lt: inactiveThreshold }
      });

      for (const user of inactiveUsers) {
        user.status = 'offline';
        await user.save();
        io.emit('userOffline', user._id);
      }
    } catch (error) {
      console.error('Error in cleanup interval:', error);
    }
  }, 30000);

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
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
    clearInterval(cleanupInterval);
    console.log('Client disconnected');
  });

  // Handle socket errors
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Make io accessible to routes
app.set('io', io);

module.exports = { app, server, io };
