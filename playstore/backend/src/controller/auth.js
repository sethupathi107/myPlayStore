import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User , Session } from "../sequelize/config/database.js";
import { logger } from "../utils/logger.js";
import sequelize from "../sequelize/config/database.js";
import mailQueue from "../utils/mailQueue.js";

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const RESET_SECRET = process.env.RESET_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY;
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY;
const RESET_TOKEN_EXPIRY = process.env.RESET_TOKEN_EXPIRY;

function generateAccessToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
        },
        JWT_SECRET,
        {
            expiresIn: ACCESS_TOKEN_EXPIRY
        }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        REFRESH_SECRET,
        {
            expiresIn: REFRESH_TOKEN_EXPIRY
        }
    );
}


async function signin(req,res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            where:{email:email}
        })

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        } 

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }
        const user1 = {
            id:user.id,
            email:user.email,
            role:user.role
        };

        const accessToken = generateAccessToken(user1);
        const refreshToken = generateRefreshToken(user1);

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        
        await Session.create({
            userId:user.id,
            token:refreshToken,
            expireAt:expiresAt
        })

        logger.info(`User ${user.id} signed in`);

        res.json({
            message: "Sign in successful 1",
            accessToken,
            refreshToken
        });

        try {
            await mailQueue.add("login-notification", {
                to: user.email,
                subject: "New login detected",
                text: `Hi, you just logged in at ${new Date().toISOString()}. If this wasn't you, please secure your account.`,
            });
        } catch (error) {
            logger.error("Failed to enqueue login email: ", error.message);
        }

    } catch (error) {
        logger.error(error.stack || error.message);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}


async function signup(req,res){
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);

        const {user,accessToken,refreshToken} = await sequelize.transaction(async(t)=>{
            // role is never taken from the request body - signup only ever
            // creates a "user" account. Promoting someone to admin still
            // requires hand-editing the DB (see CONTEXT.md).
            const user = await User.create({ username:name, email : email, password : hashedPassword, role: "user" },{transaction:t});

    
            const newUser = {
                id: user.id,
                email,
                role: user.role,
            };
     
            const accessToken = generateAccessToken(newUser);
            const refreshToken = generateRefreshToken(newUser);
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);
    
            await Session.create({userId:user.id,token:refreshToken,expireAt:expiresAt },{transaction:t})
            return {user,accessToken, refreshToken};
        })
        const { password:_password, ...safeUser } = user.toJSON();
        

        logger.info(`User ${user.id} signed up`);   

        res.status(201).json({
            safeUser,
            message: "User registered successfully",
            accessToken,
            refreshToken
        });

        try {
            await mailQueue.add("signUp-notification", {
                to: user.email,
                subject: "New user",
                text: `Hi, this is just new user to the playstore world`,
            });
        } catch (error) {
            logger.error("Failed to enqueue login email: ", error.message);
        }

    } catch (error) {
        logger.error(error.stack || error.message);

        // @sequelize/core wraps the pg unique-violation as a
        // SequelizeUniqueConstraintError whose own `.code` is undefined -
        // the actual pg code ("23505") only lives on `error.cause` (the
        // deprecated `.parent`/`.original` also carry it). Only `email` has
        // a unique constraint on the User model, so a collision here always
        // means "email already exists".
        if (error.name === "SequelizeUniqueConstraintError" || error.cause?.code === "23505") {
            return res.status(409).json({
                message: "Email already exists"
            });
        }

        res.status(500).json({
            message: "Internal server error",
        });
    }
}
 


async function refreshToken(req,res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                message: "Refresh token is required"
            }); 
        }

        console.log(refreshToken);

        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

        const result = await User.findOne({
            where:{ email:decoded.email }
        })
        if (!result) {
            return res.status(401).json({
                message: "Invalid refresh token"
            });
        }

        const result1 = await Session.findOne({
            where:{userId : result.id , token:refreshToken}
        })
        
        if (!result1) {
            return res.status(401).json({
                message: "token expired login again"
            });
        }

        const accessToken = generateAccessToken({id:result.id,email:result.email,role:result.role});

        res.json({
            accessToken
        });

    } catch (error) {
        logger.error(error.stack || error.message);
        return res.status(403).json({
            message: "Invalid or expired refresh token"
        });
    }
}


async function logout(req,res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                message: "Refresh token is required"
            });
        }
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const result = await User.findOne({
            where:{ email:decoded.email }
        })
        if (!result) {
            return res.status(401).json({
                message: "Invalid refresh token"
            });
        }
        const result1 = await Session.findOne({
            where:{userId : result.id , token:refreshToken}
        })
        if (!result1) {
            return res.status(401).json({
                message: "token expired login again"
            });
        }
        await result1.destroy();
        
        res.json({
            message: "Logged out successfully"
        });

    } catch (error) {
        logger.error(error.stack || error.message);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}


