const express = require("express");
const router = express.Router();


//mongodb usuario /models
const User = require('./../models/UserModels')

//mongodb verificacao de usuario /models
const UserVerification = require('./../models/UserVerification')

//lidando com email
const nodemailer = require("nodemailer");

// unique string
const {v4: uuidv4} = require("uuid");

// env variaveis
require("dotenv").config();

//lidando com senha
const bcrypt = require("bcrypt");

// caminho para pagina de verificado
const path = require("path");

// nodemailer 
let transporter = nodemailer.createTransport({
    service: "hotmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS,
    }
})

// sucesso no teste
transporter.verify((error, success) => {
    if(error) {
        console.group(error);
    } else {
        console.log("Ready for messages");
        console.log(success);
    }
})


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

                // lindando com password
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds).then(hashedPassword => {
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth,
                        verified: false,
                    });

                    newUser.save().then(result => {
                        sendVerificationEmail(result, res);
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

//enviar verificacao de email
const sendVerificationEmail = ({_id, email}, res) => {
    //url que vai ser usada no email
    const currentUrl = "http://localhost:5000/";

    const uniqueString = uuidv4() + _id;

    //opçoes do email
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify your Email",
        html: `<p>Verify your email address to complete the signup and login into your account.<\p><p>This link
        <b>expires in 6 hours<\b>.<\p><p>Press <a href=${currentUrl + "user/verify/" + _id + "/" + uniqueString}
        >here</a> to proceed.<\p>`,
    };

    // hash uniqueString
    const saltRounds = 10;
    bcrypt.
    hash(uniqueString, saltRounds)
    .then((hashedUniqueString) => {
       // definir valores na collection userVerification
       const newVerification = new UserVerification({
           userId: _id,
           uniqueString: hashedUniqueString,
           createdAt: Date.now(),
           expiresAt: Date.now() + 21600000,
       });

       newVerification
       .save()
       .then(() => {
           transporter
           .sendMail(mailOptions)
           .then(() => {
               //email enviado e verificacao salva
               res.json({
                status:"PENDING",
                message:"Verification email Sent",
            });
           })
           .catch((error) => {
            console.log(error);
            res.json({
                status:"FAILED",
                message:"Verification email failed"
            });
           })
       })
       .catch((error) => {
           console.log(error);
           res.json({
            status:"FAILED",
            message:"Couldn't save verification email data!"
        });
       })
    })
    .catch(() => {
        res.json({
            status:"FAILED",
            message:"An error occurred while hashing email data!",
        });
    });
};

//verificar email
router.get("/verify/:userId/:uniqueString",(req, res) => {
    let {userId, uniqueString} = req.params;

    UserVerification
    .find({userId})
    .then((result) => {
        if (result.length > 0) {
            //verificacao de usuario existe entao procedemos     

          const {expiresAt} = result[0];
          const hashedUniqueString = result [0].uniqueString;

          // checando por expiraçao
          if (expiresAt < Date.now()) {
            // tempo expirado entao nos o deletamos
           UserVerification
           .deleteOne({ userId})
           .then(result => {
               User.deleteOne({_id: userId })
               .then(() => {
                let message = "Link has expired. Please sign up again.";
                res.redirect(`/user/verified/error=true&message=${message}`);
               })
               .catch(error => {
                let message = "Clearing user with expired unique string failed";
                res.redirect(`/user/verified/error=true&message=${message}`);
               })
           })
           .catch((error) => {
              console.log(error);
              let message = "An error occurred while clearing expired user verification record";
              res.redirect(`/user/verified/error=true&message=${message}`); 
           }) 
          } else{
              //esta valido entao validamos o usario
                //comparar o hashed unique string

            bcrypt
            .compare(uniqueString, hashedUniqueString)
            .then(result => {
                if (result) {
                    // strings combinam
                
                    User.updateOne({_id: userId}, {verified: true})
                    .then(() => {
                        UserVerification.deleteOne({userId})
                        .then(() => {
                            res.sendFile(path.join(__dirname, "./../views/verified.html"));
                        })
                        .catch(error => {
                            let message = "An error occurred while finalizing successful verification.";
                            res.redirect(`/user/verified/error=true&message=${message}`);
                        })
                    })
                    .catch(error => {
                        console.log(error);
                        let message = "An error occurred while updating user record to show verified.";
                        res.redirect(`/user/verified/error=true&message=${message}`);
                    })

                } else {
                    //existe um record mas as informacoes de verificacao estao incorretas
                    let message = "Invalid verification details passed. Check your inbox.";
                    res.redirect(`/user/verified/error=true&message=${message}`);
                }
            })
            .catach (error => {
                let message = "An error occurred while comparing unique strings.";
                res.redirect(`/user/verified/error=true&message=${message}`);
            })
          }
        } else {
            // verificacao de usuario nao existe
            let message = "Account record doesn't exist or has been verified already. Please sign up or log in.";
            res.redirect(`/user/verified/error=true&message=${message}`);
        }
    })
    .catch((error) => {
        console.log(error);
        let message = "An error occurred while checking for existing user verification record";
        res.redirect(`/user/verified/error=true&message=${message}`);
    })
})

// rota pagina de verificacao
router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"));
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
        User.find({ email })
        .then(data => {
            if (data.length) {
                //usuario existe

                //checar se usuario e verificado
                
                if (!data[0].verified) {
                    res.json({
                        status:"FAILED",
                        message: "Email hasn't been verified yet. check your inbox."
                    });
                } else {
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
                    });
                });
            }

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
