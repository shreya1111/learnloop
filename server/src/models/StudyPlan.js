import mongoose from "mongoose";

const studySessionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    dayOffset: { type: Number, required: true, min: 0, max: 111 },
    title: { type: String, required: true, maxlength: 200 },
    focus: { type: String, required: true, maxlength: 1500 },
    kind: { type: String, enum: ["learning", "revision"], required: true },
    durationMinutes: { type: Number, required: true, min: 1, max: 480 },
    lessonVideoIds: {
      type: [{ type: String, maxlength: 20 }],
      required: true,
    },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const studyPlanSchema = new mongoose.Schema(
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
    goal: { type: String, required: true, maxlength: 500 },
    summary: { type: String, required: true, maxlength: 2000 },
    startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    weeks: { type: Number, required: true, min: 1, max: 16 },
    minutesPerSession: { type: Number, required: true, min: 15, max: 480 },
    studyDays: {
      type: [
        {
          type: String,
          enum: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ],
        },
      ],
      required: true,
    },
    sessions: { type: [studySessionSchema], required: true },
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

studyPlanSchema.index({ userId: 1, courseId: 1 }, { unique: true });
studyPlanSchema.index({ userId: 1, updatedAt: -1 });

export const StudyPlan =
  mongoose.models.StudyPlan ?? mongoose.model("StudyPlan", studyPlanSchema);
