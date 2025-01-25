const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const _ = require('lodash');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
  secret: 'your secret key',
  resave: false,
  saveUninitialized: false
}));

mongoose.connect("mongodb+srv://meremad:YMjb67MrtVGvWOiq@mertay.a4syn.mongodb.net/todolistDB?retryWrites=true&w=majority&appName=Mertay")

const itemsSchema = {
    name: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
};

const Item = mongoose.model("Item", itemsSchema);

const item1 = new Item({
    name: "Welcome"
});

const item2 = new Item({
    name: "Create"
});

const item3 = new Item({
    name: "Read"
});

const defaultItems = [item1, item2, item3];

const listSchema = {
    name: String,
    items: [itemsSchema],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
};

const List = mongoose.model("List", listSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

const User = mongoose.model("User", userSchema);

async function initializeAdmin() {
  const adminUser = await User.findOne({ username: 'YourName' });
  if (!adminUser) {
    const newAdmin = new User({
      username: 'meremad',
      password: 'meremad'
    });
    await newAdmin.save();
    console.log('Admin user created');
  }
}

initializeAdmin();

function isLoggedIn(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user) {
      req.session.user = user;
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  } catch (err) {
    console.log(err);
    res.redirect('/login');
  }
});

app.get("/", isLoggedIn, async function(req, res){
    try {
        const foundItems = await Item.find({ user: req.session.user._id });
        
        if (foundItems.length === 0) {
            await Item.insertMany(defaultItems.map(item => ({...item, user: req.session.user._id})));
            console.log("successfully added");
            res.redirect("/");
        } else {
            res.render("list", {listTitle: "Today", newListItems: foundItems});
        }
    } catch (err) {
        console.log(err);
    }
});

app.post("/", isLoggedIn, async function(req, res){   
    try {
        const itemName = req.body.newItem;
        const listName = req.body.list;

        const item = new Item({
            name: itemName,
            user: req.session.user._id
        });

        if (listName === "Today"){
            await item.save();
            res.redirect("/");
        } else {
            const foundList = await List.findOne({ name: listName, user: req.session.user._id });
            foundList.items.push(item);
            await foundList.save();
            res.redirect("/" + listName);
        }
    } catch (err) {
        console.log(err);
    }
});

app.post("/delete", isLoggedIn, async function(req, res){
    try {
        const checkedItemId = req.body.checkbox;
        const listName = req.body.listName;

        if (listName === "Today") {
            await Item.findByIdAndDelete(checkedItemId);
            console.log("successfully deleted");
            res.redirect("/");
        } else {
            await List.findOneAndUpdate(
                { name: listName, user: req.session.user._id },
                { $pull: { items: { _id: checkedItemId } } }
            );
            console.log("successfully deleted from custom list");
            res.redirect("/" + listName);
        }
    } catch (err) {
        console.log(err);
    }
});

app.get("/:customListName", isLoggedIn, async function(req, res){
    try {
        const customListName = _.capitalize(req.params.customListName);
        const foundList = await List.findOne({ name: customListName, user: req.session.user._id }).exec();

        if (!foundList){
            const list = new List({
                name: customListName,
                items: defaultItems.map(item => ({...item, user: req.session.user._id})),
                user: req.session.user._id
            });
            await list.save();
            res.redirect("/" + customListName);
        } else {
              res.render("list", {listTitle: foundList.name, newListItems: foundList.items});
        }
    } catch (err) {
        console.log(err);
    }
});

app.get('/profile', isLoggedIn, (req, res) => {
  res.render('profile', { user: req.session.user });
});

app.post('/profile', isLoggedIn, async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findById(req.session.user._id);
    user.username = username;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    await user.save();
    req.session.user = user;
    res.redirect('/profile');
  } catch (err) {
    console.log(err);
    res.redirect('/profile');
  }
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    req.session.user = newUser;
    res.redirect('/');
  } catch (err) {
    console.log(err);
    res.redirect('/register');
  }
});

// Update the login route to use bcrypt
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.user = user;
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  } catch (err) {
    console.log(err);
    res.redirect('/login');
  }
});

// Add a logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect('/login');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function(){
    console.log(`Server is running on port ${PORT}`);
});