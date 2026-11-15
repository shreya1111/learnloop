import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { createAuthMiddleware, requireTrustedOrigin } from "../auth/security.js";
import { GeminiProviderError } from "../ai/geminiJson.js";
import { generatedStudyPlanSchema } from "../ai/studyPlan.js";
import { Course } from "../models/Course.js";
import { StudyPlan } from "../models/StudyPlan.js";

const studyDayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const studyDaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

function isValidCalendarDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

const studyPlanRequestSchema = z
  .object({
    goal: z.string().trim().min(3).max(500),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isValidCalendarDate),
    weeks: z.number().int().min(1).max(16),
    minutesPerSession: z.number().int().min(15).max(480),
    studyDays: z
      .array(studyDaySchema)
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length),
  })
  .strict();

const sessionUpdateSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isValidCalendarDate)
      .optional(),
    title: z.string().trim().min(1).max(200).optional(),
    focus: z.string().trim().min(1).max(1500).optional(),
    durationMinutes: z.number().int().min(1).max(480).optional(),
    lessonVideoIds: z
      .array(z.string().min(1).max(20))
      .min(1)
      .max(500)
      .optional(),
    completed: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

function courseNotFound(response) {
  return response.status(404).json({
    success: false,
    error: { code: "COURSE_NOT_FOUND", message: "Course not found" },
  });
}

function planNotFound(response) {
  return response.status(404).json({
    success: false,
    error: { code: "STUDY_PLAN_NOT_FOUND", message: "Study plan not found" },
  });
}

function providerErrorResponse(response, error) {
  if (!(error instanceof GeminiProviderError)) {
    throw error;
  }
  return response.status(error.statusCode).json({
    success: false,
    error: { code: error.code, message: error.message },
  });
}

function invalidPlanResponse(response, message) {
  return response.status(502).json({
    success: false,
    error: { code: "AI_INVALID_OUTPUT", message },
  });
}

function dateForOffset(startDate, dayOffset) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function countAvailableDays(preferences) {
  let count = 0;
  for (let offset = 0; offset < preferences.weeks * 7; offset += 1) {
    const date = new Date(
      `${dateForOffset(preferences.startDate, offset)}T00:00:00.000Z`,
    );
    if (preferences.studyDays.includes(studyDayNames[date.getUTCDay()])) {
      count += 1;
    }
  }
  return count;
}

export function validateGeneratedPlan(generated, course, preferences) {
  const parsed = generatedStudyPlanSchema.safeParse(generated);
  if (!parsed.success) {
    return {
      success: false,
      message: "The AI provider returned a study plan in an invalid format",
    };
  }

  const sessions = parsed.data.sessions.toSorted(
    (left, right) => left.dayOffset - right.dayOffset,
  );
  const courseVideos = [...course.videos].sort(
    (left, right) => left.position - right.position,
  );
  const expectedVideoIds = courseVideos.map((video) => video.videoId);
  const learningVideoIds = sessions
    .filter((session) => session.kind === "learning")
    .flatMap((session) => session.lessonVideoIds);
  const seenOffsets = new Set();
  const allowedVideoIds = new Set(expectedVideoIds);

  if (
    learningVideoIds.length !== expectedVideoIds.length ||
    learningVideoIds.some(
      (videoId, index) => videoId !== expectedVideoIds[index],
    )
  ) {
    return {
      success: false,
      message: "The plan must schedule every course lesson once and in order",
    };
  }
  if (!sessions.some((session) => session.kind === "revision")) {
    return {
      success: false,
      message: "The plan must include at least one revision session",
    };
  }

  for (const session of sessions) {
    if (
      session.dayOffset >= preferences.weeks * 7 ||
      session.durationMinutes > preferences.minutesPerSession ||
      seenOffsets.has(session.dayOffset)
    ) {
      return {
        success: false,
        message:
          "The plan must fit the selected date range and daily study availability",
      };
    }
    seenOffsets.add(session.dayOffset);

    const date = new Date(
      `${dateForOffset(preferences.startDate, session.dayOffset)}T00:00:00.000Z`,
    );
    if (!preferences.studyDays.includes(studyDayNames[date.getUTCDay()])) {
      return {
        success: false,
        message: "The plan scheduled a session on a day you did not select",
      };
    }
    if (
      new Set(session.lessonVideoIds).size !== session.lessonVideoIds.length ||
      session.lessonVideoIds.some((videoId) => !allowedVideoIds.has(videoId))
    ) {
      return {
        success: false,
        message: "The plan references a lesson that is not in this course",
      };
    }
  }

  return {
    success: true,
    data: {
      ...parsed.data,
      sessions: sessions.map((session) => ({
        ...session,
        date: dateForOffset(preferences.startDate, session.dayOffset),
      })),
    },
  };
}

