const express = require('express');
const router = express.Router();

const User =  require('../models/user');// Corrected path

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const count = await User.countDocuments();
    res.json({
      success: true,
      users,
      total: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;
    // Find user by loginId
    const user = await User.findOne({ loginId: loginId });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }
    // Update user status to online
    user.status = 'online';
    user.lastActive = new Date();
    await user.save();
    // Create response without password
    const userResponse = user.toJSON();
    delete userResponse.password;
    res.json({
      success: true,
      message: 'Login successful',
      user: userResponse
    });
    // Emit socket event for user login
    req.app.get('io').emit('userStatusUpdate', {
      userId: user._id,
      status: 'online',
      lastActive: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Register new user
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobileNo,
      street,
      city,
      state,
      country,
      pincode,
      loginId,
      password
    } = req.body;
    // Check if user already exists (email or loginId)
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { loginId: loginId }
      ]
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase()
          ? 'Email already registered'
          : 'Login ID already taken'
      });
    }
    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      mobileNo,
      address: {
        street,
        city,
        state,
        country,
        pincode
      },
      loginId,
      password,
      status: 'online', // Set user as online after registration
      lastActive: new Date()
    });
    await user.save();
    // Remove password from response
    const userResponse = user.toJSON();
    delete userResponse.password;
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: userResponse
    });
    // Emit socket event for new user registration
    req.app.get('io').emit('newUserRegistered', userResponse);
  } catch (error) {
    console.error('Registration error:', error);
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

module.exports = router;
