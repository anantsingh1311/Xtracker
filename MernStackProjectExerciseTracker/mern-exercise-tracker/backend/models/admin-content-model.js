const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const adminContentSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 120
    },
    contentType: {
        type: String,
        enum: ["exercise", "article", "image", "video", "document", "link", "note"],
        default: "exercise",
        index: true
    },
    status: {
        type: String,
        enum: ["draft", "published", "archived"],
        default: "draft",
        index: true
    },
    summary: {
        type: String,
        trim: true,
        default: "",
        maxlength: 500
    },
    body: {
        type: String,
        trim: true,
        default: "",
        maxlength: 5000
    },
    resourceUrl: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000
    },
    tags: {
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
    timestamps: true,
});

adminContentSchema.index({ title: "text", summary: "text", body: "text", tags: "text" });

const AdminContent = mongoose.model("AdminContent", adminContentSchema);

module.exports = AdminContent;
