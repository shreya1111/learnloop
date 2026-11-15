import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { createAuthMiddleware, requireTrustedOrigin } from "../auth/security.js";
import { Course } from "../models/Course.js";
import { LearningActivity } from "../models/LearningActivity.js";
import { LessonState } from "../models/LessonState.js";
import { QuizAttempt } from "../models/QuizAttempt.js";

const studySessionSchema = z
  .object({
    courseId: z.string().refine(mongoose.isValidObjectId),
    durationMinutes: z.number().int().min(1).max(360),
  })
  .strict();

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function dateOffset(date, offset) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return dayKey(result);
}

export function calculateStreak(dates, now = new Date()) {
  const activeDays = new Set([...dates].map(dayKey));
  const today = dayKey(now);
  let current = activeDays.has(today) ? today : dateOffset(today, -1);
  let streak = 0;
  while (activeDays.has(current)) {
    streak += 1;
    current = dateOffset(current, -1);
  }
  return streak;
}

export function createProgressRouter({
  config,
  UserModel,
  CourseModel = Course,
  LessonStateModel = LessonState,
  QuizAttemptModel = QuizAttempt,
  LearningActivityModel = LearningActivity,
  clock = () => new Date(),
}) {
  const router = Router();
  const requireAuth = createAuthMiddleware({ config, UserModel });
  const verifyOrigin = requireTrustedOrigin(config);

  router.get("/", requireAuth, async (request, response) => {
    const userId = request.authUser._id;
    const [courses, states, attempts, activities] = await Promise.all([
      CourseModel.find({ userId }).select("_id title chapters videos updatedAt"),
      LessonStateModel.find({ userId }).select(
        "courseId videoId completed completedAt note bookmarked updatedAt",
      ),
      QuizAttemptModel.find({ userId })
        .sort({ submittedAt: -1 })
        .limit(500)
        .select("courseId scorePercent totalQuestions correctCount submittedAt"),
      LearningActivityModel.find({ userId })
        .sort({ occurredAt: -1 })
        .limit(1000)
        .select("courseId durationMinutes occurredAt"),
    ]);

    const now = clock();
    const today = dayKey(now);
    const courseSummaries = courses.map((course) => {
      const lessonCount =
        course.chapters?.reduce(
          (total, chapter) => total + chapter.lessons.length,
          0,
        ) || course.videos?.length || 0;
      const courseStates = states.filter(
        (state) => String(state.courseId) === String(course._id),
      );
      const completedLessons = courseStates.filter(
        (state) => state.completed,
      ).length;
      return {
        courseId: String(course._id),
        title: course.title,
        lessonCount,
        completedLessons,
        progressPercent:
          lessonCount > 0
            ? Math.round((completedLessons / lessonCount) * 100)
            : 0,
      };
    });

    const completedDates = states
      .filter((state) => state.completed && state.completedAt)
      .map((state) => state.completedAt);
    const quizDates = attempts.map((attempt) => attempt.submittedAt);
    const activityDates = activities.map((activity) => activity.occurredAt);
    const activeDateSet = new Set(
      [...completedDates, ...quizDates, ...activityDates].map(dayKey),
    );
    const studySessions = Array.from({ length: 7 }, (_value, index) => {
      const date = dateOffset(today, index - 6);
      const minutes = activities
        .filter((activity) => dayKey(activity.occurredAt) === date)
        .reduce((total, activity) => total + activity.durationMinutes, 0);
      return {
        date,
        minutes,
        day: new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" })
          .format(new Date(`${date}T12:00:00.000Z`)),
      };
    });
    const currentWeekMinutes = studySessions.reduce(
      (total, day) => total + day.minutes,
      0,
    );
    const recentActivity = [
      ...states
        .filter((state) => state.completed && state.completedAt)
        .map((state) => ({
          type: "lesson-completed",
          courseId: String(state.courseId),
          videoId: state.videoId,
          title: courses.find(
            (course) => String(course._id) === String(state.courseId),
          )?.title,
          occurredAt: state.completedAt,
        })),
      ...attempts.map((attempt) => ({
        type: "quiz-attempt",
        courseId: String(attempt.courseId),
        scorePercent: attempt.scorePercent,
        occurredAt: attempt.submittedAt,
      })),
      ...activities.map((activity) => ({
        type: "study-session",
        courseId: String(activity.courseId),
        durationMinutes: activity.durationMinutes,
        occurredAt: activity.occurredAt,
      })),
    ]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      )
      .slice(0, 8)
      .map((activity) => ({
        ...activity,
        courseTitle: courses.find(
          (course) => String(course._id) === activity.courseId,
        )?.title ?? "Course",
      }));
    const completedLessons = states.filter((state) => state.completed).length;
    const totalLessons = courseSummaries.reduce(
      (total, course) => total + course.lessonCount,
      0,
    );
    const averageQuizScore = attempts.length
      ? Math.round(
          attempts.reduce((total, attempt) => total + attempt.scorePercent, 0) /
            attempts.length,
        )
      : null;

    return response.json({
      success: true,
      data: {
        summary: {
          totalCourses: courses.length,
          activeCourses: courseSummaries.filter(
            (course) =>
              course.progressPercent > 0 && course.progressPercent < 100,
          ).length,
          completedCourses: courseSummaries.filter(
            (course) =>
              course.lessonCount > 0 && course.progressPercent === 100,
          ).length,
          completedLessons,
          totalLessons,
          overallProgressPercent:
            totalLessons > 0
              ? Math.round((completedLessons / totalLessons) * 100)
              : 0,
          currentStreakDays: calculateStreak(activeDateSet, now),
          studyMinutesThisWeek: currentWeekMinutes,
          averageQuizScore,
        },
        courses: courseSummaries,
        weeklyStudy: studySessions,
        recentActivity,
      },
    });
  });

  router.post(
    "/study-sessions",
    verifyOrigin,
    requireAuth,
    async (request, response) => {
      const parsed = studySessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Provide a course and 1 to 360 study minutes",
          },
        });
      }

      const course = await CourseModel.findOne({
        _id: parsed.data.courseId,
        userId: request.authUser._id,
      }).select("_id");
      if (!course) {
        return response.status(404).json({
          success: false,
          error: { code: "COURSE_NOT_FOUND", message: "Course not found" },
        });
      }

      const activity = await LearningActivityModel.create({
        userId: request.authUser._id,
        courseId: course._id,
        durationMinutes: parsed.data.durationMinutes,
        occurredAt: clock(),
      });
      return response.status(201).json({
        success: true,
        data: {
          activity: {
            courseId: String(activity.courseId),
            durationMinutes: activity.durationMinutes,
            occurredAt: activity.occurredAt,
          },
        },
      });
    },
  );

  return router;
}
