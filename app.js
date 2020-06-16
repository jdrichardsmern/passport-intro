const express = require('express');
const app = express();
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const passport = require('passport');
let MongoStore = require('connect-mongo')(session);
const { x } = require('./myModule');

const User = require('./models/User');

require('dotenv').config();
require('./lib/passport');

const port = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  })
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.log(`MongoDB Error: ${err}`));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(morgan('dev'));
app.use(cookieParser());
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    store: new MongoStore({
      url: process.env.MONGODB_URI,
      mongooseConnection: mongoose.connection,
      autoReconnect: true
    }),
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  console.log('Session', req.session);
  console.log('User:', req.user);
  next();
});

app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.errors = req.flash('errors');
  res.locals.success = req.flash('success');

  next();
});

app.get('/', (req, res) => {
  res.render('index');
});

const auth = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    return res.send('You are not authorized to view this page');
  }
};

app.get('/logged', auth, (req, res) => {
  res.render('logged');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/thankyou', (req, res) => {
  res.render('thankyou');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/bootstrap', (req, res) => {
  res.render('bootstrap');
});

app.post(
  '/login',
  passport.authenticate('local-login', {
    successRedirect: '/logged',
    failureRedirect: '/login',
    failureFlash: true
  })
);

app.post('/register', (req, res) => {
  User.findOne({ email: req.body.email }).then((user) => {
    if (user) {
      // res.status(400).json({ message: 'User Exists' });
      req.flash('errors', 'Account exists');
      return res.redirect(301, '/register');
    } else {
      const newUser = new User();
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(req.body.password, salt);

      newUser.name = req.body.name;
      newUser.email = req.body.email;
      newUser.password = hash;

      newUser
        .save()
        .then((user) => {
          req.login(user, (err) => {
            if (err) {
              res
                .status(500)
                .json({ confirmation: false, message: 'Server Error' });
            } else {
              res.redirect('/thankyou');
            }
          });
        })
        .catch((err) => console.log('Error here'));
    }
  });
});

app.get('/logout', (req, res) => {
  req.logout();
  req.flash('success', 'You are now logged out');
  res.redirect('/login');
});

app.listen(port, () => console.log(`Listening on port ${port}`));
