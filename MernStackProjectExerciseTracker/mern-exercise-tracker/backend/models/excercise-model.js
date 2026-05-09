const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const excerciseSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    description: { type: String, required: true, maxlength: 160, trim: true },
    workoutType: {
        type: String,
        enum: ["cardio", "strength"],
        default: "cardio"
    },
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
    setCount: { type: Number, default: null },
    repsPerSet: { type: Number, default: null },
    totalReps: { type: Number, default: null },
    loadWeight: { type: Number, default: null },
    loadUnit: {
        type: String,
        enum: ["kg", "lb"],
        default: "kg"
    },
    loadWeightKg: { type: Number, default: null },
    volumeLoadKg: { type: Number, default: null },
    metValue: { type: Number, required: true },
    activityCategory: { type: String, required: true },
    calorieMethod: { type: String, required: true },
    date: { type: Date, required: true }
}, {
    timestamps: true,
});

const Excercise = mongoose.model('Excercise', excerciseSchema);

module.exports = Excercise;
