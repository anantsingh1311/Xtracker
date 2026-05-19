const mongoose = require('mongoose');

const Schema = mongoose.Schema;

//for password, first create the password field in your DB schema, then install bcryptjs using npm install
const bcrypt = require("bcryptjs");
const { getDefaultMonthlyTokenLimit } = require("../utils/ai-quota");

function isBcryptHash(value) {
    return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

//The Way data is saved to the database
const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 32,
        match: /^[A-Za-z0-9_.-]+$/
    },
    name: {
        type: String,
        trim: true,
        minlength: 2,
        maxlength: 32
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
        index: true
    },
    aiQuota: {
        monthlyTokenLimit: {
            type: Number,
            min: 0,
            default: getDefaultMonthlyTokenLimit
        },
        tokensUsedThisPeriod: {
            type: Number,
            min: 0,
            default: 0
        },
        periodStartedAt: {
            type: Date,
            default: Date.now
        },
        updatedAt: {
            type: Date
        }
    },
    billing: {
        plan: {
            type: String,
            enum: ["free", "pro_monthly", "pro_yearly"],
            default: "free"
        },
        status: {
            type: String,
            enum: ["free", "active", "expired"],
            default: "free"
        },
        paidUntil: {
            type: Date
        },
        lastPayment: {
            provider: {
                type: String,
                trim: true
            },
            planId: {
                type: String,
                trim: true
            },
            orderId: {
                type: String,
                trim: true
            },
            paymentId: {
                type: String,
                trim: true
            },
            amount: {
                type: Number,
                min: 0
            },
            currency: {
                type: String,
                trim: true,
                uppercase: true,
                maxlength: 3
            },
            paidAt: {
                type: Date
            }
        },
        pendingOrders: [{
            provider: {
                type: String,
                trim: true
            },
            planId: {
                type: String,
                trim: true
            },
            orderId: {
                type: String,
                trim: true
            },
            amount: {
                type: Number,
                min: 0
            },
            currency: {
                type: String,
                trim: true,
                uppercase: true,
                maxlength: 3
            },
            status: {
                type: String,
                enum: ["created", "paid", "failed"],
                default: "created"
            },
            createdAt: {
                type: Date,
                default: Date.now
            },
            verifiedAt: {
                type: Date
            }
        }],
        updatedAt: {
            type: Date
        }
    },
    fitnessProfile: {
        bodyWeightKg: {
            type: Number,
            min: 25,
            max: 350
        },
        heightCm: {
            type: Number,
            min: 100,
            max: 250
        },
        neckCm: {
            type: Number
        },
        waistCm: {
            type: Number
        },
        bmi: {
            type: Number,
            min: 5,
            max: 100
        },
        bmiCategory: {
            type: String,
            trim: true,
            maxlength: 24
        },
        preferredUnitSystem: {
            type: String,
            enum: ["metric", "imperial"],
            default: "metric"
        },
        waistToHeightRatio: {
            type: Number
        },
        updatedAt: {
            type: Date
        }
    }
}, {
    timestamps: true,
});
userSchema.pre("save", async function(){

//     Prevents rehashing the password every time the user document is updated.
// Without this, even updating something like email would re-hash an already-hashed password and break login.
    if(!this.isModified("password")) return;
    
// Generates a salt for hashing.
// 10 is the cost factor (rounds).
// Higher = more secure but slower.
// 10–12 is standard for production.
//Salt protects against:
// Rainbow table attacks
// Identical passwords producing identical hashes
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    
});
// userSchema.pre("save", async function(next){
//     if (!this.isModified("password")) return next();

//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);

//     next();
// });

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password || typeof enteredPassword !== "string") {
        return false;
    }

    if (isBcryptHash(this.password)) {
        return await bcrypt.compare(enteredPassword, this.password);
    }

    return this.password === enteredPassword;
};

userSchema.methods.needsPasswordRehash = function () {
    return Boolean(this.password && !isBcryptHash(this.password));
};


const User = mongoose.model('User', userSchema);

module.exports = User;
