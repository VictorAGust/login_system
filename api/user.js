const express = require('express');
const router = express.Router();

//mongodb usuario model
const user = require('./../models/User');

// Senha Handler
const bcrypt = require('bcrypt');
const User = require('./../models/User');

// cadastro
router.post('/signup', (req, res) => {
    let {name, email, password, dateOfBirth} = req.body;
    name = name.trim();
    email = email.trim();
    password = password.trim();
    dateOfBirth = dateOfBirth.trim();

    if (name == "" || email == "" || password == "" || dateOfBirth == "") {
       res.json({
           status: "FAILED",
           message: "Empty input fields!"
       }); 
    } else if (!/^[a-zA-Z ]*$/.test(name)) {
        res.json({
            status: "FAILED",
            message: "Invalid name entered"
        })
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.json({
            status: "FAILED",
            message: "invalid email entered"
        })
    }else if (!new data(dateOfBirth).getTime()) {
        res.json({
            status: "Failed",
            message: "Invalid date of birth entered"
        })
    } else if (password.length < 8) {
        res.json({
            status: "Failed",
            message: "Password is too short!"
        })
    } else {
        // checar se usuario existe
        User.find({email}).then(result => {
            if (result.length) {
                // o usuario ja existe
                res.json({
                    status:"FAILED",
                    message: "User with the provided email already exists"
                })
            } else {
                // tentar criar novo usario

                //lidando com a senha
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword =>{
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth
                    });

                    newUser.save().then(result => {
                        res.json({
                            status: "SUCESS",
                            message: "Cadastrado com sucesso",
                            data: result,
                        })
                    })
                    .catch(err => {
                        res.json ({
                        status:"FAILED",
                        message: "An error occured while saving user account!"
                        })
                    })
                })
                .catch(err => {
                    res.json ({
                    status:"FAILED",
                    message: "An error occured while hashing password!"
                    })
                })
            }
        }).catch(err => {
            console.log(err);
            res.json({
                status: "FAILED",
                message: "An error occured while checking for existing user"
            })
        })
    }
})
// login
router.post('/signin', (req, res) => {
    let { email, password} = req.body;
    email = email.trim();
    password = password.trim();

    if (email == "" || password == "") {
        res.json({
            status:"FAILED",
            message: "Empry credentials supplied"
        })
    } else {
        //checar se usario exist
        user.find({email})
        .then(data => {
            if(data.length) {
                //usuario existe
                const hashedPassword = data[0].password;
                bcrypt.compare(password, hashedPassword).then(result => {
                    if (result){
                        //senha bate
                        res.json({
                            status: "SUCESS",
                            message: "Signin sucessful",
                            data: data
                        })
                    }
                })
                .catch(err => {
                   res.json({
                       status: "FAILED",
                       message: "An error occured while comparing passwords"
                   })     
                })
            } else {
                res.json({
                    status: "FAILED",
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