const express = require("express");
const router = express.Router();


const User = require('./../models/UserModels');

const UserVerification = require('./../models/UserVerification');

const PasswordReset = require('./../models/PasswordReset');

const nodemailer = require("nodemailer");

const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

const bcrypt = require("bcrypt");

const path = require("path");

let transporter = nodemailer.createTransport({
    service: "hotmail",
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS,
    }
})

transporter.verify((error, success) => {
    if (error) {
        console.group(error);
    } else {
        console.log("Ready for messages");
        console.log(success);
    }
})


router.post('/signup', (req, res) => {
    let { name, email, password, dateOfBirth } = req.body;
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
    } else if (password.length < 8) {
        res.json({
            status: "FAILED",
            message: "Password is too short!"
        })
    } else {

        User.find({ email }).then(result => {
            if (result.length) {

                res.json({
                    status: "FAILED",
                    message: "User with the provided email already exists"
                });
            } else {

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
                                status: "FAILED",
                                message: "An error occured while saving user account!"
                            })
                        })
                })
                    .catch(err => {
                        res.json({
                            status: "FAILED",
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

const sendVerificationEmail = ({ _id, email }, res) => {
    
    const currentUrl = "http://localhost:5000/";

    const uniqueString = uuidv4() + _id;

    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify your Email",
        html: `<p>Verify your email address to complete the signup and login into your account.<\p><p>This link
        <b>expires in 6 hours<\b>.<\p><p>Press <a href=${currentUrl + "user/verify/" + _id + "/" + uniqueString}
        >here</a> to proceed.<\p>`,
    };

    const saltRounds = 10;
    bcrypt.
        hash(uniqueString, saltRounds)
        .then((hashedUniqueString) => {

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

                            res.json({
                                status: "PENDING",
                                message: "Verification email Sent",
                            });
                        })
                        .catch((error) => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Verification email failed"
                            });
                        })
                })
                .catch((error) => {
                    console.log(error);
                    res.json({
                        status: "FAILED",
                        message: "Couldn't save verification email data!"
                    });
                })
        })
        .catch(() => {
            res.json({
                status: "FAILED",
                message: "An error occurred while hashing email data!",
            });
        });
};


