const express = require('express');

const bodyParser = require('body-parser');
//const { pool, poolConnect } = require('./db');

const sql = require('mssql');

const jwt = require('jsonwebtoken');

const bcrypt = require('bcrypt');

const app = express();
const cookieParser = require('cookie-parser');

app.use(cookieParser());

const session = require('express-session');
const MSSQLStore = require('connect-mssql')(session);

const nodemailer = require('nodemailer');

app.use(express.json());

// Process application/x-www-form-urlencoded

app.use(bodyParser.urlencoded({ extended: true }));

// Process application/json

app.use(bodyParser.json());

// Secret key used to sign JWT
const secretKey = 'my-secret';

// Azure SQL Database Connection Settings

const config = {
    user: 'xxxxx', // better stored in an app setting such as process.env.DB_USER

    password: 'xxxxxxxxx', // better stored in an app setting such as process.env.DB_PASSWORD

    server: 'xxxxxxxxxxxxxxxx', // better stored in an app setting such as process.env.DB_SERVER

    port: process.env.DB_PORT || 1433, // optional, defaults to 1433, better stored in an app setting such as process.env.DB_PORT

    database: 'xxxxxxxx', // better stored in an app setting such as process.env.DB_NAME

    options: {
        encrypt: true,
        trustServerCertificate: false, // Change to true if you're using a self-signed certificate
        // connectionTimeout: 30000, // 30 seconds timeout for the initial connection
        // requestTimeout: 60000, // 60 seconds timeout for each request
        "requestTimeout": 10000,
        authentication: {
            type: 'default'
        },
        retry: {
            max: 1,
            interval: 5,
            idleTimeoutMillis: 30000
        }
    }
};

app.use(session({
    //store: new MSSQLStore(config),
    secret: secretKey,
    resave: false,
    saveUninitialized: false,
}));

app.use(express.static('public'));

const pool = new sql.ConnectionPool(config);

const poolConnect = pool.connect();

let userID = null;

module.exports = { pool, poolConnect };

const port = process.env.PORT || 3000;

const transporter = nodemailer.createTransport({
    port: 465,
    host: 'smtp.gmail.com', 
    service: "gmail",
    auth: {
        user: "xxxxxxxxx@gmail.com",
        pass: "xxxx-xxxx-xxxx-xxxx"
    },
    tls: {
        rejectUnauthorized: false
    },

});

// API endpoint to fetch data

app.get('/data', async (req, res) => {

    try {
        req.session.isAuth = true;
        // console.log(req.session);
        // console.log(req.session.id);
        // req.session.save((err) => {
        //     if (err) {
        //       console.error('Error saving session:', err);
        //       return res.status(500).send('Error saving session.');
        //     }

        //     return res.send('Session data saved successfully.');
        //   });        

        // const pool = await sql.connect(config);

        const result = await pool.request().query('SELECT [TaskID], [Name], [Description], [EstimatedTime], [Deadline] FROM [Dashboard_TasksManager_neeraja] WHERE UserID = ' + userID);

        sql.close();

        res.json(result.recordset);

    } catch (error) {

        console.error('Failed to retrieve data from the Azure database.', error);

        res.status(500).json({ error: 'Failed to retrieve data from the Azure database.' });

    }

});


app.post('/api/update', async (req, res) => {
    try {
        // await poolConnect;
        // Wait for the database connection
        const { task_ID, task_name, task_description, task_estimatedTime, task_deadline } = req.body;
        console.log(req.body);

        const request = pool.request();
        request.input('TaskID', sql.Int, parseInt(task_ID))
        request.input('Name', sql.VarChar, task_name)
        request.input('Description', sql.VarChar, task_description)
        request.input('EstimatedTime', sql.Int, task_estimatedTime)
        request.input('Deadline', sql.Date, task_deadline)

        // Execute the update query
        const result = await request.execute('UpdateTask_neeraja');

        //query('UPDATE [Dashboard_TasksManager_neeraja] SET Name = @Name, Description = @Description, EstimatedTime = @EstimatedTime, Deadline = @Deadline WHERE TaskID = @TaskID');

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
        console.log("Task was not updated. Try again.");
    }
});

