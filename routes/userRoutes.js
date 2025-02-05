const express = require('express');
const router = express.Router();
const User = require('../models/user');

// ... (Your existing routes for getting users, getting user by ID)

router.post('/login', async (req, res) => {
    try {
        const { loginId, password } = req.body;

        const user = await User.findOne({ loginId });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid login credentials' });
        }

        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Invalid login credentials' });
        }

        const userResponse = user.toJSON();
        delete userResponse.password;

        res.json({ success: true, message: 'Login successful', user: userResponse });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Login failed', error: error.message });
    }
});


router.post('/', async (req, res) => {
    try {
        const { firstName, lastName, email, mobileNo, street, city, state, country, pincode, loginId, password } = req.body;

        const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { loginId }] });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Login ID already taken'
            });
        }

        const user = new User({
            firstName, lastName, email, mobileNo,
            address: { street, city, state, country, pincode },
            loginId, password
        });

        await user.save();

        const userResponse = user.toJSON();
        delete userResponse.password;

        res.status(201).json({ success: true, message: 'User registered successfully', user: userResponse });

    } catch (error) {
        console.error('Registration error:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: 'Validation Error', errors: Object.values(error.errors).map(err => err.message) });
        }

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({ success: false, message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` });
        }

        res.status(500).json({ success: false, message: 'Error registering user', error: error.message });
    }
});

module.exports = router;