export function createStudyPlanRouter({
  config,
  UserModel,
  CourseModel = Course,
  StudyPlanModel = StudyPlan,
  studyPlanGenerator,
}) {
  const router = Router();
  const requireAuth = createAuthMiddleware({ config, UserModel });
  const verifyOrigin = requireTrustedOrigin(config);
  const generationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({
        success: false,
        error: {
          code: "AI_RATE_LIMITED",
          message: "Too many study plan requests; try again later",
        },
      });
    },
  });

  router.get(
    "/courses/:courseId",
    requireAuth,
    async (request, response) => {
      if (!mongoose.isValidObjectId(request.params.courseId)) {
        return courseNotFound(response);
      }

      const course = await CourseModel.findOne({
        _id: request.params.courseId,
        userId: request.authUser._id,
      });
      if (!course) {
        return courseNotFound(response);
      }

      const plan = await StudyPlanModel.findOne({
        userId: request.authUser._id,
        courseId: course._id,
      });
      return response.json({ success: true, data: { plan } });
    },
  );

  router.post(
    "/courses/:courseId",
    verifyOrigin,
    requireAuth,
    generationLimiter,
    async (request, response) => {
      const parsedPreferences = studyPlanRequestSchema.safeParse(request.body);
      if (!parsedPreferences.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Check the study goal, availability, and start date",
          },
        });
      }
      if (!mongoose.isValidObjectId(request.params.courseId)) {
        return courseNotFound(response);
      }

      const course = await CourseModel.findOne({
        _id: request.params.courseId,
        userId: request.authUser._id,
      });
      if (!course) {
        return courseNotFound(response);
      }
      if (course.status !== "structured" || course.chapters.length === 0) {
        return response.status(409).json({
          success: false,
          error: {
            code: "COURSE_NOT_STRUCTURED",
            message: "Generate a course outline before creating a study plan",
          },
        });
      }

      const preferences = parsedPreferences.data;
      const capacityMinutes =
        countAvailableDays(preferences) * preferences.minutesPerSession;
      const estimatedMinutes =
        course.estimatedDurationMinutes ??
        (course.estimatedDurationSeconds === null
          ? null
          : Math.ceil(course.estimatedDurationSeconds / 60));
      if (estimatedMinutes !== null && estimatedMinutes > capacityMinutes) {
        return response.status(422).json({
          success: false,
          error: {
            code: "SCHEDULE_CAPACITY_TOO_LOW",
            message:
              "Your available study time is shorter than this course estimate. Add weeks, study days, or minutes per session.",
          },
        });
      }

      const existingPlan = await StudyPlanModel.findOne({
        userId: request.authUser._id,
        courseId: course._id,
      });
      if (existingPlan) {
        return response.status(409).json({
          success: false,
          error: {
            code: "STUDY_PLAN_ALREADY_EXISTS",
            message:
              "A study plan already exists for this course; edit its sessions to adjust your schedule",
          },
        });
      }

      let generated;
      try {
        generated = await studyPlanGenerator({ course, preferences });
      } catch (error) {
        return providerErrorResponse(response, error);
      }

      const validated = validateGeneratedPlan(generated, course, preferences);
      if (!validated.success) {
        return invalidPlanResponse(response, validated.message);
      }

      let plan;
      try {
        plan = await StudyPlanModel.create({
          userId: request.authUser._id,
          courseId: course._id,
          title: validated.data.title,
          goal: preferences.goal,
          summary: validated.data.summary,
          startDate: preferences.startDate,
          weeks: preferences.weeks,
          minutesPerSession: preferences.minutesPerSession,
          studyDays: preferences.studyDays,
          sessions: validated.data.sessions,
        });
      } catch (error) {
        if (error.code === 11000) {
          return response.status(409).json({
            success: false,
            error: {
              code: "STUDY_PLAN_ALREADY_EXISTS",
              message:
                "A study plan already exists for this course; refresh to load it",
            },
          });
        }
        throw error;
      }

      return response.status(201).json({ success: true, data: { plan } });
    },
  );

  router.patch(
    "/:planId/sessions/:sessionId",
    verifyOrigin,
    requireAuth,
    async (request, response) => {
      const parsedUpdate = sessionUpdateSchema.safeParse(request.body);
      if (!parsedUpdate.success) {
        return response.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Provide at least one valid session update",
          },
        });
      }
      if (
        !mongoose.isValidObjectId(request.params.planId) ||
        !mongoose.isValidObjectId(request.params.sessionId)
      ) {
        return planNotFound(response);
      }

      const plan = await StudyPlanModel.findOne({
        _id: request.params.planId,
        userId: request.authUser._id,
      });
      if (!plan) {
        return planNotFound(response);
      }
      const session = plan.sessions.id(request.params.sessionId);
      if (!session) {
        return planNotFound(response);
      }

      const update = parsedUpdate.data;
      if (update.lessonVideoIds) {
        const course = await CourseModel.findOne({
          _id: plan.courseId,
          userId: request.authUser._id,
        });
        if (!course) {
          return courseNotFound(response);
        }
        const allowedVideoIds = new Set(
          course.videos.map((video) => video.videoId),
        );
        if (
          new Set(update.lessonVideoIds).size !== update.lessonVideoIds.length ||
          update.lessonVideoIds.some((videoId) => !allowedVideoIds.has(videoId))
        ) {
          return response.status(400).json({
            success: false,
            error: {
              code: "INVALID_LESSON_IDS",
              message: "Sessions can only include distinct lessons from this course",
            },
          });
        }
      }

      Object.assign(session, update);
      if (update.completed !== undefined) {
        session.completedAt = update.completed ? new Date() : null;
      }
      await plan.save();
      return response.json({ success: true, data: { plan } });
    },
  );

  return router;
}
