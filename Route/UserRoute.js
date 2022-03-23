const express = require('express');
const router = express.Router();


//mongodb user model
const User = require('./../models/UserModels')

//lidando com senha
const bcrypt = require('bcrypt');

//cadastrar

router.post('/signup', (req, res) => {
    let {name, email, password, dateOfBirth} = req.body;
    name = name.trim();
    email = email.trim();
    password = password.trim();
    dateOfBirth = dateOfBirth.trim();

    if (name == "" || email == "" || password == "" || dateOfBirth == "") {
        res.json ({
            status:"FAILED",
            message:"Empty input fields!"
        });
    } else if (!/^[a-zA-Z ]*$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid name entered"
        })
    } else if (!/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)) {
        res.json({
            status: "FAILED",
            message: "Invalid email entered"
        })
    } else if (!new Date(dateOfBirth).getTime()) {
        res.json({
            status: "FAILED",
            message: "Invalid date of birth entered"
        })
    } else if (password.length <8) {
        res.json({
            status: "FAILED",
            message: "Password is too short!"
        })
    } else {
        //checar se email ja existe
        User.find({email}).then(result => {
            if (result.length){
                //usuario ja existe
                res.json({
                    status:"FAILED",
                    message:"User with the provided email already exists"
                });
            } else {
                // tentar criar novo usuario
                
               // module.exports.addUser = function (newUser, callback) {
                   // bcrypt.genSalt(10, (salt) => {
                      //  bcrypt.hash(newUser.passowrd, salt, (err, hash) => {
                      //      if (err) throw err;
                      //      newUser.passowrd = hash;
                      //      newUser.save(callback);
                   //     });
                 //   });
               // }

                // lindando com password
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth
                    });

                    newUser.save().then(result => {
                        res.json({
                            status: "Success",
                            message:"Signup successful",
                            data: result,
                        })
                    })
                    .catch(err => {
                        res.json({
                            status:"FAILED",
                            message:"An error occured while saving user account!"
                        })
                    })
                })
                .catch(err => {
                    res.json({
                        status:"FAILED",
                        message:"An error occured while hashing password!"
                    })
                }) 
            }

        }).catch(err => {
            console.log(err);
            res.json({
                status:"FAILED",
                message:"An error occured while checking for existing user"
            })
        })
    }
})

//logar
router.post('/signin', (req, res) => {
    let { email, password} = req.body;
    email = email.trim();
    password = password.trim();

    if (email == "" || password == "") {
        res.json({
            status:"FAILED",
            message:"Empty Credentials supplied"
        })
    } else {
        // checar se usuario existe
        User.find({email})
        .then(data => {
            if (data.length) {
                //usuario existe

                const hashedPassword = data[0].password;
                bcrypt.compare(password, hashedPassword).then(result => {
                    if (result){
                    // senha match
                    res.json({
                        status: "SUCCESS",
                        message: "Signin sucessful",
                        data: data
                    })
                } else {
                    res.json({
                        status:"FAILED",
                        message: "Invalid password"
                    })
                } 
            })
            .catch(err => {
                res.json({
                    status:"FAILED",
                    message: "An error occurred while comparing password"
                })
            })
        } else {
            res.json({
                status:"FAILED",
                message: "Invalid credentials entered!"
            })
        }
    })
    .catch(err => {
        res.json({
            status: "FAILED",
            message: "An error occured while checking for existing user" 
            })
        })
    }
})

module.exports = router;