async function logoutAll(req,res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                message: "Refresh token is required"
            });
        }

        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

        const result = await User.findOne({
            where:{ email:decoded.email }
        })

        if (!result) {
            return res.status(401).json({
                message: "Invalid refresh token"
            });
        }

        await Session.destroy({
            where:{userId : result.id}
        });

        logger.info(`User ${result.id} logged out from all devices`);

        res.json({
            message: "Logged out from all devices"
        });

    } catch (error) {
        return res.status(403).json({
            message: "Invalid or expired refresh token"
        });
    }
}


async function forgotPassword(req,res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email is required"
            });
        }

        const user = await User.findOne({
            where:{ email:email }
        })

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const resetToken = jwt.sign(
            {
                id:user.id,
                email:email
            },
            RESET_SECRET,
            {
                expiresIn: RESET_TOKEN_EXPIRY
            }
        );

        await Session.create({
            userId : user.id,
            token:resetToken,
        })


        logger.info(`User ${user.id} requested a password reset`);

        res.json({
            message: "Reset token generated. and send it to user mail",
        });
        try {
            await mailQueue.add("login-notification", {
                to: user.email,
                subject: "password change request",
                text: `new password request at ${new Date().toISOString()} ${resetToken}`,
            });
        } catch (error) {
            logger.error("Failed to enqueue login email: ", error.message);
        }

    } catch (error) {
        logger.error(error.stack || error.message);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}


async function resetPassword(req,res) {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({
                message: "Reset token and new password are required"
            });
        }

        const decoded = jwt.verify(resetToken, RESET_SECRET);

        const user = await User.findOne({
            where:{ email:decoded.email }
        })

        if (!user) {
            return res.status(403).json({
                message: "Invalid or expired reset token"
            });
        }

        const reset = await Session.findOne({
            where:{token:resetToken}
        })

        if (!reset) {
            return res.status(403).json({
                message: "Invalid or expired reset token"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await sequelize.transaction(async (t) => {
            user.password = hashedPassword;
            await user.save({ transaction: t });

            await Session.destroy({
                where: { userId: user.id },
                transaction: t
            });
        });

        logger.info(`User ${user.id} reset their password`);

        res.json({
            message: "Password reset successful. Please sign in again"
        });

    } catch (error) {
        logger.error(error.stack || error.message);
        return res.status(403).json({
            message: "Invalid or expired reset token"
        });
    }
}
async function deleteAccount(req,res){
    try{
        const{password }=req.body;
        if(!password){
            return res.status(400).json({
                message:"Password is required"
            })
        }
        const user = await User.findOne({
            where:{id:req.user.id}
        });
        if(!user){
            return res.status(404).json({
                message:"User not found"
            });
        }

        const passwordMatch = await bcrypt.compare(password,user.password);
        if(!passwordMatch){
            return res.status(401).json({
                message:"Incorrect password"
            })
        }

        await sequelize.transaction(async(t)=>{{
            await user.destroy({transaction:t});
        }})

        logger.info(`User ${user.id} deleted their account`);

        res.json({
            message: "Account deleted successfully"
        });
    } catch (error) {
        logger.error(error.stack || error.message);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

/**
 * PATCH /v1/sign/change-password  (auth required)
 * Body: {currentPassword, newPassword}. Unlike forgot/reset-password (which
 * exist for someone who is locked out and needs an emailed token), this is
 * the in-app "I know my password, just want a new one" path - confirm the
 * current one, hash and store the new one. Doesn't touch other sessions;
 * use /sign/logout-all separately if you also want to sign out elsewhere.
 */
async function changePassword(req,res){
    try{
        const { currentPassword, newPassword } = req.body;

        if(!currentPassword || !newPassword){
            return res.status(400).json({
                message:"Current password and new password are required"
            });
        }

        const user = await User.findOne({ where:{ id:req.user.id } });
        if(!user){
            return res.status(404).json({ message:"User not found" });
        }

        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if(!passwordMatch){
            return res.status(401).json({ message:"Current password is incorrect" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        logger.info(`User ${user.id} changed their password`);

        res.json({ message: "Password changed successfully" });
    } catch (error) {
        logger.error(error.stack || error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

export default {
    signin,
    signup,
    refreshToken,
    logout,
    logoutAll,
    forgotPassword,
    resetPassword,
    changePassword,
    deleteAccount
}