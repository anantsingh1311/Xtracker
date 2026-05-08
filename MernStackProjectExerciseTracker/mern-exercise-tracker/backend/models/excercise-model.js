const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const excerciseSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    description: { type: String, required: true, maxlength: 160, trim: true },
    duration: { type: Number, required: true },
    calories: { type: Number, default: 0 },
    bodyWeightKg: { type: Number, required: true },
    weightUnit: {
        type: String,
        enum: ["kg", "lb"],
        default: "kg"
    },
    intensity: {
        type: String,
        enum: ["light", "moderate", "vigorous"],
        required: true
    },
    metValue: { type: Number, required: true },
    activityCategory: { type: String, required: true },
    calorieMethod: { type: String, required: true },
    date: { type: Date, required: true }
}, {
    timestamps: true,
});

const Excercise = mongoose.model('Excercise', excerciseSchema);

module.exports = Excercise;
