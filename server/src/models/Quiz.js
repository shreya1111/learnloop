import mongoose from "mongoose";

const quizQuestionSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, maxlength: 200 },
    lessonVideoIds: {
      type: [{ type: String, maxlength: 20 }],
      required: true,
    },
    type: {
      type: String,
      enum: ["multiple-choice", "true-false", "short-answer"],
      required: true,
    },
    prompt: { type: String, required: true, maxlength: 1500 },
    options: { type: [{ type: String, maxlength: 300 }], default: [] },
    correctAnswer: { type: String, required: true, maxlength: 1000 },
    acceptedAnswers: {
      type: [{ type: String, maxlength: 1000 }],
      default: [],
    },
    explanation: { type: String, required: true, maxlength: 1500 },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },
  },
  { timestamps: true },
);

const quizSchema = new mongoose.Schema(
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
    title: { type: String, required: true, maxlength: 200 },
    mode: { type: String, enum: ["quiz", "placement"], required: true },
    description: { type: String, required: true, maxlength: 1000 },
    questions: { type: [quizQuestionSchema], required: true },
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

quizSchema.index({ userId: 1, courseId: 1, createdAt: -1 });

export const Quiz =
  mongoose.models.Quiz ?? mongoose.model("Quiz", quizSchema);