router.get("/verify/:userId/:uniqueString", (req, res) => {
    let { userId, uniqueString } = req.params;

    UserVerification
        .find({ userId })
        .then((result) => {
            if (result.length > 0) {
 

                const { expiresAt } = result[0];
                const hashedUniqueString = result[0].uniqueString;


                if (expiresAt < Date.now()) {

                    UserVerification
                        .deleteOne({ userId })
                        .then(result => {
                            User.deleteOne({ _id: userId })
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
                } else {

                    bcrypt
                        .compare(uniqueString, hashedUniqueString)
                        .then(result => {
                            if (result) {

                                User.updateOne({ _id: userId }, { verified: true })
                                    .then(() => {
                                        UserVerification.deleteOne({ userId })
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
                                let message = "Invalid verification details passed. Check your inbox.";
                                res.redirect(`/user/verified/error=true&message=${message}`);
                            }
                        })
                        .catch(error => {
                            let message = "An error occurred while comparing unique strings.";
                            res.redirect(`/user/verified/error=true&message=${message}`);
                        })
                }
            } else {
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

router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../views/verified.html"));
})

router.post('/signin', (req, res) => {
    let { email, password } = req.body;
    email = email.trim();
    password = password.trim();

    if (email == "" || password == "") {
        res.json({
            status: "FAILED",
            message: "Empty Credentials supplied"
        })
    } else {

        User.find({ email })
            .then(data => {
                if (data.length) {

                    if (!data[0].verified) {
                        res.json({
                            status: "FAILED",
                            message: "Email hasn't been verified yet. check your inbox."
                        });
                    } else {
                        const hashedPassword = data[0].password;
                        bcrypt.compare(password, hashedPassword).then(result => {
                            if (result) {

                                res.json({
                                    status: "SUCCESS",
                                    message: "Signin sucessful",
                                    data: data
                                })
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Invalid password"
                                })
                            }
                        })
                            .catch(err => {
                                res.json({
                                    status: "FAILED",
                                    message: "An error occurred while comparing password"
                                });
                            });
                    }

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
                });
            })
    }
});

router.post("/requestPasswordReset", (req, res) => {
    const { email, redirectUrl } = req.body;

    User
        .find({ email })
        .then((data) => {
            if (data.length) {

                if (!data[0].verified) {
                    res.json({
                        status: "FAILED",
                        message: "Email hasn't been verified yet. check your inbox",
                    });
                } else {

                    sendResetEmail(data[0], redirectUrl, res);
                }
            } else {
                res.json({
                    status: "FAILED",
                    message: "No account with the supplied email exists!",
                });
            }
        })
        .catch(error => {
            console.log(error);
            res.json({
                status: "FAILED",
                message: "An error occured while checking for existing user",
            });
        })
})

const sendResetEmail = ({ _id, email }, redirectUrl, res) => {
    const resetString = uuidv4 + _id;

    PasswordReset
        .deleteMany({ userId: _id })
        .then(result => {

            const mailOptions = {
                from: process.env.AUTH_EMAIL,
                to: email,
                subject: "Password Reset",
                html: `<p>Did you request a password reset?<\p> <p>If you did use the link below to reset it</p> <p>This link
        <b>expires in 1 Hour<\b>.<\p><p>Press <a href=${redirectUrl + "user/verify/" + _id + "/" + resetString}
        >here</a> to proceed.<\p>`,
            };

            const saltRounds = 10;
            bcrypt
                .hash(resetString, saltRounds)
                .then(hashedResetString => {

                    const newPasswordReset = new PasswordReset({
                        userId: _id,
                        resetString: hashedResetString,
                        createdAt: Date.now(),
                        expiredAt: Date.now() + 3600000
                    });

                    newPasswordReset
                        .save()
                        .then(() => {
                            transporter
                                .sendMail(mailOptions)
                                .then(() => {

                                    res.json({
                                        status: "PENDING",
                                        message: "Password reset email sent",
                                    });
                                })
                                .catch(error => {
                                    console.log(error);
                                    res.json({
                                        status: "FAILED",
                                        message: "Password reset email failed",
                                    });
                                })
                        })
                        .catch(error => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Couldn't save password reset data!",
                            });
                        })
                })
                .catch(error => {
                    console.log(error)
                    res.json({
                        status: "FAILED",
                        message: "An error occured while hashing the password reset data!",
                    });
                })
        })
        .catch(error => {
            console.log(error);
            res.json({
                status: "FAILED",
                message: "Clearing existing password reset records failed",
            });
        })
}

router.post("/resetPassword", (req, res) => {
    let { userId, resetString, newPasswordReset } = req.body

    PasswordReset
        .find({ userId })
        .then(result => {
            if (result.lenght > 0) {

                const { expiresAt } = result[0];
                const hashedResetString = result[0].resetString;

                if (expiresAt < Date.now()) {
                    PasswordReset
                        .deleteOne({ userId })
                        .then(() => {

                            res.json({
                                status: "FAILED",
                                message: "Password reset link has expired."
                            })
                        })
                        .catch(error => {
                            console.log(error);
                            res.json({
                                status: "FAILED",
                                message: "Clearing password reset record failed."
                            });
                        })
                } else {

                    bcrypt
                        .compare(resetString, hashedResetString)
                        .then((result) => {
                            if (result) {

                                const saltRounds = 10;
                                bcrypt
                                    .hash(newPassword, saltRounds)
                                    .then(hashedNewPassword => {

                                        User
                                            .updateOne({ _id: userId }, { password: hashedNewPassword })
                                            .then(() => {
                                                PasswordReset
                                                    .deleteOne({ userId })
                                                    .then(() => {
                                                        res.json({
                                                            status: "SUCCESS",
                                                            message: "Password has been reset successfully"
                                                        })
                                                    })
                                                    .catch(error => {
                                                        console.log(error);
                                                        res.json({
                                                            status: "FAILED",
                                                            message: "An error occurred while finalizing password reset."
                                                        })
                                                    })
                                            })
                                            .catch(error => {
                                                console.log(error);
                                                res.json({
                                                    status: "FAILED",
                                                    message: "Updating user password failed."
                                                })
                                            })
                                    })
                                    .catch(error => {
                                        console.log(error);
                                        res.json({
                                            status: "FAILED",
                                            message: "An error occurred while hashing new password."
                                        })
                                    })
                            } else {
                                res.json({
                                    status: "FAILED",
                                    message: "Invalid password reset details passed."
                                })
                            }
                        })
                        .catch(error => {
                            res.json({
                                status: "FAILED",
                                message: "Comparing password reset strings failed"
                            })
                        })
                }
            } else {
                res.json({
                    status: "FAILED",
                    message: "Password reset request not found."
                })
            }
        })
        .catch(error => {
            console.log(error);
            res.json({
                status: "FAILED",
                message: "Checking for existing password reset record failed."
            })
        })
})

module.exports = router;