app.post('/api/create', async (req, res) => {
    try {
        // await poolConnect; 
        // Wait for the database connection
        const { task_ID, task_name, task_description, task_estimatedTime, task_deadline } = req.body;

        console.log(req.body);

        const request = pool.request();
        //request.input('TaskID', sql.Int, parseInt(task_ID));
        request.input('Name', sql.VarChar, task_name)
        request.input('Description', sql.VarChar, task_description)
        request.input('EstimatedTime', sql.Int, task_estimatedTime)
        request.input('Deadline', sql.Date, task_deadline)
        request.input('UserID', sql.Int, userID)

        // Execute the update query
        const result = await request.execute('InsertTask_neeraja');
        //query('INSERT INTO Dashboard_TasksManager_neeraja (Name, Description, EstimatedTime, Deadline, UserID) VALUES (@Name, @Description, @EstimatedTime, @Deadline, @userID)');

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/delete', async (req, res) => {
    try {
        // await poolConnect; 
        // Wait for the database connection
        const { task_ID } = req.body;

        const request = pool.request();
        request.input('TaskID', sql.Int, parseInt(task_ID));

        // Execute the update query
        const result = await request.execute('DeleteTask_neeraja');
        //query('DELETE FROM Dashboard_TasksManager_neeraja WHERE TaskID = @TaskID');

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/newuser', async (req, res) => {
    try {
        // await poolConnect;
        const { first_name, last_name, email, password } = req.body;
        console.log(req.body);

        const crypto = require("crypto");

        // salt to be hashed with
        const salt = "password salt";

        // create a sha-256 hasher
        const sha256hasher = crypto.createHmac("sha256", salt);

        // hash the string and set the output format to hex
        const hash = sha256hasher.update(password).digest("hex");
        // console.log(hash);

        var mailData = {
            from: 'neerajakulkarni23@gmail.com',
            to: email,
            subject: 'Sign up Confirmation Email',
            text: 'Thank you for signing up!'
        };

        const request = pool.request();
        request.input('FirstName', sql.VarChar, first_name)
        request.input('LastName', sql.VarChar, last_name)
        request.input('Email', sql.VarChar, email)
        request.input('Password', sql.VarChar, hash)


    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
        console.log("Sign up unsuccessful. Try again.");
    }
});


// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const crypto = require("crypto");

        // salt to be hashed with
        const salt = "password salt";

        // create a sha-256 hasher
        const sha256hasher = crypto.createHmac("sha256", salt);

        // hash the string and set the output format to hex
        const hash = sha256hasher.update(password).digest("hex");
        // console.log(hash);

        // await poolConnect; 
        // Wait for the database connection
        const request = pool.request();

        request.input('email', sql.VarChar, email);
        request.input('password', sql.VarChar, hash);


        const result = await request.execute('LoginUser_neeraja');
        //query('SELECT * FROM [Users_TasksManager_neeraja] WHERE Email = @email and Password=@password');

        userID = result.recordset[0].ID;

        if (result.recordset.length === 1) {
            console.log("Login successful");
            // Generate JWT token
            const token = jwt.sign({ userEmail: result.recordset[0].Email }, secretKey, { expiresIn: '1h' });
            req.session.userID = userID; // Store the userID in the session
            req.session.token = token; // store the jwt token
            req.session.save(); // Save the session to ensure the data is persisted

            // Set the sessionID cookie with the session ID
            res.cookie('sessionID', req.sessionID, { httpOnly: true });
            // Return the token to the client
            res.json({ token: token });
            // req.session.token = token;
            // res.redirect(__dirname + '/public/dashboard.html');
        }
        else {
            res.json({ token: 0 });
        }



    } catch (error) {
        console.log('Error during login:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/login', (req, res) => {
    // Check if the user is already logged in
    if (req.cookies.sessionID && req.session.userID) {
        // Redirect to the dashboard page
        // return res.redirect('/dashboard');
        res.redirect('/dashboard');

    }
    else {
        res.sendFile(__dirname + '/public/login.html');
    }
})

app.get('/login.html', (req, res) => {
    if (req.cookies.sessionID && req.session.userID) {
        // Redirect to the dashboard page
        // return res.redirect('/dashboard');
        res.sendFile(__dirname + '/public/dashboard.html');

    }
    else {
        res.sendFile(__dirname + '/public/login.html');
    }
});

// Logout endpoint
app.get('/logout', (req, res) => {
    // Destroy the user's session to log them out
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during session destruction:', err);
            res.status(500).json({ message: 'Internal server error' });
        } else {
            // Clear the sessionID cookie to complete the logout process
            res.clearCookie('sessionID');
            res.redirect('/login'); // Redirect to the login page after logout
        }
    });
});


// Protected endpoint
app.get('/api/protected', (req, res) => {
    // Get the JWT token from the Authorization header
    const token = req.headers.authorization;

    // Verify the token
    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        // Token is valid 
        const userEmail = decoded.userEmail;

        // Perform actions for the protected endpoint
        res.json({ message: 'Protected endpoint accessed successfully.', userEmail });
    });
});


function authenticate(req, res, next) {
    // Check for the presence of the sessionID cookie 
    if (!req.cookies.sessionID || !req.session.userID) {
        return res.redirect('/login');
    }
    // User is authenticated, proceed with the next middleware or route handler 
    next();
}

app.get('/dashboard', (req, res) => {
    //console.log(req);
    if (!req.cookies.sessionID && !req.session.userID) {
        // return res.redirect('/login'); // Redirect to the login page if not logged in
        res.redirect('/login');
    }
    else {
        // Render the dashboard.html file
        res.sendFile(__dirname + '/public/dashboard.html');
    }
});


app.get('/signup', (req, res) => {

    res.sendFile(__dirname + '/public/signup.html');
})

// Start the server
app.listen(port, () => {

    console.log(`Server started on port ${port}`);

});
