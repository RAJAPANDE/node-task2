const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Register new user
router.post('/', async (req, res) => {
    try {
        const { firstName, lastName, email, mobileNo, street, city, state, country, pincode, loginId, password } = req.body;

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
            address: { street, city, state, country, pincode },
            loginId,
            password,
            status: 'online', // Set user as online after registration
            lastActive: new Date()
        });

        await user.save();

        // Remove password from response
        const userResponse = user.toJSON();
        delete userResponse.password;

        // Emit the new user registration status update to all clients
        io.emit('userStatusUpdate', {
            userId: user._id,
            status: 'online',
            lastActive: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering user',
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

        // Emit the login status update to all clients
        io.emit('userStatusUpdate', {
            userId: user._id,
            status: 'online',
            lastActive: new Date()
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: userResponse
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

module.exports = router;


