import mongoose from "mongoose";

const lessonStateSchema = new mongoose.Schema(
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
    videoId: { type: String, required: true, maxlength: 128 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    note: { type: String, default: "", maxlength: 20000 },
    bookmarked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

lessonStateSchema.index(
  { userId: 1, courseId: 1, videoId: 1 },
  { unique: true },
);
lessonStateSchema.index({ userId: 1, courseId: 1, updatedAt: -1 });

export const LessonState =
  mongoose.models.LessonState ??
  mongoose.model("LessonState", lessonStateSchema);
