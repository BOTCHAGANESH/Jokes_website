const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const request = require('request');
const passwordHash = require('password-hash');
const session = require('express-session');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const serviceAccount = require('./key.json');
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
    res.render('home');
});

// Login route
app.post('/loginSubmit', async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).send('Email and password are required.');
        }

        const usersData = await db.collection('users')
            .where('email', '==', email)
            .get();

        let verified = false;
        let user = null;

        usersData.forEach((doc) => {
            if (passwordHash.verify(password, doc.data().password)) {
                verified = true;
                user = doc.data();
            }
        });

        if (verified) {
            // Save user info in session
            req.session.user = user;
            // Redirect to dashboard upon successful login
            res.redirect('/dashboard');
        } else {
            res.send('Login failed...');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.send('Something went wrong...');
    }
});

// Signup route
app.post('/signupSubmit', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.send('Passwords do not match. Please try again.');
    }

    try {
        const usersData = await db.collection('users')
            .where('email', '==', email)
            .get();

        if (!usersData.empty) {
            return res.send('SORRY!!! This account already exists...');
        }

        await db.collection('users').add({
            userName: username,
            email: email,
            password: passwordHash.generate(password)
        });

        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    } catch (error) {
        console.error('Error during signup:', error);
        res.send('Something went wrong...');
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }

    const { userName: username } = req.session.user;

    res.render('dashboard', {
        username: username,
    });
});

// Fetch Joke Route
// Fetch Joke Route
app.get('/getJoke', (req, res) => {
    request.get({
        url: 'https://api.api-ninjas.com/v1/jokes?limit=3',
        headers: {
            'X-Api-Key': '+KFwDKu3WR9Si0OXR6Oj0w==wlIPQ41gV3uUMBUx' // Replace with your actual API key
        },
    }, function(error, response, body) {
        if (error) {
            console.error('Error fetching joke:', error);
            return res.status(500).json({ error: 'Request failed' });
        }
        if (response.statusCode !== 200) {
            console.error('Error fetching joke - Status:', response.statusCode);
            return res.status(response.statusCode).json({ error: 'Error fetching joke' });
        }
        try {
            const jokeData = JSON.parse(body);
            if (!Array.isArray(jokeData) || jokeData.length === 0) {
                console.error('Invalid joke data:', body);
                return res.status(500).json({ error: 'Invalid joke data' });
            }
            const joke = jokeData[0].joke; // Extract the joke from the first item in the array
            res.json({ joke: joke });
        } catch (error) {
            console.error('Error parsing joke data:', error);
            res.status(500).json({ error: 'Error parsing data' });
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
