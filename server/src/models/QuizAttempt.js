import mongoose from "mongoose";

const questionResultSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    answer: { type: String, required: true, maxlength: 1000 },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false },
);

const topicResultSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, maxlength: 200 },
    correct: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    masteryPercent: { type: Number, required: true, min: 0, max: 100 },
    recommendation: {
      type: String,
      enum: ["skip", "revise", "deeper-learning"],
      required: true,
    },
  },
  { _id: false },
);

const quizAttemptSchema = new mongoose.Schema(
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
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    scorePercent: { type: Number, required: true, min: 0, max: 100 },
    correctCount: { type: Number, required: true, min: 0 },
    totalQuestions: { type: Number, required: true, min: 1 },
    questionResults: { type: [questionResultSchema], required: true },
    topicResults: { type: [topicResultSchema], required: true },
    submittedAt: { type: Date, required: true, default: Date.now },
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

quizAttemptSchema.index({ userId: 1, quizId: 1, submittedAt: -1 });
quizAttemptSchema.index({ userId: 1, courseId: 1, submittedAt: -1 });

export const QuizAttempt =
  mongoose.models.QuizAttempt ??
  mongoose.model("QuizAttempt", quizAttemptSchema);
