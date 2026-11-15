import mongoose from "mongoose";

const learningActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    durationMinutes: { type: Number, required: true, min: 1, max: 360 },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

learningActivitySchema.index({ userId: 1, occurredAt: -1 });
learningActivitySchema.index({ userId: 1, courseId: 1, occurredAt: -1 });

export const LearningActivity =
  mongoose.models.LearningActivity ??
  mongoose.model("LearningActivity", learningActivitySchema);
