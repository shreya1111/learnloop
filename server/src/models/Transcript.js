import mongoose from "mongoose";

const transcriptSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    videoId: { type: String, required: true, maxlength: 128 },
    text: { type: String, required: true, maxlength: 250000 },
    source: { type: String, enum: ["user"], required: true },
  },
  { timestamps: true },
);

transcriptSchema.index({ courseId: 1, videoId: 1 }, { unique: true });
transcriptSchema.index({ userId: 1, updatedAt: -1 });

export const Transcript =
  mongoose.models.Transcript ??
  mongoose.model("Transcript", transcriptSchema);
