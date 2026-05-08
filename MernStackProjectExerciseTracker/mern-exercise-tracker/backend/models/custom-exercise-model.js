const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const customExerciseSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 80
    },
    category: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 80
    },
    instructions: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000
    },
    primaryMuscles: {
        type: [{ type: String, trim: true, maxlength: 40 }],
        default: []
    },
    secondaryMuscles: {
        type: [{ type: String, trim: true, maxlength: 40 }],
        default: []
    },
    equipment: {
        type: [{ type: String, trim: true, maxlength: 40 }],
        default: []
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    createdByUsername: {
        type: String,
        required: true,
        trim: true,
        maxlength: 32
    }
}, {
    timestamps: true,
});

const CustomExercise = mongoose.model("CustomExercise", customExerciseSchema);

module.exports = CustomExercise;
