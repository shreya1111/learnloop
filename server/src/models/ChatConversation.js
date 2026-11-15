import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true, maxlength: 5000 },
    citations: {
      type: [
        {
          videoId: { type: String, required: true, maxlength: 20 },
          title: { type: String, required: true, maxlength: 500 },
        },
      ],
      default: [],
    },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);

const chatConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    messageCount: { type: Number, required: true, default: 0, min: 0 },
    lastMessagePreview: { type: String, default: "", maxlength: 180 },
    messages: { type: [chatMessageSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_document, result) {
        delete result.userId;
        delete result.__v;
        return result;
      },
    },
  },
);

chatConversationSchema.index({ userId: 1, courseId: 1, updatedAt: -1 });

export const ChatConversation =
  mongoose.models.ChatConversation ??
  mongoose.model("ChatConversation", chatConversationSchema);
