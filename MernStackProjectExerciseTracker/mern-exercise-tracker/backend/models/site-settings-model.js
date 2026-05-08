const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const siteSettingsSchema = new Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 80
    },
    announcement: {
        enabled: {
            type: Boolean,
            default: false
        },
        title: {
            type: String,
            trim: true,
            default: "",
            maxlength: 100
        },
        message: {
            type: String,
            trim: true,
            default: "",
            maxlength: 500
        }
    },
    featuredExercise: {
        title: {
            type: String,
            trim: true,
            default: "",
            maxlength: 100
        },
        description: {
            type: String,
            trim: true,
            default: "",
            maxlength: 500
        },
        resourceUrl: {
            type: String,
            trim: true,
            default: "",
            maxlength: 1000
        }
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    updatedByUsername: {
        type: String,
        trim: true,
        maxlength: 32
    }
}, {
    timestamps: true
});

const SiteSettings = mongoose.model("SiteSettings", siteSettingsSchema);

module.exports = SiteSettings;
