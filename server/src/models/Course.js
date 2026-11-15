import mongoose from "mongoose";
import { playlistSchema } from "./Playlist.js";

const courseVideoSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 500 },
    description: { type: String, default: "", maxlength: 5000 },
    thumbnailUrl: { type: String, default: "", maxlength: 2048 },
    channelTitle: { type: String, default: "", maxlength: 200 },
    position: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, default: null, min: 0 },
    videoUrl: { type: String, required: true, maxlength: 2048 },
  },
  { _id: false },
);

const courseLessonSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 500 },
    videoUrl: { type: String, required: true, maxlength: 2048 },
    position: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const courseChapterSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    position: { type: Number, required: true, min: 0 },
    lessons: { type: [courseLessonSchema], required: true },
  },
  { _id: false },
);

const courseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 5000 },
    status: {
      type: String,
      enum: ["imported", "structured"],
      default: "imported",
      index: true,
    },
    playlist: { type: playlistSchema, required: true },
    videos: {
      type: [courseVideoSchema],
      default: [],
    },
    learningObjectives: {
      type: [{ type: String, maxlength: 300 }],
      default: [],
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", null],
      default: null,
    },
    prerequisites: {
      type: [{ type: String, maxlength: 300 }],
      default: [],
    },
    estimatedDurationMinutes: { type: Number, default: null, min: 1 },
    chapters: {
      type: [courseChapterSchema],
      default: [],
    },
    estimatedDurationSeconds: { type: Number, default: null, min: 0 },
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

courseSchema.index(
  { userId: 1, "playlist.youtubePlaylistId": 1 },
  { unique: true },
);
courseSchema.index({ userId: 1, updatedAt: -1 });

export const Course =
  mongoose.models.Course ?? mongoose.model("Course", courseSchema);
